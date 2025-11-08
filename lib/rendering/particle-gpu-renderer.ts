// GPU-Accelerated Particle Renderer using WebGL Instancing
import { WebGLRenderer } from './webgl-renderer'
import { Particle } from '../types'

export const particleVertexShader = `#version 300 es
in vec2 a_position;
in vec2 a_center;
in float a_size;
in vec4 a_color;
in float a_life;

uniform vec2 u_resolution;
uniform mat3 u_matrix;

out vec4 v_color;
out float v_life;
out vec2 v_uv;

void main() {
  // Transform quad position by size and center
  vec2 worldPos = a_position * a_size + a_center;
  vec2 position = (u_matrix * vec3(worldPos, 1)).xy;
  
  // Convert from pixels to clip space
  vec2 clipSpace = ((position / u_resolution) * 2.0) - 1.0;
  
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  
  // Pass UV coordinates for fragment shader
  v_uv = a_position + vec2(0.5);
  v_color = a_color;
  v_life = a_life;
}
`

export const particleFragmentShader = `#version 300 es
precision highp float;

in vec4 v_color;
in float v_life;
in vec2 v_uv;

out vec4 fragColor;

void main() {
  // Create circular particle from UV coordinates
  vec2 coord = v_uv - vec2(0.5);
  float dist = length(coord);
  
  // Circular particle with soft edge
  float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
  
  // Apply life fade
  alpha *= v_life;
  
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`

export class GPUParticleRenderer {
  private renderer: WebGLRenderer
  private maxParticles: number
  private particleBuffer: WebGLBuffer | null = null
  private instanceBuffer: WebGLBuffer | null = null
  private particleCount = 0
  
  // Particle data arrays
  private positions: Float32Array
  private centers: Float32Array
  private sizes: Float32Array
  private colors: Float32Array
  private lives: Float32Array
  
