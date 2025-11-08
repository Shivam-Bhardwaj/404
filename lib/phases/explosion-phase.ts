// Particle Explosion with SPH Physics
import { AnimationPhase } from '../types'
import { SPHSimulation } from '../physics/sph'
import { COLORS } from '../constants'
import { randomRange, curlNoise } from '../utils/math'
import { WebGLRenderer } from '../rendering/webgl-renderer'
import { GPUParticleRenderer } from '../rendering/particle-gpu-renderer'
import { SharedWebGLContext } from '../rendering/shared-webgl-context'

export class ExplosionPhase implements AnimationPhase {
  name: 'explosion' = 'explosion'
  duration = 2000
  progress = 0
  isComplete = false
  
  private sph: SPHSimulation
  private centerX = 0
  private centerY = 0
  private time = 0
  
  // GPU rendering
  private webglRenderer: WebGLRenderer | null = null
  private gpuParticleRenderer: GPUParticleRenderer | null = null
  private useGPU = false
  
  constructor(width: number, height: number, canvas?: HTMLCanvasElement) {
    this.sph = new SPHSimulation(width, height)
    this.centerX = width / 2
    this.centerY = height / 2
    
    // Try to initialize GPU rendering using shared context
    if (canvas) {
      try {
        const sharedContext = SharedWebGLContext.getInstance()
        
        // Try to get existing renderer or create new one
        if (sharedContext.isInitialized()) {
          this.webglRenderer = sharedContext.getRenderer()
          if (this.webglRenderer && this.webglRenderer.isWebGLSupported()) {
            this.useGPU = true
            this.gpuParticleRenderer = new GPUParticleRenderer(this.webglRenderer, 1000)
          }
        } else {
          // Create new renderer and register it
          this.webglRenderer = new WebGLRenderer(canvas)
          if (this.webglRenderer.isWebGLSupported()) {
            sharedContext.initialize(canvas, this.webglRenderer)
            this.useGPU = true
            this.gpuParticleRenderer = new GPUParticleRenderer(this.webglRenderer, 1000)
          }
        }
      } catch (e) {
        console.warn('GPU particle rendering not available:', e)
      }
    }
  }
  
  init(): void {
    // Clear existing particles before creating new ones
    this.sph.particles = []
    this.progress = 0
    this.isComplete = false
    this.time = 0
    
    // Create explosion particles in a circle
    const particleCount = 500
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2
      const speed = randomRange(5, 20)
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      
      this.sph.addParticle(this.centerX, this.centerY, vx, vy)
      
      // Assign colors
      const colors = [COLORS.error, COLORS.warning, COLORS.success, COLORS.info, COLORS.corrupt]
      this.sph.particles[i].color = colors[i % colors.length]
    }
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    this.time += dt * 0.001
    
    // Add curl noise to particles for organic movement
    for (const p of this.sph.particles) {
      const [cx, cy] = curlNoise(p.x * 0.01, p.y * 0.01, this.time)
      p.vx += cx * 0.5
      p.vy += cy * 0.5
      
      // Fade out
      p.life = 1 - this.progress
    }
    
    this.sph.update(dt * 0.016) // Convert to seconds
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    // Use GPU rendering if available
    if (this.useGPU && this.gpuParticleRenderer && this.webglRenderer) {
      this.renderGPU(ctx.canvas)
      return
    }
    
    // Fallback to Canvas 2D
    this.renderCanvas2D(ctx)
  }
  
  private renderGPU(canvas: HTMLCanvasElement): void {
    if (!this.gpuParticleRenderer || !this.webglRenderer) return
    
    const gl = this.webglRenderer.getContext()
    if (!gl) return
    
    // Clear background
    this.webglRenderer.clear(0, 0, 0, 1)
    
    // Update particle data on GPU
    this.gpuParticleRenderer.updateParticles(this.sph.particles)
    
    // Render particles
    this.gpuParticleRenderer.render(canvas.width, canvas.height)
  }
  
  private renderCanvas2D(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Draw particles with trails
    for (const p of this.sph.particles) {
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 10
      
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
      
      // Motion blur trail
      ctx.globalAlpha = p.life * 0.3
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.radius
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2)
      ctx.stroke()
    }
    
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  
  cleanup(): void {
    // Clear all particles to prevent memory leaks
    this.sph.particles = []
    // Clear spatial grid
    if (this.sph['grid']) {
      this.sph['grid'].clear()
    }
    
    // Cleanup GPU resources
    if (this.gpuParticleRenderer) {
      this.gpuParticleRenderer.cleanup()
      this.gpuParticleRenderer = null
    }
    
    this.progress = 0
    this.isComplete = false
    this.time = 0
  }
}

