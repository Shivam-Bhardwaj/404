import { PhaseManager } from '@/lib/phases/phase-manager'
import { ExplosionPhase } from '@/lib/phases/explosion-phase'
import { EcosystemPhase } from '@/lib/phases/ecosystem-phase'
import { AnimationPhase, PhaseType } from '@/lib/types'

class StubPhase implements AnimationPhase {
  name: PhaseType
  duration = 100
  progress = 0
  isComplete = false

  constructor(name: PhaseType) {
    this.name = name
  }

  init(): void {
    this.isComplete = false
  }

  update(): void {}
  render(): void {}
  cleanup(): void {
    this.isComplete = false
  }
}

describe('PhaseManager memory-sensitive phases', () => {
  const advancePhase = (manager: PhaseManager) => {
    manager.update(250)
    manager.update(250)
  }

  test('cleans explosion particles and ecosystem organisms between loops', () => {
    const stubTyping = new StubPhase('typing')
    const explosion = new ExplosionPhase(200, 200)
    const ecosystem = new EcosystemPhase(200, 200)

    const phases = new Map<PhaseType, AnimationPhase>([
      ['typing', stubTyping],
      ['explosion', explosion],
      ['ecosystem', ecosystem],
    ])

    const manager = new PhaseManager(phases, ['typing', 'explosion', 'ecosystem'], true)
    manager.reset()

    // Advance from typing to explosion
    const typingPhase = phases.get('typing')!
    typingPhase.isComplete = true
    advancePhase(manager)
    expect(manager.getCurrentPhaseType()).toBe('explosion')

    const explosionPhase = phases.get('explosion') as ExplosionPhase
    expect(explosionPhase['sph'].particles.length).toBeGreaterThan(0)

    // Transition to ecosystem and ensure explosion cleanup ran
    explosionPhase.isComplete = true
    advancePhase(manager)
    expect(explosionPhase['sph'].particles.length).toBe(0)
    expect(manager.getCurrentPhaseType()).toBe('ecosystem')

    const ecosystemPhase = phases.get('ecosystem') as EcosystemPhase
    expect(ecosystemPhase['boids'].organisms.length).toBeGreaterThan(0)

    // Loop back to typing and ensure ecosystem cleaned
    ecosystemPhase.isComplete = true
    advancePhase(manager) // to go back to typing
    advancePhase(manager) // finish transition back to typing

    expect(manager.getCurrentPhaseType()).toBe('typing')
    expect(manager.getLoopCount()).toBeGreaterThanOrEqual(1)
    expect(ecosystemPhase['boids'].organisms.length).toBe(0)
  })
})