  constructor(renderer: WebGLRenderer, maxParticles: number = 10000) {
    this.renderer = renderer
    this.maxParticles = maxParticles
    
    // Initialize data arrays
    const gl = renderer.getContext()
    if (!gl) throw new Error('WebGL context required')
    
    // Create buffers
    this.particleBuffer = gl.createBuffer()
    this.instanceBuffer = gl.createBuffer()
    
    // Initialize arrays
    this.positions = new Float32Array(maxParticles * 2) // x, y per particle
    this.centers = new Float32Array(maxParticles * 2)   // center x, y
    this.sizes = new Float32Array(maxParticles)          // size per particle
    this.colors = new Float32Array(maxParticles * 4)     // r, g, b, a
    this.lives = new Float32Array(maxParticles)          // life value
    
    // Create quad vertices for instancing
    const quadVertices = new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
      -0.5,  0.5,
       0.5,  0.5,
    ])
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW)
    
    // Compile shader program
    renderer.createProgram(particleVertexShader, particleFragmentShader, 'particles')
  }
  
  updateParticles(particles: Particle[]): void {
    const gl = this.renderer.getContext()
    if (!gl || !this.instanceBuffer) return
    
    this.particleCount = Math.min(particles.length, this.maxParticles)
    
    // Update instance data
    for (let i = 0; i < this.particleCount; i++) {
      const p = particles[i]
      const idx = i * 2
      
      // Center position
      this.centers[idx] = p.x
      this.centers[idx + 1] = p.y
      
      // Size
      this.sizes[i] = p.radius
      
      // Color (parse hex or use default)
      const color = this.parseColor(p.color)
      const colorIdx = i * 4
      this.colors[colorIdx] = color.r
      this.colors[colorIdx + 1] = color.g
      this.colors[colorIdx + 2] = color.b
      this.colors[colorIdx + 3] = color.a
      
      // Life
      this.lives[i] = p.life
    }
    
    // Upload to GPU
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    
    // Interleave instance data: center(2) + size(1) + color(4) + life(1) = 8 floats per instance
    const instanceData = new Float32Array(this.particleCount * 8)
    for (let i = 0; i < this.particleCount; i++) {
      const base = i * 8
      instanceData[base] = this.centers[i * 2]
      instanceData[base + 1] = this.centers[i * 2 + 1]
      instanceData[base + 2] = this.sizes[i]
      instanceData[base + 3] = this.colors[i * 4]
      instanceData[base + 4] = this.colors[i * 4 + 1]
      instanceData[base + 5] = this.colors[i * 4 + 2]
      instanceData[base + 6] = this.colors[i * 4 + 3]
      instanceData[base + 7] = this.lives[i]
    }
    
    gl.bufferData(gl.ARRAY_BUFFER, instanceData, gl.DYNAMIC_DRAW)
  }
  
  private parseColor(color: string): { r: number; g: number; b: number; a: number } {
    // Parse hex color (#RRGGBB or #RRGGBBAA)
    if (color.startsWith('#')) {
      const hex = color.slice(1)
      const r = parseInt(hex.slice(0, 2), 16) / 255
      const g = parseInt(hex.slice(2, 4), 16) / 255
      const b = parseInt(hex.slice(4, 6), 16) / 255
      const a = hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      return { r, g, b, a }
    }
    
    // Default white
    return { r: 1, g: 1, b: 1, a: 1 }
  }
  
  render(width: number, height: number): void {
    const gl = this.renderer.getContext()
    if (!gl || !this.particleBuffer || !this.instanceBuffer || this.particleCount === 0) {
      return
    }
    
    // Use particle shader
    if (!this.renderer.useProgram('particles')) {
      return
    }
    
    // Set uniforms
    this.renderer.setUniform('particles', 'u_resolution', 'vec2', [width, height])
    this.renderer.setUniform('particles', 'u_matrix', 'mat3', [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ])
    
    // Bind quad vertices
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer)
    const positionLoc = this.renderer.getAttribLocation('particles', 'a_position')
    if (positionLoc >= 0) {
      gl.enableVertexAttribArray(positionLoc)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)
    }
    
    // Bind instance data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    
    // Set up instance attributes
    const stride = 8 * 4 // 8 floats * 4 bytes
    
    const centerLoc = this.renderer.getAttribLocation('particles', 'a_center')
    if (centerLoc >= 0) {
      gl.enableVertexAttribArray(centerLoc)
      gl.vertexAttribPointer(centerLoc, 2, gl.FLOAT, false, stride, 0)
      this.renderer.setVertexAttribDivisor(centerLoc, 1) // Instance divisor
    }
    
    const sizeLoc = this.renderer.getAttribLocation('particles', 'a_size')
    if (sizeLoc >= 0) {
      gl.enableVertexAttribArray(sizeLoc)
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, 8)
      this.renderer.setVertexAttribDivisor(sizeLoc, 1)
    }
    
    const colorLoc = this.renderer.getAttribLocation('particles', 'a_color')
    if (colorLoc >= 0) {
      gl.enableVertexAttribArray(colorLoc)
      gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 12)
      this.renderer.setVertexAttribDivisor(colorLoc, 1)
    }
    
    const lifeLoc = this.renderer.getAttribLocation('particles', 'a_life')
    if (lifeLoc >= 0) {
      gl.enableVertexAttribArray(lifeLoc)
      gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, stride, 28)
      this.renderer.setVertexAttribDivisor(lifeLoc, 1)
    }
    
    // Enable blending
    this.renderer.enableBlend()
    
    // Render instanced
    this.renderer.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.particleCount)
    
    // Cleanup
    this.renderer.disableBlend()
    
    // Reset divisors
    if (centerLoc >= 0) this.renderer.setVertexAttribDivisor(centerLoc, 0)
    if (sizeLoc >= 0) this.renderer.setVertexAttribDivisor(sizeLoc, 0)
    if (colorLoc >= 0) this.renderer.setVertexAttribDivisor(colorLoc, 0)
    if (lifeLoc >= 0) this.renderer.setVertexAttribDivisor(lifeLoc, 0)
  }
  
  cleanup(): void {
    const gl = this.renderer.getContext()
    if (!gl) return
    
    if (this.particleBuffer) {
      gl.deleteBuffer(this.particleBuffer)
      this.particleBuffer = null
    }
    
    if (this.instanceBuffer) {
      gl.deleteBuffer(this.instanceBuffer)
      this.instanceBuffer = null
    }
    
    this.particleCount = 0
  }
}

