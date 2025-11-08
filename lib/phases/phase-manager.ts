// Phase Manager for Infinite Animation Looping
import { AnimationPhase, PhaseType } from '../types'

export interface PhaseSequence {
  phases: PhaseType[]
  loop: boolean
  transitionDuration?: number
}

export class PhaseManager {
  private phases: Map<PhaseType, AnimationPhase> = new Map()
  private sequence: PhaseType[] = []
  private currentIndex = 0
  private loopCount = 0
  private isLooping = true
  private transitionProgress = 0
  private transitionDuration = 500
  private isTransitioning = false
  
  constructor(phases: Map<PhaseType, AnimationPhase>, sequence: PhaseType[], loop = true) {
    this.phases = phases
    this.sequence = sequence
    this.isLooping = loop
  }
  
  getCurrentPhase(): AnimationPhase | null {
    if (this.sequence.length === 0) return null
    const phaseType = this.sequence[this.currentIndex]
    return this.phases.get(phaseType) || null
  }
  
  getCurrentPhaseType(): PhaseType | null {
    if (this.sequence.length === 0) return null
    return this.sequence[this.currentIndex]
  }
  
  getLoopCount(): number {
    return this.loopCount
  }
  
  update(dt: number): void {
    const currentPhase = this.getCurrentPhase()
    if (!currentPhase) return
    
    // Handle transitions
    if (this.isTransitioning) {
      this.transitionProgress = Math.min(1, this.transitionProgress + dt / this.transitionDuration)
      
      if (this.transitionProgress >= 1) {
        this.isTransitioning = false
        this.transitionProgress = 0
      }
    }
    
    // Update current phase
    currentPhase.update(dt)
    
    // Check if phase is complete
    if (currentPhase.isComplete && !this.isTransitioning) {
      this.transitionToNext()
    }
  }
  
  private transitionToNext(): void {
    const currentPhase = this.getCurrentPhase()
    if (!currentPhase) return
    
    // Cleanup current phase
    currentPhase.cleanup()
    
    // Move to next phase
    this.currentIndex++
    
    // Handle looping
    if (this.currentIndex >= this.sequence.length) {
      if (this.isLooping) {
        this.currentIndex = 0
        this.loopCount++
        
        // Add variation to phases on loop
        this.applyLoopVariations()
      } else {
        // Stop at end of sequence
        return
      }
    }
    
    // Initialize next phase
    const nextPhase = this.getCurrentPhase()
    if (nextPhase) {
      this.isTransitioning = true
      this.transitionProgress = 0
      nextPhase.init()
    }
  }
  
  private applyLoopVariations(): void {
    // Apply progressive enhancements based on loop count
    this.phases.forEach((phase) => {
      // Reset phase state for new loop
      phase.cleanup()
      
      // Apply variations based on loop count
      if (phase.name === 'typing') {
        // Vary typing speed and glitch intensity
        const typingPhase = phase as any
        if (typingPhase.glitchProbability !== undefined) {
          typingPhase.glitchProbability = 0.1 + Math.min(0.3, this.loopCount * 0.05)
        }
      }
      
      if (phase.name === 'explosion') {
        // Increase particle count slightly on each loop
        const explosionPhase = phase as any
        if (explosionPhase.sph) {
          // Will be reset in init()
        }
      }
      
      if (phase.name === 'ecosystem') {
        // Increase initial population diversity
        const ecosystemPhase = phase as any
        if (ecosystemPhase.boids) {
          // Will be reset in init()
        }
      }
    })
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    const currentPhase = this.getCurrentPhase()
    if (!currentPhase) return
    
    // Render current phase with transition fade if transitioning
    if (this.isTransitioning && this.transitionProgress > 0) {
      ctx.save()
      ctx.globalAlpha = 1 - this.transitionProgress
      currentPhase.render(ctx)
      ctx.restore()
    } else {
      currentPhase.render(ctx)
    }
  }
  
  setSequence(sequence: PhaseType[]): void {
    this.sequence = sequence
    this.currentIndex = 0
    this.loopCount = 0
  }
  
  setLooping(loop: boolean): void {
    this.isLooping = loop
  }
  
  reset(): void {
    this.currentIndex = 0
    this.loopCount = 0
    this.transitionProgress = 0
    this.isTransitioning = false
    
    // Reset all phases
    this.phases.forEach((phase) => {
      phase.cleanup()
    })
    
    // Initialize first phase
    const firstPhase = this.getCurrentPhase()
    if (firstPhase) {
      firstPhase.init()
    }
  }
}

