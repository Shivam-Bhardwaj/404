// Biological Ecosystem with Genetic Evolution
import { SimulationStream, StreamedBoidState } from '@/lib/api/streaming'
import { AnimationPhase, Organism } from '../types'
import { BoidsSystem } from '../biology/boids'
import { COLORS } from '../constants'
import { SimulationSourceTracker, SimulationSourceDetails } from '../telemetry/simulation-source'

export class EcosystemPhase implements AnimationPhase {
  name: 'ecosystem' = 'ecosystem'
  // Keep the ecosystem visible much longer; don't auto-complete
  duration = 180000 // 3 minutes
  progress = 0
  isComplete = false
  
  private boids: BoidsSystem
  private width: number
  private height: number
  private renderOrganisms: Organism[] = []
  
  private stream: SimulationStream | null = null
  private streamedOrganisms: Organism[] = []
  private latestStats: { total: number; predators: number; prey: number; producers: number; avgEnergy: number } | null = null
  private sourceTracker = SimulationSourceTracker.getInstance()
  private useStreaming = true
  private wsConnected = false
  
  constructor(width: number, height: number) {
    this.boids = new BoidsSystem(width, height)
    this.width = width
    this.height = height
  }
  
  init(): void {
    this.progress = 0
    this.isComplete = false
    this.streamedOrganisms = []
    this.renderOrganisms = []
    
    // Clear existing organisms before spawning new ones
    if (this.boids['organisms']) {
      this.boids['organisms'] = []
    }
    
    // Try to connect to WebSocket stream
    // Don't immediately fall back to local - wait for connection attempt
    if (this.useStreaming) {
      this.connectStream()
      // Don't initialize local organisms here - wait for connection result
      // The connectStream() method will call initLocalOrganisms() if connection fails
    } else {
      // Only init local if streaming is explicitly disabled
      this.initLocalOrganisms()
    }
  }
  
  private initLocalOrganisms(): void {
    // Start with prey and producers
    for (let i = 0; i < 20; i++) {
      this.boids.addOrganism(
        Math.random() * this.boids['width'],
        Math.random() * this.boids['height'],
        'prey'
      )
    }
    
    for (let i = 0; i < 30; i++) {
      this.boids.addOrganism(
        Math.random() * this.boids['width'],
        Math.random() * this.boids['height'],
        'producer'
      )
    }
    
    // Add a few predators
    for (let i = 0; i < 5; i++) {
      this.boids.addOrganism(
        Math.random() * this.boids['width'],
        Math.random() * this.boids['height'],
        'predator'
      )
    }
    
    this.renderOrganisms = this.boids.organisms
  }
  
  private connectStream(): void {
    try {
      const stream = new SimulationStream()
      
      stream.onState((states: StreamedBoidState[]) => {
        this.handleStreamedState(states)
      })
      
      stream.onError((error: Error) => {
        console.warn('WebSocket stream error:', error)
        this.wsConnected = false
        this.useStreaming = false
        this.reportSource('local', {
          accelerator: 'cpu',
        })
        if (this.renderOrganisms.length === 0) {
          this.initLocalOrganisms()
        }
      })
      
      stream.onConnectionStatus((connected: boolean) => {
        this.wsConnected = connected
        if (!connected && this.useStreaming) {
          console.warn('WebSocket disconnected, falling back to local simulation')
          this.reportSource('local', {
            accelerator: 'cpu',
          })
        }
      })
      
      stream.connect().then(() => {
        this.stream = stream
        this.wsConnected = true
        this.reportSource('server', {
          accelerator: 'cuda',
          sampleSize: 0, // Will be updated when first state arrives
        })
      }).catch((error) => {
        console.warn('Failed to connect WebSocket stream:', error)
        this.wsConnected = false
        this.useStreaming = false
        this.reportSource('local', {
          accelerator: 'cpu',
        })
        this.initLocalOrganisms()
      })
    } catch (error) {
      console.warn('Failed to create WebSocket stream:', error)
      this.useStreaming = false
      this.initLocalOrganisms()
    }
  }
  
