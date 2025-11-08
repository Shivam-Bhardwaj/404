// Post-Processing Effects: HDR Bloom and Chromatic Aberration
import { WebGLRenderer } from '../rendering/webgl-renderer'

export const gaussianBlurFragment = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_direction; // blur direction (1,0) or (0,1)
uniform float u_radius;

in vec2 v_texcoord;
out vec4 fragColor;

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  vec4 color = vec4(0.0);
  float totalWeight = 0.0;
  
  // Gaussian blur kernel
  for (float i = -u_radius; i <= u_radius; i++) {
    float weight = exp(-0.5 * (i * i) / (u_radius * u_radius));
    vec2 offset = u_direction * texelSize * i;
    color += texture(u_texture, v_texcoord + offset) * weight;
    totalWeight += weight;
  }
  
  fragColor = color / totalWeight;
}
`

export const bloomFragment = `#version 300 es
precision highp float;

uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_intensity;
uniform float u_threshold;

in vec2 v_texcoord;
out vec4 fragColor;

void main() {
  vec4 sceneColor = texture(u_scene, v_texcoord);
  vec4 bloomColor = texture(u_bloom, v_texcoord);
  
  // Extract bright areas
  float brightness = dot(sceneColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec4 brightColor = brightness > u_threshold ? sceneColor : vec4(0.0);
  
  // Combine scene and bloom
  fragColor = sceneColor + bloomColor * u_intensity;
}
`

export const chromaticAberrationFragment = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_strength;
uniform vec2 u_offset;

in vec2 v_texcoord;
out vec4 fragColor;

void main() {
  vec2 uv = v_texcoord;
  vec2 center = vec2(0.5);
  vec2 dist = uv - center;
  
  // Chromatic aberration - separate RGB channels
  float r = texture(u_texture, uv + dist * u_offset * u_strength).r;
  float g = texture(u_texture, uv).g;
  float b = texture(u_texture, uv - dist * u_offset * u_strength).b;
  
  fragColor = vec4(r, g, b, 1.0);
}
`

export class PostProcessor {
  private renderer: WebGLRenderer
  private sceneTexture: any = null
  private bloomTexture: any = null
  private tempTexture: any = null
  private sceneFramebuffer: any = null
  private bloomFramebuffer: any = null
  private tempFramebuffer: any = null
  
  private bloomIntensity = 0.5
  private bloomThreshold = 0.7
  private chromaticStrength = 0.0
  
  constructor(renderer: WebGLRenderer) {
    this.renderer = renderer
    this.setup()
  }
  
  private setup(): void {
    const gl = this.renderer.getContext()
    if (!gl) return
    
    const width = gl.canvas.width
    const height = gl.canvas.height
    
    // Create textures
    this.sceneTexture = this.renderer.createTexture(width, height)
    this.bloomTexture = this.renderer.createTexture(width, height)
    this.tempTexture = this.renderer.createTexture(width, height)
    
    // Create framebuffers
    if (this.sceneTexture) {
      this.sceneFramebuffer = this.renderer.createFramebuffer(this.sceneTexture, 'scene')
    }
    if (this.bloomTexture) {
      this.bloomFramebuffer = this.renderer.createFramebuffer(this.bloomTexture, 'bloom')
    }
    if (this.tempTexture) {
      this.tempFramebuffer = this.renderer.createFramebuffer(this.tempTexture, 'temp')
    }
    
    // Compile shaders
    const { fullScreenQuadVertex } = require('../shaders/reaction-diffusion')
    
    this.renderer.createProgram(fullScreenQuadVertex, gaussianBlurFragment, 'gaussianBlur')
    this.renderer.createProgram(fullScreenQuadVertex, bloomFragment, 'bloom')
    this.renderer.createProgram(fullScreenQuadVertex, chromaticAberrationFragment, 'chromaticAberration')
  }
  
  beginScene(): void {
    if (this.sceneFramebuffer) {
      this.renderer.bindFramebuffer('scene')
      this.renderer.clear(0, 0, 0, 1)
    }
  }
  
  endScene(): void {
    // Render bloom effect
    if (this.bloomTexture && this.sceneTexture) {
      this.renderBloom()
    }
    
    // Render final composite
    this.renderer.bindFramebuffer(null)
    this.renderComposite()
  }
  
  private renderBloom(): void {
    if (!this.bloomTexture || !this.tempTexture) return
    
    const gl = this.renderer.getContext()
    if (!gl) return
    
    // Horizontal blur
    this.renderer.bindFramebuffer('temp')
    this.renderer.useProgram('gaussianBlur')
    this.renderer.setUniform('gaussianBlur', 'u_texture', 'sampler2D', 0)
    this.renderer.setUniform('gaussianBlur', 'u_resolution', 'vec2', [gl.canvas.width, gl.canvas.height])
    this.renderer.setUniform('gaussianBlur', 'u_direction', 'vec2', [1, 0])
    this.renderer.setUniform('gaussianBlur', 'u_radius', 'float', 5.0)
    this.renderer.bindTexture(this.bloomTexture, 0)
    this.renderer.renderFullScreenQuad()
    
    // Vertical blur
    this.renderer.bindFramebuffer('bloom')
    this.renderer.setUniform('gaussianBlur', 'u_direction', 'vec2', [0, 1])
    this.renderer.bindTexture(this.tempTexture, 0)
    this.renderer.renderFullScreenQuad()
  }
  
  private renderComposite(): void {
    const gl = this.renderer.getContext()
    if (!gl || !this.sceneTexture || !this.bloomTexture) return
    
    // Apply chromatic aberration if enabled
    if (this.chromaticStrength > 0) {
      this.renderer.useProgram('chromaticAberration')
      this.renderer.setUniform('chromaticAberration', 'u_texture', 'sampler2D', 0)
      this.renderer.setUniform('chromaticAberration', 'u_resolution', 'vec2', [gl.canvas.width, gl.canvas.height])
      this.renderer.setUniform('chromaticAberration', 'u_strength', 'float', this.chromaticStrength)
      this.renderer.setUniform('chromaticAberration', 'u_offset', 'vec2', [0.02, 0.0])
      this.renderer.bindTexture(this.sceneTexture, 0)
      this.renderer.renderFullScreenQuad()
    } else {
      // Render bloom composite
      this.renderer.useProgram('bloom')
      this.renderer.setUniform('bloom', 'u_scene', 'sampler2D', 0)
      this.renderer.setUniform('bloom', 'u_bloom', 'sampler2D', 1)
      this.renderer.setUniform('bloom', 'u_intensity', 'float', this.bloomIntensity)
      this.renderer.setUniform('bloom', 'u_threshold', 'float', this.bloomThreshold)
      this.renderer.bindTexture(this.sceneTexture, 0)
      this.renderer.bindTexture(this.bloomTexture, 1)
      this.renderer.renderFullScreenQuad()
    }
  }
  
  setBloomIntensity(intensity: number): void {
    this.bloomIntensity = Math.max(0, Math.min(2, intensity))
  }
  
  setChromaticStrength(strength: number): void {
    this.chromaticStrength = Math.max(0, Math.min(1, strength))
  }
  
  resize(width: number, height: number): void {
    // Recreate textures with new size
    this.setup()
  }
  
  cleanup(): void {
    // Cleanup handled by renderer
  }
}

