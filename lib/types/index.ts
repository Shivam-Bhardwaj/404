// Core type definitions - DO NOT MODIFY
export interface Vec2 {
  x: number
  y: number
}

export interface Particle extends Vec2 {
  vx: number
  vy: number
  ax: number
  ay: number
  radius: number
  mass: number
  color: string
  life: number
  maxLife: number
}

export interface SPHParticle extends Particle {
  density: number
  pressure: number
  viscosity: number
}

export interface Organism extends Particle {
  id: string
  type: 'predator' | 'prey' | 'producer' | 'decomposer'
  energy: number
  maxEnergy: number
  age: number
  maxAge: number
  speed: number
  vision: number
  reproductionCooldown: number
  genes: GeneSequence
  trail: Vec2[]
}

export interface GeneSequence {
  hue: number        // 0-360
  saturation: number // 0-1
  brightness: number // 0-1
  size: number       // 0.5-2.0
  speed: number      // 0.5-2.0
  aggression: number // 0-1
  efficiency: number // 0-1
}

export type PhaseType = 
  | 'typing'
  | 'corruption' 
  | 'chemical'
  | 'white'
  | 'circle'
  | 'explosion'
  | 'ecosystem'

export interface AnimationPhase {
  name: PhaseType
  duration: number
  progress: number
  isComplete: boolean
  init(): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  cleanup(): void
}

export type DeviceTier = 'low' | 'medium' | 'high' | 'ultra'

export interface PerformanceConfig {
  particleCount: number
  updateRate: number
  renderQuality: number
  enableEffects: boolean
  enableShaders: boolean
}

