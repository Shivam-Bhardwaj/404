// Biological Ecosystem with Genetic Evolution
import { AnimationPhase } from '../types'
import { BoidsSystem } from '../biology/boids'
import { COLORS } from '../constants'

export class EcosystemPhase implements AnimationPhase {
  name: 'ecosystem' = 'ecosystem'
  duration = 30000 // 30 seconds
  progress = 0
  isComplete = false
  
  private boids: BoidsSystem
  
  constructor(width: number, height: number) {
    this.boids = new BoidsSystem(width, height)
  }
  
  init(): void {
    // Spawn initial population
    const types: Array<'predator' | 'prey' | 'producer'> = ['predator', 'prey', 'producer']
    
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
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    
    // Update ecosystem
    this.boids.update(dt)
    
    // Maintain minimum population
    const stats = this.boids.getPopulationStats()
    
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
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Draw trails
    for (const org of this.boids.organisms) {
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
    for (const org of this.boids.organisms) {
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
    
    // Draw stats
    const stats = this.boids.getPopulationStats()
    ctx.fillStyle = COLORS.white
    ctx.font = '12px monospace'
    ctx.textAlign = 'left'
    
    let yPos = 20
    const xPos = 10
    ctx.fillText(`Total: ${stats.total}`, xPos, yPos)
    yPos += 15
    ctx.fillStyle = COLORS.error
    ctx.fillText(`Predators: ${stats.predators}`, xPos, yPos)
    yPos += 15
    ctx.fillStyle = COLORS.warning
    ctx.fillText(`Prey: ${stats.prey}`, xPos, yPos)
    yPos += 15
    ctx.fillStyle = COLORS.success
    ctx.fillText(`Producers: ${stats.producers}`, xPos, yPos)
    yPos += 15
    ctx.fillStyle = COLORS.info
    ctx.fillText(`Avg Energy: ${stats.avgEnergy.toFixed(1)}`, xPos, yPos)
  }
  
  cleanup(): void {
    this.boids.organisms = []
    this.progress = 0
    this.isComplete = false
  }
}

