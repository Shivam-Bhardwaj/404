// Adaptive Quality Scaling Based on Performance Metrics
import { PerformanceMonitor } from '../telemetry/monitor'
import { PerformanceConfig, DeviceTier } from '../types'
import { MemoryManager, MemoryEvent } from './memory-manager'

export class AdaptiveQualityScaler {
  private monitor: PerformanceMonitor
  private currentConfig: PerformanceConfig
  private baseConfig: PerformanceConfig
  private deviceTier: DeviceTier
  
  private memoryManager?: MemoryManager
  private unsubscribeMemory?: () => void
  private pendingMemoryEvent: MemoryEvent | null = null
  
  // Quality adjustment parameters
  private fpsTarget = 60
  private fpsThresholdLow = 50
  private fpsThresholdHigh = 65
  private adjustmentCooldown = 1000 // ms
  private lastAdjustment = 0
  
  // Quality levels
  private qualityLevels: PerformanceConfig[] = [
    // Level 0: Minimum
    { particleCount: 50, updateRate: 0.5, renderQuality: 0.5, enableEffects: false, enableShaders: false },
    // Level 1: Low
    { particleCount: 200, updateRate: 0.75, renderQuality: 0.75, enableEffects: true, enableShaders: false },
    // Level 2: Medium
    { particleCount: 1000, updateRate: 1.0, renderQuality: 1.0, enableEffects: true, enableShaders: true },
    // Level 3: High
    { particleCount: 5000, updateRate: 1.0, renderQuality: 1.0, enableEffects: true, enableShaders: true },
    // Level 4: Ultra
    { particleCount: 10000, updateRate: 1.0, renderQuality: 1.5, enableEffects: true, enableShaders: true },
  ]
  
  private currentLevel = 2
  
  constructor(monitor: PerformanceMonitor, deviceTier: DeviceTier, memoryManager?: MemoryManager) {
    this.monitor = monitor
    this.deviceTier = deviceTier
    
    // Set base config based on device tier
    switch (deviceTier) {
      case 'low':
        this.baseConfig = this.qualityLevels[0]
        this.currentLevel = 0
        this.fpsTarget = 30
        break
      case 'medium':
        this.baseConfig = this.qualityLevels[1]
        this.currentLevel = 1
        this.fpsTarget = 45
        break
      case 'high':
        this.baseConfig = this.qualityLevels[2]
        this.currentLevel = 2
        this.fpsTarget = 60
        break
      case 'ultra':
        this.baseConfig = this.qualityLevels[4]
        this.currentLevel = 4
        this.fpsTarget = 60
        break
    }
    
    this.currentConfig = { ...this.baseConfig }

    if (memoryManager) {
      this.attachMemoryManager(memoryManager)
    }
  }
  
  update(): void {
    const now = performance.now()
    
    const metrics = this.monitor.getMetrics()
    const avgFPS = this.monitor.getAverageFPS()
    
    if (this.pendingMemoryEvent) {
      this.applyMemoryEvent(this.pendingMemoryEvent, now)
      this.pendingMemoryEvent = null
    }
    
    if (now - this.lastAdjustment < this.adjustmentCooldown) return
    
    // Adjust quality based on performance
    if (avgFPS < this.fpsThresholdLow) {
      // Performance is poor, reduce quality
      this.decreaseQuality()
      this.lastAdjustment = now
    } else if (avgFPS > this.fpsThresholdHigh && this.currentLevel < this.qualityLevels.length - 1) {
      // Performance is good, try increasing quality
      this.increaseQuality()
      this.lastAdjustment = now
    }
    
    // Check thermal state
    if (metrics.thermalState === 'critical') {
      // Emergency quality reduction
      this.currentLevel = Math.max(0, this.currentLevel - 2)
      this.applyQualityLevel()
      this.lastAdjustment = now
    } else if (metrics.thermalState === 'throttling') {
      // Moderate quality reduction
      this.currentLevel = Math.max(0, this.currentLevel - 1)
      this.applyQualityLevel()
      this.lastAdjustment = now
    }
    
    // Check memory usage
    if (metrics.memoryUsage > 100) {
      // High memory usage, reduce particle count
      this.currentConfig.particleCount = Math.floor(this.currentConfig.particleCount * 0.8)
    }
  }
  
  private decreaseQuality(): void {
    if (this.currentLevel > 0) {
      this.currentLevel--
      this.applyQualityLevel()
    } else {
      // Already at minimum, reduce further
      this.currentConfig.particleCount = Math.floor(this.currentConfig.particleCount * 0.9)
      this.currentConfig.renderQuality = Math.max(0.3, this.currentConfig.renderQuality * 0.95)
    }
  }
  
  private increaseQuality(): void {
    if (this.currentLevel < this.qualityLevels.length - 1) {
      // Check if we can safely increase
      const metrics = this.monitor.getMetrics()
      if (metrics.thermalState === 'normal' && metrics.memoryUsage < 80) {
        this.currentLevel++
        this.applyQualityLevel()
      }
    }
  }
  
  private applyQualityLevel(): void {
    const targetConfig = this.qualityLevels[this.currentLevel]
    
    // Smooth transition
    this.currentConfig = {
      particleCount: Math.floor(targetConfig.particleCount),
      updateRate: targetConfig.updateRate,
      renderQuality: targetConfig.renderQuality,
      enableEffects: targetConfig.enableEffects,
      enableShaders: targetConfig.enableShaders,
    }
  }
  
  getConfig(): PerformanceConfig {
    return { ...this.currentConfig }
  }
  
  getQualityLevel(): number {
    return this.currentLevel
  }
  
  setTargetFPS(fps: number): void {
    this.fpsTarget = fps
    this.fpsThresholdLow = fps * 0.83
    this.fpsThresholdHigh = fps * 1.08
  }
  
  reset(): void {
    this.currentLevel = this.deviceTier === 'low' ? 0 : this.deviceTier === 'medium' ? 1 : 2
    this.currentConfig = { ...this.baseConfig }
    this.lastAdjustment = 0
    this.pendingMemoryEvent = null
  }

  attachMemoryManager(memoryManager: MemoryManager): void {
    if (this.unsubscribeMemory) {
      this.unsubscribeMemory()
    }
    this.memoryManager = memoryManager
    this.unsubscribeMemory = memoryManager.subscribe((event) => {
      if (event.type === 'sample') {
        return
      }
      this.pendingMemoryEvent = event
    })
  }

  private applyMemoryEvent(event: MemoryEvent, now: number): void {
    switch (event.type) {
      case 'critical':
        this.currentLevel = Math.max(0, this.currentLevel - 2)
        this.applyQualityLevel()
        this.currentConfig.enableEffects = false
        this.currentConfig.enableShaders = false
        this.currentConfig.particleCount = Math.floor(this.currentConfig.particleCount * 0.6)
        this.lastAdjustment = now
        break
      case 'warning':
        this.currentConfig.particleCount = Math.max(25, Math.floor(this.currentConfig.particleCount * 0.85))
        this.currentConfig.renderQuality = Math.max(0.5, this.currentConfig.renderQuality * 0.95)
        this.lastAdjustment = now
        break
      case 'cleanup':
        this.currentLevel = Math.max(0, this.currentLevel - 1)
        this.applyQualityLevel()
        this.lastAdjustment = now
        break
    }
  }

  dispose(): void {
    if (this.unsubscribeMemory) {
      this.unsubscribeMemory()
      this.unsubscribeMemory = undefined
    }
  }
}

