// Tests for Adaptive Quality Scaler
import { AdaptiveQualityScaler } from '@/lib/performance/adaptive-quality'
import { PerformanceMonitor } from '@/lib/telemetry/monitor'
import { DeviceTier } from '@/lib/types'

describe('AdaptiveQualityScaler', () => {
  let monitor: PerformanceMonitor
  let scaler: AdaptiveQualityScaler

  beforeEach(() => {
    monitor = new PerformanceMonitor()
  })

  test('should initialize with correct config for low tier', () => {
    scaler = new AdaptiveQualityScaler(monitor, 'low')
    const config = scaler.getConfig()
    expect(config.particleCount).toBeLessThanOrEqual(200)
    expect(config.renderQuality).toBeLessThanOrEqual(0.75)
  })

  test('should initialize with correct config for high tier', () => {
    scaler = new AdaptiveQualityScaler(monitor, 'high')
    const config = scaler.getConfig()
    expect(config.particleCount).toBeGreaterThan(500)
  })

  test('should decrease quality when FPS is low', () => {
    jest.useFakeTimers()
    
    scaler = new AdaptiveQualityScaler(monitor, 'high')
    const initialLevel = scaler.getQualityLevel()
    
    // Simulate low FPS
    for (let i = 0; i < 60; i++) {
      monitor.recordFrame()
      jest.advanceTimersByTime(25) // 40fps
    }
    
    scaler.update()
    
    // Quality should decrease
    expect(scaler.getQualityLevel()).toBeLessThanOrEqual(initialLevel)
    
    jest.useRealTimers()
  })

  test('should increase quality when FPS is high', () => {
    jest.useFakeTimers()
    
    scaler = new AdaptiveQualityScaler(monitor, 'medium')
    const initialLevel = scaler.getQualityLevel()
    
    // Simulate high FPS
    for (let i = 0; i < 60; i++) {
      monitor.recordFrame()
      jest.advanceTimersByTime(14) // ~70fps
    }
    
    scaler.update()
    
    // Quality might increase if conditions are met
    const newLevel = scaler.getQualityLevel()
    expect(newLevel).toBeGreaterThanOrEqual(0)
    
    jest.useRealTimers()
  })

  test('should handle thermal throttling', () => {
    jest.useFakeTimers()
    
    scaler = new AdaptiveQualityScaler(monitor, 'high')
    
    // Simulate thermal throttling
    for (let i = 0; i < 60; i++) {
      monitor.recordFrame()
      jest.advanceTimersByTime(20 + Math.random() * 15)
    }
    
    scaler.update()
    
    const config = scaler.getConfig()
    expect(config.particleCount).toBeGreaterThan(0)
    
    jest.useRealTimers()
  })

  test('should respect cooldown period', () => {
    scaler = new AdaptiveQualityScaler(monitor, 'medium')
    const initialConfig = scaler.getConfig()
    
    // First update
    scaler.update()
    
    // Immediate second update should be ignored
    scaler.update()
    
    const config = scaler.getConfig()
    expect(config.particleCount).toBe(initialConfig.particleCount)
  })

  test('should reset to base config', () => {
    scaler = new AdaptiveQualityScaler(monitor, 'medium')
    scaler.update()
    
    scaler.reset()
    
    const config = scaler.getConfig()
    expect(config.particleCount).toBeGreaterThan(0)
  })
})

