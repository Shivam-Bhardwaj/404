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
  readonly sigma = 0.0728 // surface tension coefficient
  
  // CFL condition monitoring
  private maxVelocity = 0
  private adaptiveDt = 0.016 // Adaptive timestep
  private cflNumber = 0.5 // CFL stability criterion
  
  // Spatial hashing for neighbor search optimization
  private cellSize = this.h
  private grid: Map<string, number[]> = new Map()
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize)
    const cellY = Math.floor(y / this.cellSize)
    return `${cellX},${cellY}`
  }
  
  private buildSpatialGrid(): void {
    this.grid.clear()
    
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i]
      const key = this.getCellKey(p.x, p.y)
      
      if (!this.grid.has(key)) {
        this.grid.set(key, [])
      }
      this.grid.get(key)!.push(i)
    }
  }
  
  private getNeighbors(particle: SPHParticle, index: number): number[] {
    const neighbors: number[] = []
    const cellX = Math.floor(particle.x / this.cellSize)
    const cellY = Math.floor(particle.y / this.cellSize)
    
    // Check 3x3 grid of cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`
        const cell = this.grid.get(key)
        if (cell) {
          for (const idx of cell) {
            if (idx !== index) {
              const pj = this.particles[idx]
              const r2 = distanceSq(particle.x, particle.y, pj.x, pj.y)
              if (r2 < this.h2) {
                neighbors.push(idx)
              }
            }
          }
        }
      }
    }
    
    return neighbors
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
  
  private laplacianKernel(r2: number): number {
    if (r2 >= this.h2) return 0
    const r = Math.sqrt(r2)
    const q = r / this.h
    return 45 / (Math.PI * this.h ** 6) * (1 - q) * (1 - q)
  }
  
  computeDensityPressure(): void {
    // Build spatial grid for efficient neighbor search
    this.buildSpatialGrid()
    
    for (let i = 0; i < this.particles.length; i++) {
      const pi = this.particles[i]
      pi.density = 0
      
      const neighbors = this.getNeighbors(pi, i)
      
      for (const j of neighbors) {
        const pj = this.particles[j]
        const r2 = distanceSq(pi.x, pi.y, pj.x, pj.y)
        pi.density += pj.mass * this.poly6Kernel(r2)
      }
      
      // Ensure minimum density to avoid division by zero
      pi.density = Math.max(pi.density, 0.1)
      pi.pressure = this.k * (pi.density - this.restDensity)
    }
  }
  
  computeForces(): void {
    this.maxVelocity = 0
    
    for (let i = 0; i < this.particles.length; i++) {
      const pi = this.particles[i]
      let fx = 0, fy = 0
      
      const neighbors = this.getNeighbors(pi, i)
      
      // Surface tension computation
      let surfaceNormalX = 0
      let surfaceNormalY = 0
      let surfaceCurvature = 0
      
      for (const j of neighbors) {
        const pj = this.particles[j]
        
        const dx = pj.x - pi.x
        const dy = pj.y - pi.y
        const r2 = dx * dx + dy * dy
        const r = Math.sqrt(r2)
        
        if (r < this.h && r > 0) {
          // Pressure force
          const [px, py] = this.spikyGradient(dx, dy, r)
          const pressureForce = -pj.mass * (pi.pressure + pj.pressure) / (2 * pj.density)
          fx += pressureForce * px
          fy += pressureForce * py
          
          // Viscosity force
          const viscosityForce = this.mu * pj.mass / pj.density
          fx += viscosityForce * (pj.vx - pi.vx) * this.poly6Kernel(r2)
          fy += viscosityForce * (pj.vy - pi.vy) * this.poly6Kernel(r2)
          
          // Surface tension - compute normal
          const [nx, ny] = this.spikyGradient(dx, dy, r)
          surfaceNormalX += nx * pj.mass / pj.density
          surfaceNormalY += ny * pj.mass / pj.density
          
          // Surface curvature
          surfaceCurvature += this.laplacianKernel(r2) * pj.mass / pj.density
        }
      }
      
      // Apply surface tension force
      const normalLength = Math.sqrt(surfaceNormalX * surfaceNormalX + surfaceNormalY * surfaceNormalY)
      if (normalLength > 0.01) {
        const surfaceForce = -this.sigma * surfaceCurvature
        fx += surfaceForce * surfaceNormalX / normalLength
        fy += surfaceForce * surfaceNormalY / normalLength
      }
      
      pi.ax = fx / pi.density
      pi.ay = fy / pi.density + 0.5 // gravity
      
      // Track maximum velocity for CFL condition
      const velocity = Math.sqrt(pi.vx * pi.vx + pi.vy * pi.vy)
      this.maxVelocity = Math.max(this.maxVelocity, velocity)
    }
  }
  
  // Compute adaptive timestep based on CFL condition
  computeAdaptiveDt(): number {
    if (this.maxVelocity === 0) return this.adaptiveDt
    
    // CFL condition: dt <= CFL * h / max_velocity
    const cflDt = (this.cflNumber * this.h) / this.maxVelocity
    
    // Use smaller of current dt or CFL-limited dt
    this.adaptiveDt = Math.min(this.adaptiveDt * 1.1, cflDt * 0.9)
    
    // Clamp to reasonable bounds
    this.adaptiveDt = Math.max(0.001, Math.min(0.033, this.adaptiveDt))
    
    return this.adaptiveDt
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
    // Use adaptive timestep based on CFL condition
    const adaptiveDt = this.computeAdaptiveDt()
    const steps = Math.ceil(dt / adaptiveDt)
    const stepSize = dt / steps
    
    for (let step = 0; step < steps; step++) {
      this.computeDensityPressure()
      this.computeForces()
      this.integrate(stepSize)
    }
  }
}

