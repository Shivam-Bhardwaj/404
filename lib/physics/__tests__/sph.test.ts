// Tests for SPH Physics
import { SPHSimulation } from '@/lib/physics/sph'

describe('SPHSimulation', () => {
  let sph: SPHSimulation

  beforeEach(() => {
    sph = new SPHSimulation(800, 600)
  })

  test('should create simulation with correct dimensions', () => {
    expect(sph.width).toBe(800)
    expect(sph.height).toBe(600)
  })

  test('should add particles', () => {
    sph.addParticle(100, 100, 0, 0)
    expect(sph.particles.length).toBe(1)
    expect(sph.particles[0].x).toBe(100)
    expect(sph.particles[0].y).toBe(100)
  })

  test('should compute density and pressure', () => {
    sph.addParticle(100, 100, 0, 0)
    sph.addParticle(105, 100, 0, 0)
    
    sph.computeDensityPressure()
    
    expect(sph.particles[0].density).toBeGreaterThan(0)
    expect(sph.particles[0].pressure).toBeDefined()
  })

  test('should compute forces', () => {
    sph.addParticle(100, 100, 0, 0)
    sph.addParticle(105, 100, 0, 0)
    
    sph.computeDensityPressure()
    sph.computeForces()
    
    expect(sph.particles[0].ax).toBeDefined()
    expect(sph.particles[0].ay).toBeDefined()
  })

  test('should integrate particles', () => {
    sph.addParticle(100, 100, 1, 1)
    
    const initialX = sph.particles[0].x
    const initialY = sph.particles[0].y
    
    sph.computeDensityPressure()
    sph.computeForces()
    sph.integrate(0.016)
    
    // Particle should have moved
    expect(sph.particles[0].x).not.toBe(initialX)
    expect(sph.particles[0].y).not.toBe(initialY)
  })

  test('should handle boundary conditions', () => {
    sph.addParticle(0, 0, -10, -10)
    
    sph.computeDensityPressure()
    sph.computeForces()
    sph.integrate(0.016)
    
    // Particle should be constrained within bounds
    expect(sph.particles[0].x).toBeGreaterThanOrEqual(sph.particles[0].radius)
    expect(sph.particles[0].y).toBeGreaterThanOrEqual(sph.particles[0].radius)
  })

  test('should compute adaptive timestep', () => {
    sph.addParticle(100, 100, 100, 100) // High velocity
    
    sph.computeDensityPressure()
    sph.computeForces()
    
    const dt = sph.computeAdaptiveDt()
    expect(dt).toBeGreaterThan(0)
    expect(dt).toBeLessThanOrEqual(0.033)
  })

  test('should update with multiple substeps', () => {
    sph.addParticle(100, 100, 0, 0)
    
    const initialX = sph.particles[0].x
    
    // Update with large dt - should use substeps
    sph.update(0.1)
    
    expect(sph.particles[0].x).toBeDefined()
  })

  test('should handle empty particle list', () => {
    expect(() => {
      sph.computeDensityPressure()
      sph.computeForces()
      sph.integrate(0.016)
    }).not.toThrow()
  })
})

