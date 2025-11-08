import { SharedWebGLContext } from '@/lib/rendering/shared-webgl-context'

describe('SharedWebGLContext', () => {
  const originalWarn = console.warn
  let originalGetContext: any

  beforeEach(() => {
    ;(SharedWebGLContext as any).instance = null
    console.warn = jest.fn()
    originalGetContext = HTMLCanvasElement.prototype.getContext
  })

  afterEach(() => {
    console.warn = originalWarn
    HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  test('returns the same singleton instance', () => {
    const a = SharedWebGLContext.getInstance()
    const b = SharedWebGLContext.getInstance()

    expect(a).toBe(b)
  })

  test('initializes once and reuses renderer for the same canvas', () => {
    const canvas = document.createElement('canvas')
    const glStub = {} as WebGL2RenderingContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(glStub)

    const shared = SharedWebGLContext.getInstance()
    const renderer = { name: 'rendererA' }

    const firstInit = shared.initialize(canvas, renderer)
    expect(firstInit).toBe(true)
    expect(shared.getContext()).toBe(glStub)
    expect(shared.getRenderer()).toBe(renderer)

    // Re-initializing with same canvas should succeed and retain renderer
    const rendererB = { name: 'rendererB' }
    const secondInit = shared.initialize(canvas, rendererB)
    expect(secondInit).toBe(true)
    expect(shared.getRenderer()).toBe(renderer)
  })

  test('rejects initialization on a different canvas once context exists', () => {
    const canvasA = document.createElement('canvas')
    const canvasB = document.createElement('canvas')
    const glStub = {} as WebGL2RenderingContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(glStub)

    const shared = SharedWebGLContext.getInstance()
    const success = shared.initialize(canvasA, { id: 'A' })
    expect(success).toBe(true)

    const failure = shared.initialize(canvasB, { id: 'B' })
    expect(failure).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })

  test('fails initialization when context acquisition returns null', () => {
    const canvas = document.createElement('canvas')
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(null)

    const shared = SharedWebGLContext.getInstance()
    const result = shared.initialize(canvas, { id: 'renderer' })

    expect(result).toBe(false)
    expect(shared.isInitialized()).toBe(false)
    expect(shared.getContext()).toBeNull()
  })
})
