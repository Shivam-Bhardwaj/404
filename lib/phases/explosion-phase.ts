// Particle Explosion with SPH Physics
import { fetchSphSimulation } from '@/lib/api/physics'
import { AnimationPhase } from '../types'
import { SPHSimulation } from '../physics/sph'
import { COLORS } from '../constants'
import { randomRange, curlNoise, lerp } from '../utils/math'
import { WebGLRenderer } from '../rendering/webgl-renderer'
import { GPUParticleRenderer } from '../rendering/particle-gpu-renderer'
import { SharedWebGLContext } from '../rendering/shared-webgl-context'

interface RemoteParticleState {
  x: number
  y: number
  vx: number
  vy: number
  color: string
}

export class ExplosionPhase implements AnimationPhase {
  name: 'explosion' = 'explosion'
  duration = 2000
  progress = 0
  isComplete = false
  
  private sph: SPHSimulation
  private centerX = 0
  private centerY = 0
  private time = 0
  private width: number
  private height: number
  
  private remoteEnabled = true
  private remoteState: RemoteParticleState[] = []
  private remoteTargetState: RemoteParticleState[] | null = null
  private remoteProgress = 1
  private remoteFetchPending = false
  private remoteLastSample = 0
  private remoteFailures = 0
  private readonly remoteBlendDuration = 250
  private readonly remotePalette = [
    COLORS.error,
    COLORS.warning,
    COLORS.success,
    COLORS.info,
    COLORS.corrupt,
  ]
  
  // GPU rendering
  private webglRenderer: WebGLRenderer | null = null
  private gpuParticleRenderer: GPUParticleRenderer | null = null
  private useGPU = false
  
  constructor(width: number, height: number, canvas?: HTMLCanvasElement) {
    this.sph = new SPHSimulation(width, height)
    this.centerX = width / 2
    this.centerY = height / 2
    this.width = width
    this.height = height
    
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
    this.remoteState = []
    this.remoteTargetState = null
    this.remoteProgress = 1
    this.remoteLastSample = 0
    this.remoteFailures = 0
    this.remoteEnabled = true
    
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

    this.scheduleRemoteFetch(true)
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    this.time += dt * 0.001
    
    if (this.remoteEnabled && (this.remoteState.length > 0 || this.remoteFetchPending)) {
      this.updateRemoteParticles(dt)
    } else {
      this.updateLocalParticles(dt)
    }
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }

  private updateLocalParticles(dt: number): void {
    for (const p of this.sph.particles) {
      const [cx, cy] = curlNoise(p.x * 0.01, p.y * 0.01, this.time)
      p.vx += cx * 0.5
      p.vy += cy * 0.5
      p.life = 1 - this.progress
    }
    
    this.sph.update(dt * 0.016)
  }

  private updateRemoteParticles(dt: number): void {
    if (this.remoteTargetState && this.remoteState.length > 0) {
      this.remoteProgress = Math.min(
        1,
        this.remoteProgress + dt / this.remoteBlendDuration
      )
      const interpolated = this.interpolateRemoteState(
        this.remoteState,
        this.remoteTargetState,
        this.remoteProgress
      )
      this.applyRemoteSamples(interpolated)
      
      if (this.remoteProgress >= 1) {
        this.remoteState = this.remoteTargetState
        this.remoteTargetState = null
        this.remoteLastSample = this.now()
        this.scheduleRemoteFetch()
      }
      return
    }
    
    if (this.remoteState.length > 0) {
      this.applyRemoteSamples(this.remoteState)
      const now = this.now()
      if (!this.remoteFetchPending && now - this.remoteLastSample > this.remoteBlendDuration) {
        this.scheduleRemoteFetch()
      }
      return
    }
    
    if (!this.remoteFetchPending) {
      this.scheduleRemoteFetch(true)
    }
  }

  private applyRemoteSamples(samples: RemoteParticleState[]): void {
    if (!samples.length) return
    
    if (this.sph.particles.length !== samples.length) {
      this.sph.particles = samples.map((sample, index) => ({
        x: sample.x,
        y: sample.y,
        vx: sample.vx,
        vy: sample.vy,
        ax: 0,
        ay: 0,
        radius: 2,
        mass: 1,
        color: sample.color ?? this.remotePalette[index % this.remotePalette.length],
        life: 1 - this.progress,
        maxLife: 1,
        density: 0,
        pressure: 0,
        viscosity: 0.1,
      }))
      return
    }
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]
      const particle = this.sph.particles[i]
      particle.x = sample.x
      particle.y = sample.y
      particle.vx = sample.vx
      particle.vy = sample.vy
      particle.color = sample.color ?? particle.color
      particle.life = 1 - this.progress
    }
  }

  private interpolateRemoteState(
    from: RemoteParticleState[],
    to: RemoteParticleState[],
    t: number
  ): RemoteParticleState[] {
    const length = Math.min(from.length, to.length)
    const result: RemoteParticleState[] = []
    
    for (let i = 0; i < length; i++) {
      result.push({
        x: lerp(from[i].x, to[i].x, t),
        y: lerp(from[i].y, to[i].y, t),
        vx: lerp(from[i].vx, to[i].vx, t),
        vy: lerp(from[i].vy, to[i].vy, t),
        color: to[i].color ?? from[i].color,
      })
    }
    
    return result
  }

  private scheduleRemoteFetch(prime = false): void {
    if (this.remoteFetchPending || !this.remoteEnabled) return
    this.remoteFetchPending = true
    this.fetchRemoteState(prime)
      .catch((error) => {
        console.warn('Remote SPH request failed', error)
      })
      .finally(() => {
        this.remoteFetchPending = false
      })
  }

  private async fetchRemoteState(prime: boolean): Promise<void> {
    try {
      const data = await fetchSphSimulation({ steps: prime ? 12 : 6 })
      const samples = this.transformRemoteParticles(data)
      if (!samples.length) {
        throw new Error('Empty SPH payload')
      }
      
      if (prime || this.remoteState.length === 0) {
        this.remoteState = samples
        this.applyRemoteSamples(samples)
        this.remoteLastSample = this.now()
      } else {
        this.remoteTargetState = samples
        this.remoteProgress = 0
      }
      
      this.remoteFailures = 0
      this.remoteEnabled = true
    } catch (error) {
      this.remoteFailures++
      if (this.remoteFailures >= 3) {
        this.remoteEnabled = false
        this.remoteState = []
        this.remoteTargetState = null
      }
      throw error
    }
  }

  private transformRemoteParticles(data: number[]): RemoteParticleState[] {
    const result: RemoteParticleState[] = []
    const palette = this.remotePalette
    const width = this.width
    const height = this.height
    
    for (let i = 0; i + 3 < data.length; i += 4) {
      const index = i / 4
      result.push({
        x: data[i] * width,
        y: data[i + 1] * height,
        vx: data[i + 2] * width,
        vy: data[i + 3] * height,
        color: palette[index % palette.length],
      })
    }
    
    return result
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
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
    this.remoteState = []
    this.remoteTargetState = null
    this.remoteFetchPending = false
  }
}
