// WebGL Compute Shaders for Client-Side Boids Simulation
// Uses Transform Feedback for GPU-based particle simulation
import { WebGLRenderer } from './webgl-renderer'
import { StreamedBoidState } from '../api/streaming'

// Boids compute shader using transform feedback
export const boidsComputeVertexShader = `#version 300 es
in vec2 a_position;
in vec2 a_velocity;
in float a_type; // 0=producer, 1=prey, 2=predator

uniform vec2 u_resolution;
uniform float u_dt;
uniform float u_separation;
uniform float u_alignment;
uniform float u_cohesion;
uniform float u_maxSpeed;
uniform float u_maxForce;
uniform sampler2D u_boidsTexture; // Texture containing all boid positions/velocities
uniform int u_numBoids;

out vec2 v_position;
out vec2 v_velocity;
out float v_type;

// Boids rules
vec2 separation(vec2 pos, vec2 vel, float type) {
    vec2 steer = vec2(0.0);
    int count = 0;
    float desiredSeparation = 25.0;
    
    // Sample neighbors from texture
    vec2 texelSize = 1.0 / vec2(textureSize(u_boidsTexture, 0));
    for (int i = 0; i < u_numBoids; i++) {
        if (i >= 256) break; // Limit neighbor checks
        
        float idx = float(i);
        vec2 texCoord = vec2(mod(idx, 16.0) / 16.0, floor(idx / 16.0) / 16.0);
        vec4 neighbor = texture(u_boidsTexture, texCoord);
        vec2 neighborPos = neighbor.xy;
        vec2 neighborVel = neighbor.zw;
        
        float d = distance(pos, neighborPos);
        if (d > 0.0 && d < desiredSeparation) {
            vec2 diff = pos - neighborPos;
            diff = normalize(diff);
            diff /= d; // Weight by distance
            steer += diff;
            count++;
        }
    }
    
    if (count > 0) {
        steer /= float(count);
        steer = normalize(steer) * u_maxSpeed;
        steer -= vel;
        steer = clamp(steer, -u_maxForce, u_maxForce);
    }
    
    return steer * u_separation;
}

vec2 alignment(vec2 pos, vec2 vel, float type) {
    vec2 sum = vec2(0.0);
    int count = 0;
    float neighborDist = 50.0;
    
    vec2 texelSize = 1.0 / vec2(textureSize(u_boidsTexture, 0));
    for (int i = 0; i < u_numBoids; i++) {
        if (i >= 256) break;
        
        float idx = float(i);
        vec2 texCoord = vec2(mod(idx, 16.0) / 16.0, floor(idx / 16.0) / 16.0);
        vec4 neighbor = texture(u_boidsTexture, texCoord);
        vec2 neighborPos = neighbor.xy;
        vec2 neighborVel = neighbor.zw;
        
        float d = distance(pos, neighborPos);
        if (d > 0.0 && d < neighborDist) {
            sum += neighborVel;
            count++;
        }
    }
    
    if (count > 0) {
        sum /= float(count);
        sum = normalize(sum) * u_maxSpeed;
        vec2 steer = sum - vel;
        steer = clamp(steer, -u_maxForce, u_maxForce);
        return steer * u_alignment;
    }
    
    return vec2(0.0);
}

vec2 cohesion(vec2 pos, vec2 vel, float type) {
    vec2 sum = vec2(0.0);
    int count = 0;
    float neighborDist = 50.0;
    
    vec2 texelSize = 1.0 / vec2(textureSize(u_boidsTexture, 0));
    for (int i = 0; i < u_numBoids; i++) {
        if (i >= 256) break;
        
        float idx = float(i);
        vec2 texCoord = vec2(mod(idx, 16.0) / 16.0, floor(idx / 16.0) / 16.0);
        vec4 neighbor = texture(u_boidsTexture, texCoord);
        vec2 neighborPos = neighbor.xy;
        
        float d = distance(pos, neighborPos);
        if (d > 0.0 && d < neighborDist) {
            sum += neighborPos;
            count++;
        }
    }
    
    if (count > 0) {
        sum /= float(count);
        vec2 desired = sum - pos;
        desired = normalize(desired) * u_maxSpeed;
        vec2 steer = desired - vel;
        steer = clamp(steer, -u_maxForce, u_maxForce);
        return steer * u_cohesion;
    }
    
    return vec2(0.0);
}

void main() {
    vec2 pos = a_position;
    vec2 vel = a_velocity;
    
    // Apply boids rules
    vec2 sep = separation(pos, vel, a_type);
    vec2 ali = alignment(pos, vel, a_type);
    vec2 coh = cohesion(pos, vel, a_type);
    
    // Update velocity
    vel += sep + ali + coh;
    
    // Limit speed
    float speed = length(vel);
    if (speed > u_maxSpeed) {
        vel = normalize(vel) * u_maxSpeed;
    }
    
    // Update position
    pos += vel * u_dt;
    
    // Wrap around boundaries
    if (pos.x < 0.0) pos.x = u_resolution.x;
    if (pos.x > u_resolution.x) pos.x = 0.0;
    if (pos.y < 0.0) pos.y = u_resolution.y;
    if (pos.y > u_resolution.y) pos.y = 0.0;
    
    v_position = pos;
    v_velocity = vel;
    v_type = a_type;
    
    // Dummy position for vertex shader
    gl_Position = vec4(0.0, 0.0, 0.0, 1.0);
}
`

