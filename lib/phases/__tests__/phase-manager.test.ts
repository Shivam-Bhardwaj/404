'use strict'

// Tests for PhaseManager
import { PhaseManager } from '@/lib/phases/phase-manager'
import { AnimationPhase, PhaseType } from '@/lib/types'

class StubPhase implements AnimationPhase {
  name: PhaseType
  duration = 100
  progress = 0
  isComplete = false
  initCalls = 0
  cleanupCalls = 0
  renderMock = jest.fn()
  updateMock = jest.fn()

  constructor(name: PhaseType) {
    this.name = name
  }

  init(): void {
    this.progress = 0
    this.isComplete = false
    this.initCalls++
  }

  update(dt: number): void {
    this.updateMock(dt)
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderMock(ctx)
  }

  cleanup(): void {
    this.cleanupCalls++
    this.isComplete = false
  }
}

describe('PhaseManager', () => {
  let phaseManager: PhaseManager
  let phases: Map<PhaseType, StubPhase>
  let mockCanvas: HTMLCanvasElement
  let mockCtx: CanvasRenderingContext2D

  const advanceTransition = (manager: PhaseManager) => {
    manager.update(250)
    manager.update(250)
  }

  beforeEach(() => {
    mockCanvas = document.createElement('canvas')
    mockCtx = mockCanvas.getContext('2d') as CanvasRenderingContext2D

    phases = new Map()
    phases.set('typing', new StubPhase('typing'))
    phases.set('white', new StubPhase('white'))

    phaseManager = new PhaseManager(phases, ['typing', 'white'], true)
    phaseManager.reset()
  })

  test('should initialize with first phase', () => {
    const currentPhase = phaseManager.getCurrentPhase() as StubPhase
    expect(currentPhase).toBeTruthy()
    expect(currentPhase.name).toBe('typing')
    expect(currentPhase.initCalls).toBe(1)
  })

  test('should transition to next phase and call cleanup/init appropriately', () => {
    const typingPhase = phases.get('typing')!
    const whitePhase = phases.get('white')!
    const initialCleanup = typingPhase.cleanupCalls

    typingPhase.isComplete = true
    advanceTransition(phaseManager)

    expect(typingPhase.cleanupCalls).toBe(initialCleanup + 1)
    expect(whitePhase.initCalls).toBe(1)
    expect(phaseManager.getCurrentPhaseType()).toBe('white')
  })

  test('should loop back to first phase when sequence completes', () => {
    const typingPhase = phases.get('typing')!
    const whitePhase = phases.get('white')!
    const initialTypingCleanup = typingPhase.cleanupCalls
    const initialWhiteCleanup = whitePhase.cleanupCalls

    typingPhase.isComplete = true
    advanceTransition(phaseManager)

    whitePhase.isComplete = true
    advanceTransition(phaseManager)

    const currentPhase = phaseManager.getCurrentPhase()
    expect(currentPhase?.name).toBe('typing')
    expect(typingPhase.cleanupCalls).toBe(initialTypingCleanup + 2)
    expect(whitePhase.cleanupCalls).toBe(initialWhiteCleanup + 2)
    expect(phaseManager.getLoopCount()).toBe(1)
  })

  test('should increment loop count on each loop', () => {
    for (let i = 0; i < 3; i++) {
      const currentPhase = phaseManager.getCurrentPhase()
      if (currentPhase) {
        currentPhase.isComplete = true
        advanceTransition(phaseManager)
      }
    }

    expect(phaseManager.getLoopCount()).toBeGreaterThanOrEqual(1)
  })

  test('should render current phase', () => {
    const currentPhase = phaseManager.getCurrentPhase() as StubPhase
    phaseManager.render(mockCtx)
    expect(currentPhase.renderMock).toHaveBeenCalledWith(mockCtx)
  })

  test('should handle non-looping mode', () => {
    const nonLoopingManager = new PhaseManager(phases, ['typing', 'white'], false)
    nonLoopingManager.reset()

    const first = phases.get('typing')!
    const second = phases.get('white')!

    first.isComplete = true
    advanceTransition(nonLoopingManager)

    second.isComplete = true
    advanceTransition(nonLoopingManager)

    expect(nonLoopingManager.getLoopCount()).toBe(0)
    expect(nonLoopingManager.getCurrentPhase()).toBeNull()
    expect(nonLoopingManager.getCurrentPhaseType()).toBeNull()
  })
})

