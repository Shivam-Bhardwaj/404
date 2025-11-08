// Smoothed Particle Hydrodynamics - CORE PHYSICS ENGINE
import { SPHParticle } from '../types'
import { distanceSq } from '../utils/math'

export class SPHSimulation {
  particles: SPHParticle[] = []
  width: number
  height: number
  
  // SPH constants
  readonly h = 10 // smoothing radius
  readonly h2 = this.h * this.h
  readonly restDensity = 1
  readonly k = 0.1 // pressure constant
  readonly mu = 0.1 // viscosity
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  
  addParticle(x: number, y: number, vx = 0, vy = 0): void {
    this.particles.push({
      x, y, vx, vy,
      ax: 0, ay: 0.5, // gravity
      radius: 2,
      mass: 1,
      color: '#4da6ff',
      life: 1,
      maxLife: 1,
      density: 0,
      pressure: 0,
      viscosity: this.mu,
    })
  }
  
  private poly6Kernel(r2: number): number {
    if (r2 >= this.h2) return 0
    const x = 1 - r2 / this.h2
    return 315 / (64 * Math.PI * this.h ** 9) * x * x * x
  }
  
  private spikyGradient(rx: number, ry: number, r: number): [number, number] {
    if (r >= this.h || r === 0) return [0, 0]
    const x = 1 - r / this.h
    const f = -45 / (Math.PI * this.h ** 6) * x * x / r
    return [f * rx, f * ry]
  }
  
  computeDensityPressure(): void {
    for (const pi of this.particles) {
      pi.density = 0
      for (const pj of this.particles) {
        const r2 = distanceSq(pi.x, pi.y, pj.x, pj.y)
        pi.density += pj.mass * this.poly6Kernel(r2)
      }
      pi.pressure = this.k * (pi.density - this.restDensity)
    }
  }
  
  computeForces(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const pi = this.particles[i]
      let fx = 0, fy = 0
      
      for (let j = 0; j < this.particles.length; j++) {
        if (i === j) continue
        const pj = this.particles[j]
        
        const dx = pj.x - pi.x
        const dy = pj.y - pi.y
        const r = Math.sqrt(dx * dx + dy * dy)
        
        if (r < this.h && r > 0) {
          // Pressure force
          const [px, py] = this.spikyGradient(dx, dy, r)
          const pressureForce = -pj.mass * (pi.pressure + pj.pressure) / (2 * pj.density)
          fx += pressureForce * px
          fy += pressureForce * py
          
          // Viscosity force
          const viscosityForce = this.mu * pj.mass / pj.density
          fx += viscosityForce * (pj.vx - pi.vx) * this.poly6Kernel(r * r)
          fy += viscosityForce * (pj.vy - pi.vy) * this.poly6Kernel(r * r)
        }
      }
      
      pi.ax = fx / pi.density
      pi.ay = fy / pi.density + 0.5 // gravity
    }
  }
  
  integrate(dt: number): void {
    for (const p of this.particles) {
      // Verlet integration
      p.vx += p.ax * dt
      p.vy += p.ay * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      
      // Boundary conditions
      if (p.x < p.radius) {
        p.x = p.radius
        p.vx *= -0.5
      }
      if (p.x > this.width - p.radius) {
        p.x = this.width - p.radius
        p.vx *= -0.5
      }
      if (p.y < p.radius) {
        p.y = p.radius
        p.vy *= -0.5
      }
      if (p.y > this.height - p.radius) {
        p.y = this.height - p.radius
        p.vy *= -0.5
      }
    }
  }
  
  update(dt: number): void {
    this.computeDensityPressure()
    this.computeForces()
    this.integrate(dt)
  }
}

