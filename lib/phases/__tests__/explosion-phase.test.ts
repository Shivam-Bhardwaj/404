import { ExplosionPhase } from '@/lib/phases/explosion-phase'
import { SharedWebGLContext } from '@/lib/rendering/shared-webgl-context'
import { GPUParticleRenderer } from '@/lib/rendering/particle-gpu-renderer'

jest.mock('@/lib/rendering/particle-gpu-renderer', () => {
  const ctor = jest.fn().mockImplementation(() => ({
    updateParticles: jest.fn(),
    render: jest.fn(),
    cleanup: jest.fn(),
  }))
  return { GPUParticleRenderer: ctor }
})

describe('ExplosionPhase', () => {
  const MockedGPURenderer = GPUParticleRenderer as unknown as jest.Mock
  let sharedSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    MockedGPURenderer.mockImplementation(() => ({
      updateParticles: jest.fn(),
      render: jest.fn(),
      cleanup: jest.fn(),
    }))
    sharedSpy = jest.spyOn(SharedWebGLContext, 'getInstance')
  })

  afterEach(() => {
    sharedSpy.mockRestore()
  })

  test('falls back to Canvas 2D rendering when GPU is unavailable', () => {
    sharedSpy.mockReturnValue({
      isInitialized: jest.fn().mockReturnValue(false),
      getRenderer: jest.fn(),
    } as unknown as SharedWebGLContext)

    const phase = new ExplosionPhase(400, 400)
    phase.init()

    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 400
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    const fillRectSpy = jest.spyOn(ctx, 'fillRect')

    phase.render(ctx)

    expect(MockedGPURenderer).not.toHaveBeenCalled()
    expect(fillRectSpy).toHaveBeenCalled()
  })

  test('uses GPU renderer when shared context provides a renderer', () => {
    const mockClear = jest.fn()
    const mockGetContext = jest.fn().mockReturnValue({})
    const mockRenderer = {
      clear: mockClear,
      getContext: mockGetContext,
      isWebGLSupported: jest.fn().mockReturnValue(true),
    }

    sharedSpy.mockReturnValue({
      isInitialized: jest.fn().mockReturnValue(true),
      getRenderer: jest.fn().mockReturnValue(mockRenderer),
    } as unknown as SharedWebGLContext)

    const canvas = document.createElement('canvas')
    canvas.width = 300
    canvas.height = 300
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    const phase = new ExplosionPhase(300, 300, canvas)
    phase.init()
    phase.render(ctx)

    expect(MockedGPURenderer).toHaveBeenCalledTimes(1)
    const gpuInstance = MockedGPURenderer.mock.results[0].value as {
      updateParticles: jest.Mock
      render: jest.Mock
    }
    expect(gpuInstance.updateParticles).toHaveBeenCalled()
    expect(gpuInstance.render).toHaveBeenCalled()
    expect(mockClear).toHaveBeenCalled()
  })

  test('cleanup clears particles and disposes GPU renderer', () => {
    const cleanupMock = jest.fn()
    MockedGPURenderer.mockImplementation(() => ({
      updateParticles: jest.fn(),
      render: jest.fn(),
      cleanup: cleanupMock,
    }))

    const mockRenderer = {
      clear: jest.fn(),
      getContext: jest.fn().mockReturnValue({}),
      isWebGLSupported: jest.fn().mockReturnValue(true),
    }

    sharedSpy.mockReturnValue({
      isInitialized: jest.fn().mockReturnValue(true),
      getRenderer: jest.fn().mockReturnValue(mockRenderer),
    } as unknown as SharedWebGLContext)

    const canvas = document.createElement('canvas')
    canvas.width = 200
    canvas.height = 200

    const phase = new ExplosionPhase(200, 200, canvas)
    phase.init()

    // Populate some particles to ensure cleanup clears them
    expect((phase as any).sph.particles.length).toBeGreaterThan(0)

    phase.cleanup()

    expect((phase as any).sph.particles.length).toBe(0)
    const cleanupInstance = MockedGPURenderer.mock.results[0].value as { cleanup: jest.Mock }
    expect(cleanupInstance.cleanup).toHaveBeenCalled()
  })
})