export class WebGLBoidsCompute {
  private renderer: WebGLRenderer
  private gl: WebGL2RenderingContext | null = null
  private computeProgram: WebGLProgram | null = null
  private positionBuffer: WebGLBuffer | null = null
  private velocityBuffer: WebGLBuffer | null = null
  private typeBuffer: WebGLBuffer | null = null
  private transformFeedback: WebGLTransformFeedback | null = null
  private outputPositionBuffer: WebGLBuffer | null = null
  private outputVelocityBuffer: WebGLBuffer | null = null
  private outputTypeBuffer: WebGLBuffer | null = null
  
  // Texture for storing boid data (ping-pong)
  private boidsTextureA: WebGLTexture | null = null
  private boidsTextureB: WebGLTexture | null = null
  private currentTexture = 0
  
  private numBoids = 0
  private maxBoids = 100000
  
  // Data arrays
  private positions: Float32Array
  private velocities: Float32Array
  private types: Float32Array
  
  constructor(renderer: WebGLRenderer, maxBoids: number = 100000) {
    this.renderer = renderer
    this.gl = renderer.getContext()
    this.maxBoids = maxBoids
    
    if (!this.gl) {
      throw new Error('WebGL2 context required')
    }
    
    // Initialize data arrays
    this.positions = new Float32Array(maxBoids * 2)
    this.velocities = new Float32Array(maxBoids * 2)
    this.types = new Float32Array(maxBoids)
    
    this.init()
  }
  
  private init(): void {
    if (!this.gl) return
    
    // Create transform feedback
    this.transformFeedback = this.gl.createTransformFeedback()
    
    // Create buffers
    this.positionBuffer = this.gl.createBuffer()
    this.velocityBuffer = this.gl.createBuffer()
    this.typeBuffer = this.gl.createBuffer()
    this.outputPositionBuffer = this.gl.createBuffer()
    this.outputVelocityBuffer = this.gl.createBuffer()
    this.outputTypeBuffer = this.gl.createBuffer()
    
    // Create textures for boid data storage
    this.boidsTextureA = this.createBoidsTexture()
    this.boidsTextureB = this.createBoidsTexture()
    
    // Compile compute shader
    this.compileComputeShader()
  }
  
