import { MemoryManager, MemoryEvent } from '@/lib/performance/memory-manager'

describe('MemoryManager', () => {
  let manager: MemoryManager
  const originalConsoleLog = console.log
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.useFakeTimers()
    ;(MemoryManager as any).instance = null
    console.log = jest.fn()
    console.error = jest.fn()
    manager = MemoryManager.getInstance()
  })

  afterEach(() => {
    manager.destroy()
    jest.useRealTimers()
    console.log = originalConsoleLog
    console.error = originalConsoleError
    delete (global as any).gc
    if ((global.performance as any).memory) {
      delete (global.performance as any).memory
    }
  })

  test('records samples and exposes stats', () => {
    manager.processSample(80)
    manager.processSample(120)

    const stats = manager.getStats()
    expect(stats.currentUsage).toBe(120)
    expect(stats.averageUsage).toBeGreaterThan(80)
    expect(manager.getHistory().length).toBe(2)
  })

  test('emits warning events when exceeding threshold', () => {
    const events: MemoryEvent[] = []
    manager.subscribe((event) => events.push(event))

    manager.processSample(110)

    const warningEvent = events.find((event) => event.type === 'warning')
    expect(warningEvent).toBeDefined()
    expect(manager.getStats().warningCount).toBeGreaterThan(0)
    expect(manager.getStatus()).toBe('warning')
  })

  test('emits critical event and triggers cleanup callbacks', () => {
    const events: MemoryEvent[] = []
    const cleanup = jest.fn()
    manager.subscribe((event) => events.push(event))
    manager.registerCleanupCallback(cleanup)
    ;(global as any).gc = jest.fn()

    manager.processSample(200)

    const criticalEvent = events.find((event) => event.type === 'critical')
    const cleanupEvent = events.find((event) => event.type === 'cleanup')
    expect(criticalEvent).toBeDefined()
    expect(cleanupEvent).toBeDefined()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect((global as any).gc).toHaveBeenCalledTimes(1)
    expect(manager.getStats().criticalCount).toBe(1)
  })

  test('returns 0 usage before sampling', () => {
    expect(manager.getMemoryUsage()).toBe(0)
  })

  test('unregisters callbacks and clears internal state on destroy', () => {
    const cleanup = jest.fn()
    manager.registerCleanupCallback(cleanup)
    manager.unregisterCleanupCallback(cleanup)

    manager.destroy()

    expect((manager as any).cleanupCallbacks).toHaveLength(0)
    expect((manager as any).intervalId).toBeNull()
    expect(manager.getHistory().length).toBe(0)
    expect(manager.getStats().currentUsage).toBe(0)
  })
})