  private handleStreamedState(states: StreamedBoidState[]): void {
    // Ensure we have enough organisms
    while (this.streamedOrganisms.length < states.length) {
      const index = this.streamedOrganisms.length
      this.streamedOrganisms.push(this.createOrganismFromState(states[index] || { x: 0, y: 0, vx: 0, vy: 0, timestamp: 0 }, index))
    }
    
    // Update organisms from streamed state
    for (let i = 0; i < states.length && i < this.streamedOrganisms.length; i++) {
      const state = states[i]
      const org = this.streamedOrganisms[i]
      
      // Scale coordinates from normalized [0,1] to canvas size
      org.x = state.x * this.width
      org.y = state.y * this.height
      org.vx = state.vx * this.width
      org.vy = state.vy * this.height
      
      // Update energy based on velocity
      const speed = Math.hypot(org.vx, org.vy)
      org.energy = Math.max(10, Math.min(org.maxEnergy, org.energy * 0.98 + speed * 0.1))
      
      // Update trail
      org.trail.push({ x: org.x, y: org.y })
      if (org.trail.length > 20) {
        org.trail.shift()
      }
      
      org.age = (org.age + 1) % org.maxAge
    }
    
    // Remove excess organisms if stream sent fewer
    if (this.streamedOrganisms.length > states.length) {
      this.streamedOrganisms = this.streamedOrganisms.slice(0, states.length)
    }
    
    this.renderOrganisms = this.streamedOrganisms
    
    this.reportSource('server', {
      sampleSize: states.length,
    })
  }
  
  private createOrganismFromState(state: StreamedBoidState, index: number): Organism {
    const type = this.boidTypeForIndex(index)
    return {
      id: `stream-${index}`,
      x: state.x * this.width,
      y: state.y * this.height,
      vx: state.vx * this.width,
      vy: state.vy * this.height,
      ax: 0,
      ay: 0,
      radius: type === 'predator' ? 5 : type === 'prey' ? 3 : 2.5,
      mass: 1,
      color: this.colorForType(type),
      life: 1,
      maxLife: 1,
      type,
      energy: 60,
      maxEnergy: 120,
      age: 0,
      maxAge: 1200,
      speed: 1,
      vision: 120,
      reproductionCooldown: 0,
      genes: {
        hue: (index * 29) % 360,
        saturation: 0.8,
        brightness: 0.7,
        size: 1,
        speed: 1,
        aggression: type === 'predator' ? 0.8 : 0.3,
        efficiency: 0.6,
      },
      trail: [],
    }
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    
    if (this.useStreaming && this.stream && this.stream.isConnected() && this.wsConnected) {
      // Using WebSocket stream - updates come via callbacks
      // Just ensure renderOrganisms is set
      if (this.renderOrganisms.length === 0 && this.streamedOrganisms.length > 0) {
        this.renderOrganisms = this.streamedOrganisms
      }
    } else {
      // Fallback to local simulation
      if (this.useStreaming && !this.wsConnected) {
        // WebSocket failed, switch to local permanently
        this.useStreaming = false
        this.reportSource('local', {
          accelerator: 'cpu',
        })
      }
      this.updateLocalBoids(dt)
    }
    
    // Do not auto-complete; keep ecosystem running
  }

  private updateLocalBoids(dt: number): void {
    this.boids.update(dt)
    
    const stats = this.boids.getPopulationStats()
    const totalPopulation = stats.prey + stats.producers + stats.predators
    const maxPopulation = 200
    
    if (totalPopulation < maxPopulation) {
      if (stats.prey < 5) {
        for (let i = 0; i < 3; i++) {
          this.boids.addOrganism(
            Math.random() * this.boids['width'],
            Math.random() * this.boids['height'],
            'prey'
          )
        }
      }
      
      if (stats.producers < 10) {
        for (let i = 0; i < 5; i++) {
          this.boids.addOrganism(
            Math.random() * this.boids['width'],
            Math.random() * this.boids['height'],
            'producer'
          )
        }
      }
    }
    
    if (this.boids['organisms']) {
      this.boids['organisms'] = this.boids['organisms'].filter(
        (org) => org.energy > 0 && org.age < org.maxAge
      )
    }
    
    this.renderOrganisms = this.boids.organisms
    this.reportSource('local', {
      sampleSize: this.renderOrganisms.length,
    })
  }

