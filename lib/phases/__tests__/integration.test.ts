// Integration tests for phase transitions
import { PhaseManager } from '@/lib/phases/phase-manager'
import { AnimationPhase, PhaseType } from '@/lib/types'

class StubPhase implements AnimationPhase {
  name: PhaseType
  duration = 100
  progress = 0
  isComplete = false
  initCalls = 0
  cleanupCalls = 0

  constructor(name: PhaseType) {
    this.name = name
  }

  init(): void {
    this.isComplete = false
    this.initCalls++
  }

  update(): void {}

  render(): void {}

  cleanup(): void {
    this.isComplete = false
    this.cleanupCalls++
  }
}

describe('Phase Integration Tests', () => {
  let phaseManager: PhaseManager
  let phases: Map<PhaseType, StubPhase>

  const createManager = (sequence: PhaseType[], loop = true) => {
    phaseManager = new PhaseManager(phases, sequence, loop)
    phaseManager.reset()
  }

  const advancePhase = () => {
    const current = phaseManager.getCurrentPhase() as StubPhase
    current.isComplete = true
    phaseManager.update(250)
    phaseManager.update(250)
  }

  beforeEach(() => {
    phases = new Map()
    phases.set('typing', new StubPhase('typing'))
    phases.set('white', new StubPhase('white'))
    phases.set('circle', new StubPhase('circle'))
    phases.set('explosion', new StubPhase('explosion'))
  })

  test('transitions through phases in sequence and triggers init/cleanup', () => {
    createManager(['typing', 'white', 'circle', 'explosion'], false)

    const typingPhase = phases.get('typing')!
    const whitePhase = phases.get('white')!
    const circlePhase = phases.get('circle')!

    const initialTypingCleanup = typingPhase.cleanupCalls
    const initialWhiteCleanup = whitePhase.cleanupCalls
    const initialCircleCleanup = circlePhase.cleanupCalls

    advancePhase()
    expect(phaseManager.getCurrentPhaseType()).toBe('white')
    expect(typingPhase.cleanupCalls).toBe(initialTypingCleanup + 1)

    advancePhase()
    expect(phaseManager.getCurrentPhaseType()).toBe('circle')
    expect(whitePhase.cleanupCalls).toBe(initialWhiteCleanup + 1)

    advancePhase()
    expect(phaseManager.getCurrentPhaseType()).toBe('explosion')
    expect(circlePhase.cleanupCalls).toBe(initialCircleCleanup + 1)
  })

  test('handles rapid successive transitions without losing state', () => {
    createManager(['typing', 'white'], true)

    for (let i = 0; i < 6; i++) {
      advancePhase()
    }

    expect(phaseManager.getCurrentPhase()).toBeTruthy()
    expect(phaseManager.getLoopCount()).toBeGreaterThan(0)
  })

  test('renders current phase during transition sequence', () => {
    createManager(['typing', 'white'], false)
    const current = phaseManager.getCurrentPhase() as StubPhase

    const renderSpy = jest.spyOn(current, 'render')
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    phaseManager.render(ctx)

    expect(renderSpy).toHaveBeenCalledWith(ctx)
  })

  test('resets loop count and index when sequence is updated', () => {
    createManager(['typing', 'white'], true)

    advancePhase()
    expect(phaseManager.getLoopCount()).toBe(0)

    phaseManager.setSequence(['typing', 'circle'])
    expect(phaseManager.getLoopCount()).toBe(0)
    expect(phaseManager.getCurrentPhaseType()).toBe('typing')
  })
})

