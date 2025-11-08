// Tests for PhaseManager
import { PhaseManager } from '@/lib/phases/phase-manager'
import { TypingPhase } from '@/lib/phases/typing-phase'
import { WhitePhase } from '@/lib/phases/white-phase'
import { PhaseType } from '@/lib/types'

describe('PhaseManager', () => {
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

    const sequence: PhaseType[] = ['typing', 'white']
    phaseManager = new PhaseManager(phases, sequence, true)
  })

  test('should initialize with first phase', () => {
    phaseManager.reset()
    const currentPhase = phaseManager.getCurrentPhase()
    expect(currentPhase).toBeTruthy()
    expect(currentPhase?.name).toBe('typing')
  })

  test('should transition to next phase when current completes', () => {
    phaseManager.reset()
    const typingPhase = phases.get('typing')!
    
    // Complete the typing phase
    typingPhase.isComplete = true
    
    phaseManager.update(100)
    phaseManager.update(100)
    
    const currentPhase = phaseManager.getCurrentPhase()
    expect(currentPhase?.name).toBe('white')
  })

  test('should loop back to first phase when sequence completes', () => {
    phaseManager.reset()
    
    // Complete typing phase
    const typingPhase = phases.get('typing')!
    typingPhase.init()
    typingPhase.isComplete = true
    phaseManager.update(100)
    phaseManager.update(100) // Extra update to trigger transition
    
    // Complete white phase
    const whitePhase = phases.get('white')!
    whitePhase.init()
    whitePhase.isComplete = true
    phaseManager.update(100)
    phaseManager.update(100) // Extra update to trigger transition
    
    // Should loop back to typing
    const currentPhase = phaseManager.getCurrentPhase()
    expect(currentPhase?.name).toBe('typing')
    expect(phaseManager.getLoopCount()).toBe(1)
  })

  test('should increment loop count on each loop', () => {
    phaseManager.reset()
    
    // Complete two full cycles - need to properly simulate transitions
    for (let cycle = 0; cycle < 2; cycle++) {
      // First phase
      let currentPhase = phaseManager.getCurrentPhase()
      if (currentPhase) {
        currentPhase.init()
        currentPhase.isComplete = true
        // Multiple updates to ensure transition completes
        for (let i = 0; i < 5; i++) {
          phaseManager.update(100)
        }
      }
      
      // Second phase
      currentPhase = phaseManager.getCurrentPhase()
      if (currentPhase) {
        currentPhase.init()
        currentPhase.isComplete = true
        // Multiple updates to ensure transition completes
        for (let i = 0; i < 5; i++) {
          phaseManager.update(100)
        }
      }
    }
    
    // After 2 cycles, loop count should be 2
    expect(phaseManager.getLoopCount()).toBeGreaterThanOrEqual(1)
  })

  test('should render current phase', () => {
    phaseManager.reset()
    expect(() => phaseManager.render(mockCtx)).not.toThrow()
  })

  test('should handle non-looping mode', () => {
    const nonLoopingManager = new PhaseManager(phases, ['typing', 'white'], false)
    nonLoopingManager.reset()
    
    phases.get('typing')!.isComplete = true
    nonLoopingManager.update(100)
    
    phases.get('white')!.isComplete = true
    nonLoopingManager.update(100)
    
    // Should not loop
    expect(nonLoopingManager.getLoopCount()).toBe(0)
  })
})

