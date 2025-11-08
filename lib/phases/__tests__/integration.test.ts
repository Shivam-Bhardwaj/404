// Integration tests for phase transitions
import { PhaseManager } from '@/lib/phases/phase-manager'
import { TypingPhase } from '@/lib/phases/typing-phase'
import { WhitePhase } from '@/lib/phases/white-phase'
import { CirclePhase } from '@/lib/phases/circle-phase'
import { ExplosionPhase } from '@/lib/phases/explosion-phase'
import { PhaseType } from '@/lib/types'

describe('Phase Integration Tests', () => {
  let phaseManager: PhaseManager
  let phases: Map<PhaseType, any>
  let mockCanvas: HTMLCanvasElement
  let mockCtx: CanvasRenderingContext2D

  beforeEach(() => {
    mockCanvas = document.createElement('canvas')
    mockCanvas.width = 800
    mockCanvas.height = 600
    mockCtx = mockCanvas.getContext('2d')!

    phases = new Map()
    phases.set('typing', new TypingPhase())
    phases.set('white', new WhitePhase())
    phases.set('circle', new CirclePhase(800, 600))
    phases.set('explosion', new ExplosionPhase(800, 600))
  })

  test('should transition through all phases in sequence', () => {
    const sequence: PhaseType[] = ['typing', 'white', 'circle', 'explosion']
    phaseManager = new PhaseManager(phases, sequence, false)
    phaseManager.reset()

    // Complete typing
    phases.get('typing')!.isComplete = true
    phaseManager.update(100)
    expect(phaseManager.getCurrentPhaseType()).toBe('white')

    // Complete white
    phases.get('white')!.isComplete = true
    phaseManager.update(100)
    expect(phaseManager.getCurrentPhaseType()).toBe('circle')

    // Complete circle
    phases.get('circle')!.isComplete = true
    phaseManager.update(100)
    expect(phaseManager.getCurrentPhaseType()).toBe('explosion')
  })

  test('should handle rapid phase transitions', () => {
    const sequence: PhaseType[] = ['typing', 'white']
    phaseManager = new PhaseManager(phases, sequence, true)
    phaseManager.reset()

    // Rapidly complete phases
    for (let i = 0; i < 10; i++) {
      const current = phaseManager.getCurrentPhase()
      if (current) {
        current.isComplete = true
        phaseManager.update(100)
      }
    }

    // Should still be functioning
    expect(phaseManager.getCurrentPhase()).toBeTruthy()
  })

  test('should render all phases without errors', () => {
    const sequence: PhaseType[] = ['typing', 'white', 'circle', 'explosion']
    phaseManager = new PhaseManager(phases, sequence, false)
    phaseManager.reset()

    phases.forEach((phase) => {
      phase.init()
      expect(() => phase.render(mockCtx)).not.toThrow()
    })
  })

  test('should cleanup phases properly', () => {
    const sequence: PhaseType[] = ['typing', 'white']
    phaseManager = new PhaseManager(phases, sequence, false)
    phaseManager.reset()

    phases.get('typing')!.isComplete = true
    phaseManager.update(100)

    // Cleanup should not throw
    phases.forEach((phase) => {
      expect(() => phase.cleanup()).not.toThrow()
    })
  })
})

