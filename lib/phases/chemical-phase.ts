// Chemical Transformation Phase - Gray-Scott Reaction-Diffusion
import { AnimationPhase } from '../types'
import { COLORS } from '../constants'
import { WebGLRenderer } from '../rendering/webgl-renderer'
import { SharedWebGLContext } from '../rendering/shared-webgl-context'
import { fullScreenQuadVertex, reactionDiffusionFragment, renderFragment } from '../shaders/reaction-diffusion'

export class ChemicalPhase implements AnimationPhase {
  name: 'chemical' = 'chemical'
  duration = 5000 // 5 seconds
  progress = 0
  isComplete = false
  
  private webglRenderer: WebGLRenderer | null = null
  private canvas2D: CanvasRenderingContext2D | null = null
  private useWebGL = false
  
  // Gray-Scott parameters
  private du = 0.16  // Diffusion rate for u
  private dv = 0.08  // Diffusion rate for v
  private f = 0.055  // Feed rate
  private k = 0.062  // Kill rate
  private dt = 0.1   // Time step
  
  // Textures for ping-pong buffering
  private textureA: any = null
  private textureB: any = null
  private framebufferA: any = null
  private framebufferB: any = null
  private currentTexture = 0
  
  // Initial text pattern
  private initialText = '404'
  private targetText = 'ERROR'
  private time = 0
  
  constructor(canvas: HTMLCanvasElement) {
    // Try to initialize WebGL using shared context
    try {
      const sharedContext = SharedWebGLContext.getInstance()
      
      // Try to get existing renderer or create new one
      if (sharedContext.isInitialized()) {
        this.webglRenderer = sharedContext.getRenderer()
        if (this.webglRenderer && this.webglRenderer.isWebGLSupported()) {
          this.useWebGL = true
          this.setupWebGL()
        } else {
          this.canvas2D = canvas.getContext('2d')
        }
      } else {
        // Create new renderer and register it
        this.webglRenderer = new WebGLRenderer(canvas)
        if (this.webglRenderer.isWebGLSupported()) {
          sharedContext.initialize(canvas, this.webglRenderer)
          this.useWebGL = true
          this.setupWebGL()
        } else {
          this.canvas2D = canvas.getContext('2d')
        }
      }
    } catch (e) {
      console.warn('WebGL initialization failed, using Canvas 2D fallback:', e)
      this.canvas2D = canvas.getContext('2d')
    }
  }
  
  private setupWebGL(): void {
    if (!this.webglRenderer) return
    
    const gl = this.webglRenderer.getContext()
    if (!gl) return
    
    const width = gl.canvas.width
    const height = gl.canvas.height
    
    // Create textures for ping-pong buffering
    this.textureA = this.webglRenderer.createTexture(width, height)
    this.textureB = this.webglRenderer.createTexture(width, height)
    
    if (this.textureA && this.textureB) {
      this.framebufferA = this.webglRenderer.createFramebuffer(this.textureA, 'bufferA')
      this.framebufferB = this.webglRenderer.createFramebuffer(this.textureB, 'bufferB')
      
      // Initialize texture A with text pattern
      this.initializeTexture(this.textureA, width, height)
      
      // Compile shaders
      this.webglRenderer.createProgram(
        fullScreenQuadVertex,
        reactionDiffusionFragment,
        'reactionDiffusion'
      )
      
      this.webglRenderer.createProgram(
        fullScreenQuadVertex,
        renderFragment,
        'render'
      )
    }
  }
  
