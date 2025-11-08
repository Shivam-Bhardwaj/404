// Extended Boids System with Predator-Prey Dynamics
import { Organism, Vec2 } from '../types'
import { distance, distanceSq, vecNormalize, clamp } from '../utils/math'
import { GeneticsEngine } from './genetics'

export class BoidsSystem {
  organisms: Organism[] = []
  private genetics = new GeneticsEngine()
  private width: number
  private height: number
  private idCounter = 0
  
  // Boids parameters
  separationRadius = 20
  alignmentRadius = 50
  cohesionRadius = 80
  separationWeight = 1.5
  alignmentWeight = 1.0
  cohesionWeight = 1.0
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  
  addOrganism(
    x: number,
    y: number,
    type: Organism['type'],
    parent?: Organism
  ): void {
    const gene = parent
      ? this.genetics.mutate(parent.genes)
      : this.genetics.createGene()
    
    const maxEnergy = type === 'predator' ? 150 : type === 'prey' ? 100 : 80
    const maxAge = type === 'predator' ? 800 : type === 'prey' ? 600 : 1000
    const speed = gene.speed * (type === 'predator' ? 3 : type === 'prey' ? 2.5 : 1.5)
    const vision = type === 'predator' ? 150 : type === 'prey' ? 100 : 50
    
    this.organisms.push({
      id: `org-${this.idCounter++}`,
      x,
      y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      ax: 0,
      ay: 0,
      radius: gene.size * 2,
      mass: gene.size,
      color: this.genetics.geneToColor(gene),
      life: 1,
      maxLife: 1,
      type,
      energy: maxEnergy,
      maxEnergy,
      age: 0,
      maxAge,
      speed,
      vision,
      reproductionCooldown: 0,
      genes: gene,
      trail: [],
    })
  }
  
  private getNeighbors(org: Organism, radius: number): Organism[] {
    const neighbors: Organism[] = []
    
    for (const other of this.organisms) {
      if (other.id === org.id) continue
      
      const dist = distance(org.x, org.y, other.x, other.y)
      if (dist < radius) {
        neighbors.push(other)
      }
    }
    
    return neighbors
  }
  
  private separation(org: Organism): Vec2 {
    const neighbors = this.getNeighbors(org, this.separationRadius)
    if (neighbors.length === 0) return { x: 0, y: 0 }
    
    let steerX = 0
    let steerY = 0
    
    for (const other of neighbors) {
      const dx = org.x - other.x
      const dy = org.y - other.y
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
      
      steerX += dx / d
      steerY += dy / d
    }
    
    return { x: steerX, y: steerY }
  }
  
  private alignment(org: Organism): Vec2 {
    const neighbors = this.getNeighbors(org, this.alignmentRadius).filter(
      (n) => n.type === org.type
    )
    if (neighbors.length === 0) return { x: 0, y: 0 }
    
    let avgVx = 0
    let avgVy = 0
    
    for (const other of neighbors) {
      avgVx += other.vx
      avgVy += other.vy
    }
    
    avgVx /= neighbors.length
    avgVy /= neighbors.length
    
    return { x: avgVx - org.vx, y: avgVy - org.vy }
  }
  
  private cohesion(org: Organism): Vec2 {
    const neighbors = this.getNeighbors(org, this.cohesionRadius).filter(
      (n) => n.type === org.type
    )
    if (neighbors.length === 0) return { x: 0, y: 0 }
    
    let centerX = 0
    let centerY = 0
    
    for (const other of neighbors) {
      centerX += other.x
      centerY += other.y
    }
    
    centerX /= neighbors.length
    centerY /= neighbors.length
    
    return { x: centerX - org.x, y: centerY - org.y }
  }
  