  private createBoidsTexture(): WebGLTexture | null {
    if (!this.gl) return null
    
    const texture = this.gl.createTexture()
    if (!texture) return null
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    
    // Create texture large enough for max boids
    // Store 4 floats per boid (x, y, vx, vy) in RGBA32F
    const width = 256 // Enough for 65536 boids
    const height = Math.ceil(this.maxBoids / width)
    
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA32F,
      width,
      height,
      0,
      this.gl.RGBA,
      this.gl.FLOAT,
      null
    )
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    
    return texture
  }
  
  private compileComputeShader(): void {
    if (!this.gl) return
    
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, boidsComputeVertexShader)
    if (!vertexShader) return
    
    // Create program with transform feedback
    const program = this.gl.createProgram()
    if (!program) return
    
    this.gl.attachShader(program, vertexShader)
    
    // Set up transform feedback varyings
    this.gl.transformFeedbackVaryings(
      program,
      ['v_position', 'v_velocity', 'v_type'],
      this.gl.SEPARATE_ATTRIBS
    )
    
    this.gl.linkProgram(program)
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Failed to link compute shader:', this.gl.getProgramInfoLog(program))
      return
    }
    
    this.computeProgram = program
  }
  
  private createShader(type: number, source: string): WebGLShader | null {
    if (!this.gl) return null
    
    const shader = this.gl.createShader(type)
    if (!shader) return null
    
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader))
      this.gl.deleteShader(shader)
      return null
    }
    
    return shader
  }
  
  updateFromStream(states: StreamedBoidState[]): void {
    this.numBoids = Math.min(states.length, this.maxBoids)
    
    // Update position and velocity arrays
    for (let i = 0; i < this.numBoids; i++) {
      const state = states[i]
      const idx = i * 2
      
      // Normalize coordinates to [0, 1]
      this.positions[idx] = state.x
      this.positions[idx + 1] = state.y
      this.velocities[idx] = state.vx
      this.velocities[idx + 1] = state.vy
      
      // Determine type (simplified - could be enhanced)
      this.types[i] = Math.abs(state.vx) + Math.abs(state.vy) > 0.01 ? 1.0 : 0.0
    }
    
    // Update texture with current boid data
    this.updateBoidsTexture()
  }
  
  private updateBoidsTexture(): void {
    if (!this.gl || !this.boidsTextureA) return
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.boidsTextureA)
    
    // Pack position and velocity into RGBA
    const data = new Float32Array(this.numBoids * 4)
    for (let i = 0; i < this.numBoids; i++) {
      const idx = i * 4
      data[idx] = this.positions[i * 2]
      data[idx + 1] = this.positions[i * 2 + 1]
      data[idx + 2] = this.velocities[i * 2]
      data[idx + 3] = this.velocities[i * 2 + 1]
    }
    
    const width = 256
    const height = Math.ceil(this.numBoids / width)
    
    this.gl.texSubImage2D(
      this.gl.TEXTURE_2D,
      0,
      0,
      0,
      width,
      height,
      this.gl.RGBA,
      this.gl.FLOAT,
      data
    )
  }
  
  compute(dt: number, resolution: [number, number]): void {
    if (!this.gl || !this.computeProgram || !this.transformFeedback || this.numBoids === 0) {
      return
    }
    
    // Use compute program
    this.gl.useProgram(this.computeProgram)
    
    // Set uniforms
    const resolutionLoc = this.gl.getUniformLocation(this.computeProgram, 'u_resolution')
    const dtLoc = this.gl.getUniformLocation(this.computeProgram, 'u_dt')
    const separationLoc = this.gl.getUniformLocation(this.computeProgram, 'u_separation')
    const alignmentLoc = this.gl.getUniformLocation(this.computeProgram, 'u_alignment')
    const cohesionLoc = this.gl.getUniformLocation(this.computeProgram, 'u_cohesion')
    const maxSpeedLoc = this.gl.getUniformLocation(this.computeProgram, 'u_maxSpeed')
    const maxForceLoc = this.gl.getUniformLocation(this.computeProgram, 'u_maxForce')
    const numBoidsLoc = this.gl.getUniformLocation(this.computeProgram, 'u_numBoids')
    
    if (resolutionLoc) this.gl.uniform2f(resolutionLoc, resolution[0], resolution[1])
    if (dtLoc) this.gl.uniform1f(dtLoc, dt)
    if (separationLoc) this.gl.uniform1f(separationLoc, 1.5)
    if (alignmentLoc) this.gl.uniform1f(alignmentLoc, 1.0)
    if (cohesionLoc) this.gl.uniform1f(cohesionLoc, 1.0)
    if (maxSpeedLoc) this.gl.uniform1f(maxSpeedLoc, 2.0)
    if (maxForceLoc) this.gl.uniform1f(maxForceLoc, 0.05)
    if (numBoidsLoc) this.gl.uniform1i(numBoidsLoc, this.numBoids)
    
    // Bind boids texture
    const texture = this.currentTexture === 0 ? this.boidsTextureA : this.boidsTextureB
    if (texture) {
      this.gl.activeTexture(this.gl.TEXTURE0)
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
      const textureLoc = this.gl.getUniformLocation(this.computeProgram, 'u_boidsTexture')
      if (textureLoc) this.gl.uniform1i(textureLoc, 0)
    }
    
    // Set up input buffers
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.positions.subarray(0, this.numBoids * 2), this.gl.DYNAMIC_DRAW)
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.velocities.subarray(0, this.numBoids * 2), this.gl.DYNAMIC_DRAW)
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.typeBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.types.subarray(0, this.numBoids), this.gl.DYNAMIC_DRAW)
    
    // Set up output buffers
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.outputPositionBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.numBoids * 2 * 4, this.gl.DYNAMIC_DRAW)
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.outputVelocityBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.numBoids * 2 * 4, this.gl.DYNAMIC_DRAW)
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.outputTypeBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.numBoids * 4, this.gl.DYNAMIC_DRAW)
    
    // Set up transform feedback
    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, this.transformFeedback)
    this.gl.bindBufferBase(this.gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.outputPositionBuffer)
    this.gl.bindBufferBase(this.gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.outputVelocityBuffer)
    this.gl.bindBufferBase(this.gl.TRANSFORM_FEEDBACK_BUFFER, 2, this.outputTypeBuffer)
    
    // Set up vertex attributes
    const positionLoc = this.gl.getAttribLocation(this.computeProgram, 'a_position')
    const velocityLoc = this.gl.getAttribLocation(this.computeProgram, 'a_velocity')
    const typeLoc = this.gl.getAttribLocation(this.computeProgram, 'a_type')
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    if (positionLoc >= 0) {
      this.gl.enableVertexAttribArray(positionLoc)
      this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 0, 0)
    }
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.velocityBuffer)
    if (velocityLoc >= 0) {
      this.gl.enableVertexAttribArray(velocityLoc)
      this.gl.vertexAttribPointer(velocityLoc, 2, this.gl.FLOAT, false, 0, 0)
    }
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.typeBuffer)
    if (typeLoc >= 0) {
      this.gl.enableVertexAttribArray(typeLoc)
      this.gl.vertexAttribPointer(typeLoc, 1, this.gl.FLOAT, false, 0, 0)
    }
    
    // Enable rasterizer discard for transform feedback
    this.gl.enable(this.gl.RASTERIZER_DISCARD)
    
    // Begin transform feedback
    this.gl.beginTransformFeedback(this.gl.POINTS)
    
    // Draw points (one per boid)
    this.gl.drawArrays(this.gl.POINTS, 0, this.numBoids)
    
    // End transform feedback
    this.gl.endTransformFeedback()
    this.gl.disable(this.gl.RASTERIZER_DISCARD)
    
    // Read back results
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.outputPositionBuffer)
    const newPositions = new Float32Array(this.numBoids * 2)
    this.gl.getBufferSubData(this.gl.ARRAY_BUFFER, 0, newPositions)
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.outputVelocityBuffer)
    const newVelocities = new Float32Array(this.numBoids * 2)
    this.gl.getBufferSubData(this.gl.ARRAY_BUFFER, 0, newVelocities)
    
    // Update arrays
    this.positions.set(newPositions)
    this.velocities.set(newVelocities)
    
    // Swap textures
    this.currentTexture = 1 - this.currentTexture
    
    // Cleanup
    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, null)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
  }
  
  getPositions(): Float32Array {
    return this.positions.subarray(0, this.numBoids * 2)
  }
  
  getVelocities(): Float32Array {
    return this.velocities.subarray(0, this.numBoids * 2)
  }
  
  cleanup(): void {
    if (!this.gl) return
    
    if (this.computeProgram) {
      this.gl.deleteProgram(this.computeProgram)
      this.computeProgram = null
    }
    
    if (this.positionBuffer) {
      this.gl.deleteBuffer(this.positionBuffer)
      this.positionBuffer = null
    }
    
    if (this.velocityBuffer) {
      this.gl.deleteBuffer(this.velocityBuffer)
      this.velocityBuffer = null
    }
    
    if (this.typeBuffer) {
      this.gl.deleteBuffer(this.typeBuffer)
      this.typeBuffer = null
    }
    
    if (this.outputPositionBuffer) {
      this.gl.deleteBuffer(this.outputPositionBuffer)
      this.outputPositionBuffer = null
    }
    
    if (this.outputVelocityBuffer) {
      this.gl.deleteBuffer(this.outputVelocityBuffer)
      this.outputVelocityBuffer = null
    }
    
    if (this.outputTypeBuffer) {
      this.gl.deleteBuffer(this.outputTypeBuffer)
      this.outputTypeBuffer = null
    }
    
    if (this.transformFeedback) {
      this.gl.deleteTransformFeedback(this.transformFeedback)
      this.transformFeedback = null
    }
    
    if (this.boidsTextureA) {
      this.gl.deleteTexture(this.boidsTextureA)
      this.boidsTextureA = null
    }
    
    if (this.boidsTextureB) {
      this.gl.deleteTexture(this.boidsTextureB)
      this.boidsTextureB = null
    }
  }
}