  private initializeTexture(texture: WebGLTexture, width: number, height: number): void {
    if (!this.webglRenderer) return
    
    const gl = this.webglRenderer.getContext()
    if (!gl) return
    
    // Create initial pattern with text
    const imageData = new Uint8Array(width * height * 4)
    
    // Draw text pattern (u=1.0, v=0.0 for background, v=1.0 for text)
    const centerX = width / 2
    const centerY = height / 2
    const fontSize = Math.min(width, height) * 0.2
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        
        // Distance from center
        const dx = x - centerX
        const dy = y - centerY
        const dist = Math.sqrt(dx * dx + dy * dy)
        
        // Initial state: u=1.0 (substrate), v=0.0 (catalyst)
        let u = 1.0
        let v = 0.0
        
        // Add initial seed pattern (circular or text-based)
        if (dist < fontSize * 0.3) {
          // Seed catalyst in center
          v = 0.5 + Math.random() * 0.3
          u = 0.5
        }
        
        // Add some noise
        v += (Math.random() - 0.5) * 0.1
        
        imageData[idx] = Math.floor(u * 255)     // R = u
        imageData[idx + 1] = Math.floor(v * 255) // G = v
        imageData[idx + 2] = 0                   // B
        imageData[idx + 3] = 255                 // A
      }
    }
    
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData)
  }
  
  init(): void {
    this.progress = 0
    this.isComplete = false
    this.time = 0
    
    if (this.useWebGL && this.webglRenderer) {
      const gl = this.webglRenderer.getContext()
      if (gl && this.textureA) {
        this.initializeTexture(this.textureA, gl.canvas.width, gl.canvas.height)
        this.currentTexture = 0
      }
    }
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    this.time += dt * 0.001
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    if (this.useWebGL && this.webglRenderer) {
      this.renderWebGL(ctx.canvas)
    } else {
      this.renderCanvas2D(ctx)
    }
  }
  
  private renderWebGL(canvas: HTMLCanvasElement): void {
    if (!this.webglRenderer) return
    
    const gl = this.webglRenderer.getContext()
    if (!gl || !this.textureA || !this.textureB) return
    
    const width = gl.canvas.width
    const height = gl.canvas.height
    
    // Update reaction-diffusion simulation
    for (let i = 0; i < 10; i++) { // Multiple iterations per frame
      const sourceTexture = this.currentTexture === 0 ? this.textureA : this.textureB
      const targetFramebuffer = this.currentTexture === 0 ? this.framebufferB : this.framebufferA
      
      if (!targetFramebuffer) continue
      
      // Bind target framebuffer
      this.webglRenderer.bindFramebuffer(targetFramebuffer === this.framebufferA ? 'bufferA' : 'bufferB')
      
      // Use reaction-diffusion shader
      this.webglRenderer.useProgram('reactionDiffusion')
      
      // Set uniforms
      this.webglRenderer.setUniform('reactionDiffusion', 'u_resolution', 'vec2', [width, height])
      this.webglRenderer.setUniform('reactionDiffusion', 'u_dt', 'float', this.dt)
      this.webglRenderer.setUniform('reactionDiffusion', 'u_du', 'float', this.du)
      this.webglRenderer.setUniform('reactionDiffusion', 'u_dv', 'float', this.dv)
      this.webglRenderer.setUniform('reactionDiffusion', 'u_f', 'float', this.f)
      this.webglRenderer.setUniform('reactionDiffusion', 'u_k', 'float', this.k)
      
      // Bind source texture
      this.webglRenderer.bindTexture(sourceTexture, 0)
      this.webglRenderer.setUniform('reactionDiffusion', 'u_texture', 'sampler2D', 0)
      
      // Render
      this.webglRenderer.renderFullScreenQuad()
      
      // Swap buffers
      this.currentTexture = 1 - this.currentTexture
    }
    
    // Render to screen
    this.webglRenderer.bindFramebuffer(null)
    this.webglRenderer.useProgram('render')
    
    const displayTexture = this.currentTexture === 0 ? this.textureB : this.textureA
    this.webglRenderer.bindTexture(displayTexture, 0)
    this.webglRenderer.setUniform('render', 'u_texture', 'sampler2D', 0)
    this.webglRenderer.setUniform('render', 'u_intensity', 'float', 1.0)
    
    this.webglRenderer.renderFullScreenQuad()
  }
  
  private renderCanvas2D(ctx: CanvasRenderingContext2D): void {
    // Fallback Canvas 2D rendering
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Simple visualization
    ctx.fillStyle = COLORS.warning
    ctx.font = '48px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    const text = this.progress < 0.5 ? this.initialText : this.targetText
    const alpha = Math.sin(this.time * 2) * 0.3 + 0.7
    ctx.globalAlpha = alpha
    
    ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2)
    ctx.globalAlpha = 1.0
  }
  
  cleanup(): void {
    this.progress = 0
    this.isComplete = false
    this.time = 0
    
    // Cleanup WebGL resources
    if (this.webglRenderer && this.useWebGL) {
      const gl = this.webglRenderer.getContext()
      if (gl) {
        // Delete textures
        if (this.textureA) {
          gl.deleteTexture(this.textureA)
          this.textureA = null
        }
        if (this.textureB) {
          gl.deleteTexture(this.textureB)
          this.textureB = null
        }
        
        // Delete framebuffers
        if (this.framebufferA) {
          gl.deleteFramebuffer(this.framebufferA)
          this.framebufferA = null
        }
        if (this.framebufferB) {
          gl.deleteFramebuffer(this.framebufferB)
          this.framebufferB = null
        }
      }
    }
  }
}

