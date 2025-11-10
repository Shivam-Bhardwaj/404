// Biological Ecosystem with Genetic Evolution
import { fetchBoidsSimulation, runBoidsSimulation } from '@/lib/api/physics'
import { AnimationPhase, Organism } from '../types'
import { BoidsSystem } from '../biology/boids'
import { COLORS } from '../constants'
import { lerp } from '../utils/math'
import { SimulationSourceTracker, SimulationSourceDetails } from '../telemetry/simulation-source'

interface RemoteBoidState {
  x: number
  y: number
  vx: number
  vy: number
  type: Organism['type']
}

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
  
  private remoteEnabled = true
  private remoteOrganisms: Organism[] = []
  private remoteState: RemoteBoidState[] = []
  private remoteTargetState: RemoteBoidState[] | null = null
  private remoteProgress = 1
  private remoteFetchPending = false
  private remoteLastSample = 0
  private remoteFailures = 0
  private latestStats: { total: number; predators: number; prey: number; producers: number; avgEnergy: number } | null = null
  private readonly remoteBlendDuration = 300
  private readonly remoteBoidCount = 180
  private sourceTracker = SimulationSourceTracker.getInstance()
  
  constructor(width: number, height: number) {
    this.boids = new BoidsSystem(width, height)
    this.width = width
    this.height = height
  }
  
  init(): void {
    this.progress = 0
    this.isComplete = false
    this.remoteState = []
    this.remoteTargetState = null
    this.remoteProgress = 1
    this.remoteFailures = 0
    this.remoteEnabled = true
    this.remoteOrganisms = []
    
    // Clear existing organisms before spawning new ones
    if (this.boids['organisms']) {
      this.boids['organisms'] = []
    }
    
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
    this.scheduleRemoteBoidFetch(true)
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    
    if (this.remoteEnabled && (this.remoteState.length > 0 || this.remoteFetchPending)) {
      this.updateRemoteBoids(dt)
    } else {
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

  private updateRemoteBoids(dt: number): void {
    if (this.remoteTargetState && this.remoteState.length > 0) {
      this.remoteProgress = Math.min(
        1,
        this.remoteProgress + dt / this.remoteBlendDuration
      )
      const interpolated = this.interpolateRemoteBoids(
        this.remoteState,
        this.remoteTargetState,
        this.remoteProgress
      )
      this.applyRemoteBoidSamples(interpolated)
      
      if (this.remoteProgress >= 1) {
        this.remoteState = this.remoteTargetState
        this.remoteTargetState = null
        this.remoteLastSample = this.now()
        this.scheduleRemoteBoidFetch()
      }
      return
    }
    
    if (this.remoteState.length > 0) {
      this.applyRemoteBoidSamples(this.remoteState)
      const now = this.now()
      if (!this.remoteFetchPending && now - this.remoteLastSample > this.remoteBlendDuration) {
        this.scheduleRemoteBoidFetch()
      }
      return
    }
    
    if (!this.remoteFetchPending) {
      this.scheduleRemoteBoidFetch(true)
      if (!this.remoteState.length) {
        this.reportSource('local', {
          sampleSize: this.renderOrganisms.length,
        })
      }
    }
  }

  private applyRemoteBoidSamples(samples: RemoteBoidState[]): void {
    if (!samples.length) return
    this.ensureRemoteOrganismPool(samples.length)
    
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]
      const organism = this.remoteOrganisms[i]
      organism.type = sample.type
      organism.color = this.colorForType(sample.type)
      organism.radius = sample.type === 'predator' ? 5 : sample.type === 'prey' ? 3 : 2.5
      organism.vx = sample.vx
      organism.vy = sample.vy
      organism.x = sample.x
      organism.y = sample.y
      organism.energy = Math.max(
        10,
        Math.min(
          organism.maxEnergy,
          organism.energy * 0.98 + Math.hypot(sample.vx, sample.vy) * 250
        )
      )
      organism.age = (organism.age + 1) % organism.maxAge
      
      organism.trail.push({ x: organism.x, y: organism.y })
      if (organism.trail.length > 20) {
        organism.trail.shift()
      }
    }
    
    this.renderOrganisms = this.remoteOrganisms
    this.reportSource('server', {
      sampleSize: samples.length,
    })
  }

  private ensureRemoteOrganismPool(count: number): void {
    while (this.remoteOrganisms.length < count) {
      this.remoteOrganisms.push(this.createRemoteOrganism(this.remoteOrganisms.length))
    }
  }

  private createRemoteOrganism(index: number): Organism {
    const type = this.boidTypeForIndex(index)
    return {
      id: `remote-${index}`,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
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

  private interpolateRemoteBoids(
    from: RemoteBoidState[],
    to: RemoteBoidState[],
    t: number
  ): RemoteBoidState[] {
    const length = Math.min(from.length, to.length)
    const result: RemoteBoidState[] = []
    
    for (let i = 0; i < length; i++) {
      result.push({
        x: lerp(from[i].x, to[i].x, t),
        y: lerp(from[i].y, to[i].y, t),
        vx: lerp(from[i].vx, to[i].vx, t),
        vy: lerp(from[i].vy, to[i].vy, t),
        type: to[i].type,
      })
    }
    
    return result
  }

  private scheduleRemoteBoidFetch(prime = false): void {
    if (this.remoteFetchPending || !this.remoteEnabled) return
    this.remoteFetchPending = true
    this.fetchRemoteBoids(prime)
      .catch((error) => {
        console.warn('Remote boids request failed', error)
      })
      .finally(() => {
        this.remoteFetchPending = false
      })
  }

  private async fetchRemoteBoids(prime: boolean): Promise<void> {
    try {
      const requestStarted = this.now()
      const run = await runBoidsSimulation({
        steps: prime ? 12 : 6,
        numParticles: this.remoteBoidCount,
      })
      const samples = this.transformRemoteBoids(run.data)
      const networkLatency = this.now() - requestStarted
      if (!samples.length) {
        throw new Error('Empty boids payload')
      }
      // Report accelerator if present
      const accel = run.metadata?.accelerator as 'cpu' | 'cuda' | undefined
      this.reportSource('server', {
        accelerator: accel,
        latencyMs: run.metadata?.computation_time_ms,
        roundTripMs: networkLatency,
        sampleSize: run.metadata?.num_particles ?? samples.length,
      })
      
      if (prime || this.remoteState.length === 0) {
        this.remoteState = samples
        this.applyRemoteBoidSamples(samples)
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
        this.reportSource('local', {
          sampleSize: this.renderOrganisms.length,
        })
      }
      throw error
    }
  }

  private transformRemoteBoids(data: number[]): RemoteBoidState[] {
    const result: RemoteBoidState[] = []
    const width = this.width
    const height = this.height
    
    for (let i = 0; i + 3 < data.length; i += 4) {
      const index = i / 4
      result.push({
        x: data[i] * width,
        y: data[i + 1] * height,
        vx: data[i + 2] * width,
        vy: data[i + 3] * height,
        type: this.boidTypeForIndex(index),
      })
    }
    
    return result
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

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now()
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
    // Clear all organisms to prevent memory leaks
    this.boids.organisms = []
    this.renderOrganisms = []
    this.remoteOrganisms = []
    this.remoteState = []
    this.remoteTargetState = null
    this.remoteFetchPending = false
    
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