  private boidTypeForIndex(index: number): Organism['type'] {
    if (index % 12 === 0) return 'predator'
    if (index % 5 === 0) return 'producer'
    return 'prey'
  }

  private colorForType(type: Organism['type']): string {
    if (type === 'predator') return COLORS.error
    if (type === 'producer') return COLORS.success
    if (type === 'prey') return COLORS.warning
    return COLORS.info
  }

  private computeStats(organisms: Organism[]) {
    const stats = {
      total: organisms.length,
      predators: 0,
      prey: 0,
      producers: 0,
      decomposers: 0,
      avgEnergy: 0,
    }
    
    for (const org of organisms) {
      if (org.type === 'predator') stats.predators++
      else if (org.type === 'producer') stats.producers++
      else if (org.type === 'prey') stats.prey++
      else stats.decomposers++
      
      stats.avgEnergy += org.energy
    }
    
    if (stats.total > 0) {
      stats.avgEnergy /= stats.total
    }
    
    return stats
  }
  
  private reportSource(mode: 'server' | 'local', details?: SimulationSourceDetails): void {
    this.sourceTracker.update(this.name, mode, details)
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    const organisms = this.renderOrganisms.length
      ? this.renderOrganisms
      : this.boids.organisms
    
    // Draw trails
    for (const org of organisms) {
      if (org.trail.length < 2) continue
      
      ctx.strokeStyle = org.color
      ctx.globalAlpha = 0.3
      ctx.lineWidth = org.radius / 2
      ctx.beginPath()
      ctx.moveTo(org.trail[0].x, org.trail[0].y)
      
      for (let i = 1; i < org.trail.length; i++) {
        ctx.lineTo(org.trail[i].x, org.trail[i].y)
      }
      
      ctx.stroke()
    }
    
    // Draw organisms
    ctx.globalAlpha = 1
    for (const org of organisms) {
      // Main body
      ctx.fillStyle = org.color
      ctx.shadowColor = org.color
      ctx.shadowBlur = 5
      ctx.beginPath()
      ctx.arc(org.x, org.y, org.radius, 0, Math.PI * 2)
      ctx.fill()
      
      // Direction indicator
      const angle = Math.atan2(org.vy, org.vx)
      ctx.strokeStyle = COLORS.white
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(org.x, org.y)
      ctx.lineTo(
        org.x + Math.cos(angle) * org.radius * 2,
        org.y + Math.sin(angle) * org.radius * 2
      )
      ctx.stroke()
      
      // Energy bar
      ctx.globalAlpha = 0.8
      const barWidth = org.radius * 3
      const barHeight = 2
      const barX = org.x - barWidth / 2
      const barY = org.y - org.radius - 5
      
      ctx.fillStyle = COLORS.errorDark
      ctx.fillRect(barX, barY, barWidth, barHeight)
      
      ctx.fillStyle = COLORS.success
      ctx.fillRect(barX, barY, barWidth * (org.energy / org.maxEnergy), barHeight)
    }
    
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    
    // Store stats for external access - don't draw them on canvas anymore
    const stats = this.computeStats(organisms)
    this.latestStats = stats
    // Stats are now displayed in the unified telemetry panel at the bottom of the page
  }

  getStats() {
    return this.latestStats
  }
  
  cleanup(): void {
    // Disconnect WebSocket stream
    if (this.stream) {
      this.stream.disconnect()
      this.stream = null
    }
    
    // Clear all organisms to prevent memory leaks
    this.boids.organisms = []
    this.renderOrganisms = []
    this.streamedOrganisms = []
    
    // Clear trails if they exist
    if (this.boids['organisms']) {
      this.boids['organisms'].forEach((org: any) => {
        if (org.trail) {
          org.trail = []
        }
      })
    }
    
    this.progress = 0
    this.isComplete = false
  }
}