  private predatorPrey(org: Organism): Vec2 {
    let steerX = 0
    let steerY = 0
    
    if (org.type === 'predator') {
      // Chase prey
      const prey = this.organisms.filter(
        (o) => o.type === 'prey' && distance(org.x, org.y, o.x, o.y) < org.vision
      )
      
      if (prey.length > 0) {
        const target = prey[0]
        steerX = target.x - org.x
        steerY = target.y - org.y
        const len = Math.sqrt(steerX * steerX + steerY * steerY)
        if (len > 0) {
          steerX = (steerX / len) * 2
          steerY = (steerY / len) * 2
        }
      }
    } else if (org.type === 'prey') {
      // Flee predators
      const predators = this.organisms.filter(
        (o) => o.type === 'predator' && distance(org.x, org.y, o.x, o.y) < org.vision
      )
      
      for (const pred of predators) {
        const dx = org.x - pred.x
        const dy = org.y - pred.y
        const d = Math.max(1, Math.sqrt(dx * dx + dy * dy))
        const intensity = 1 - d / org.vision
        
        steerX += (dx / d) * intensity * 3
        steerY += (dy / d) * intensity * 3
      }
    }
    
    return { x: steerX, y: steerY }
  }
  
  update(dt: number): void {
    const toRemove: string[] = []
    
    for (const org of this.organisms) {
      // Age and energy decay
      org.age++
      org.energy -= org.type === 'predator' ? 0.3 : org.type === 'prey' ? 0.2 : 0.1
      org.reproductionCooldown = Math.max(0, org.reproductionCooldown - 1)
      
      // Calculate steering forces
      const sep = this.separation(org)
      const align = this.alignment(org)
      const coh = this.cohesion(org)
      const predPrey = this.predatorPrey(org)
      
      // Apply forces
      org.ax = sep.x * this.separationWeight +
                align.x * this.alignmentWeight +
                coh.x * this.cohesionWeight +
                predPrey.x
      
      org.ay = sep.y * this.separationWeight +
                align.y * this.alignmentWeight +
                coh.y * this.cohesionWeight +
                predPrey.y
      
      // Update velocity
      org.vx += org.ax * dt * 0.01
      org.vy += org.ay * dt * 0.01
      
      // Limit speed
      const speed = Math.sqrt(org.vx * org.vx + org.vy * org.vy)
      if (speed > org.speed) {
        org.vx = (org.vx / speed) * org.speed
        org.vy = (org.vy / speed) * org.speed
      }
      
      // Update position
      org.x += org.vx * dt * 0.01
      org.y += org.vy * dt * 0.01
      
      // Wrap around edges
      if (org.x < 0) org.x += this.width
      if (org.x > this.width) org.x -= this.width
      if (org.y < 0) org.y += this.height
      if (org.y > this.height) org.y -= this.height
      
      // Update trail
      org.trail.push({ x: org.x, y: org.y })
      if (org.trail.length > 10) org.trail.shift()
      
      // Check for death
      if (org.energy <= 0 || org.age >= org.maxAge) {
        toRemove.push(org.id)
      }
      
      // Check for reproduction
      if (
        org.reproductionCooldown === 0 &&
        org.energy > org.maxEnergy * 0.7 &&
        this.genetics.shouldReproduce(org.genes, org.energy, this.organisms.length)
      ) {
        this.addOrganism(
          org.x + (Math.random() - 0.5) * 20,
          org.y + (Math.random() - 0.5) * 20,
          org.type,
          org
        )
        org.energy -= org.maxEnergy * 0.4
        org.reproductionCooldown = 100
      }
    }
    
    // Handle predation
    for (const pred of this.organisms.filter((o) => o.type === 'predator')) {
      for (const prey of this.organisms.filter((o) => o.type === 'prey')) {
        if (distance(pred.x, pred.y, prey.x, prey.y) < pred.radius + prey.radius) {
          toRemove.push(prey.id)
          pred.energy = Math.min(pred.maxEnergy, pred.energy + 50)
        }
      }
    }
    
    // Remove dead organisms
    this.organisms = this.organisms.filter((o) => !toRemove.includes(o.id))
  }
  
  getPopulationStats() {
    const stats = {
      total: this.organisms.length,
      predators: 0,
      prey: 0,
      producers: 0,
      decomposers: 0,
      avgEnergy: 0,
      avgAge: 0,
    }
    
    for (const org of this.organisms) {
      stats[`${org.type}s` as keyof typeof stats] = (stats[`${org.type}s` as keyof typeof stats] as number) + 1
      stats.avgEnergy += org.energy
      stats.avgAge += org.age
    }
    
    if (stats.total > 0) {
      stats.avgEnergy /= stats.total
      stats.avgAge /= stats.total
    }
    
    return stats
  }
}

