// Real-time Performance Monitoring and Telemetry
import { MemoryManager } from '../performance/memory-manager'

export interface PerformanceMetrics {
  fps: number
  frameTime: number
  memoryUsage: number
  particleCount: number
  drawCalls: number
  thermalState: 'normal' | 'throttling' | 'critical'
  batteryLevel?: number
}

export interface TelemetryData {
  timestamp: number
  metrics: PerformanceMetrics
}

export class PerformanceMonitor {
  private fpsHistory: number[] = []
  private frameTimeHistory: number[] = []
  private historySize = 60 // 1 second at 60fps
  private frameCount = 0
  private lastFrameTime = performance.now()
  private lastMemoryCheck = 0
  private memoryCheckInterval = 1000 // Check memory every second
  
  private currentFPS = 0
  private currentFrameTime = 0
  private currentMemory = 0
  
  // Thermal throttling detection
  private frameTimeVariance = 0
  private frameTimeMean = 0
  private thermalState: 'normal' | 'throttling' | 'critical' = 'normal'
  
  // Algorithm-specific metrics
  private particleCount = 0
  private drawCalls = 0
  
  recordFrame(): void {
    const now = performance.now()
    const frameTime = now - this.lastFrameTime
    this.lastFrameTime = now
    
    this.frameCount++
    
    // Calculate FPS
    const fps = 1000 / frameTime
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > this.historySize) {
      this.fpsHistory.shift()
    }
    this.currentFPS = this.getAverageFPS()
    
    // Record frame time
    this.frameTimeHistory.push(frameTime)
    if (this.frameTimeHistory.length > this.historySize) {
      this.frameTimeHistory.shift()
    }
    this.currentFrameTime = frameTime
    
    // Check memory periodically
    if (now - this.lastMemoryCheck > this.memoryCheckInterval) {
      this.checkMemory()
      this.lastMemoryCheck = now
    }
    
    // Detect thermal throttling
    this.detectThermalThrottling()
  }
  
  private checkMemory(): void {
    let usedMB = 0
    
    // Try Chrome's performance.memory API first
    if ('memory' in performance) {
      try {
        const memInfo = (performance as any).memory
        if (memInfo && typeof memInfo.usedJSHeapSize === 'number') {
          usedMB = memInfo.usedJSHeapSize / 1048576
          MemoryManager.getInstance().processSample(usedMB)
          this.currentMemory = usedMB
          return
        }
      } catch (e) {
        // Fall through to fallback methods
      }
    }
    
    // Fallback: Try navigator.deviceMemory API (if available)
    if ('deviceMemory' in navigator && typeof (navigator as any).deviceMemory === 'number') {
      const deviceMemoryGB = (navigator as any).deviceMemory
      // Estimate usage as a percentage of device memory (rough estimate)
      // This is just a fallback indicator, not accurate
      const memoryManager = MemoryManager.getInstance()
      const stats = memoryManager.getStats()
      if (stats.currentUsage > 0) {
        // Use cached value if available
        this.currentMemory = stats.currentUsage
        return
      }
      // If no cached value, estimate based on device memory
      // Assume we're using a small percentage as a placeholder
      usedMB = deviceMemoryGB * 1024 * 0.1 // 10% estimate
      memoryManager.processSample(usedMB)
      this.currentMemory = usedMB
      return
    }
    
    // Final fallback: Use MemoryManager's cached value or estimate
    const memoryManager = MemoryManager.getInstance()
    const stats = memoryManager.getStats()
    if (stats.currentUsage > 0) {
      this.currentMemory = stats.currentUsage
    } else {
      // Last resort: estimate based on typical web app memory usage
      // This is a rough estimate and won't be accurate
      usedMB = 50 // Default estimate of 50MB
      memoryManager.processSample(usedMB)
      this.currentMemory = usedMB
    }
  }
  
  private detectThermalThrottling(): void {
    if (this.frameTimeHistory.length < 30) return
    
    // Calculate mean and variance
    const mean = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
    const variance = this.frameTimeHistory.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2)
    }, 0) / this.frameTimeHistory.length
    
    this.frameTimeMean = mean
    this.frameTimeVariance = variance
    
    // Check for increasing variance (thermal throttling indicator)
    const stdDev = Math.sqrt(variance)
    const coefficientOfVariation = stdDev / mean
    
    if (coefficientOfVariation > 0.3 && mean > 20) {
      this.thermalState = 'critical'
    } else if (coefficientOfVariation > 0.2 && mean > 18) {
      this.thermalState = 'throttling'
    } else {
      this.thermalState = 'normal'
    }
  }
  
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 60
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
  }
  
  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 16.67
    return this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length
  }
  
  getAverageMemory(): number {
    return MemoryManager.getInstance().getStats().averageUsage
  }
  
  setParticleCount(count: number): void {
    this.particleCount = count
  }
  
  setDrawCalls(count: number): void {
    this.drawCalls = count
  }
  
  getMetrics(): PerformanceMetrics {
    return {
      fps: this.currentFPS,
      frameTime: this.currentFrameTime,
      memoryUsage: this.currentMemory,
      particleCount: this.particleCount,
      drawCalls: this.drawCalls,
      thermalState: this.thermalState,
      batteryLevel: this.getBatteryLevel(),
    }
  }
  
  private getBatteryLevel(): number | undefined {
    if ('getBattery' in navigator) {
      // Battery API is deprecated but still available
      return undefined
    }
    return undefined
  }
  
  // Check for memory leaks
  detectMemoryLeak(): boolean {
    return MemoryManager.getInstance().detectMemoryLeak()
  }
  
  // Get performance score (0-100)
  getPerformanceScore(): number {
    // FPS score: 60 FPS = 100%, scales down linearly
    const fpsScore = Math.min(100, Math.max(0, (this.currentFPS / 60) * 100))
    
    // Frame time score: 16.67ms = 100%, penalize longer frame times
    // Cap at 100ms frame time (6 FPS) for scoring purposes
    const targetFrameTime = 16.67
    const maxFrameTime = 100.0
    const clampedFrameTime = Math.min(this.currentFrameTime, maxFrameTime)
    const frameTimeScore = Math.max(0, 100 - ((clampedFrameTime - targetFrameTime) / targetFrameTime) * 100)
    
    // Memory score: < 50MB = 100%, penalize > 100MB
    const memoryScore = Math.max(0, 100 - ((this.currentMemory - 50) / 50) * 100)
    
    // Weighted average: FPS is most important, then frame time, then memory
    const score = (fpsScore * 0.5 + frameTimeScore * 0.3 + memoryScore * 0.2)
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score))
  }
  
  reset(): void {
    this.fpsHistory = []
    this.frameTimeHistory = []
    this.frameCount = 0
    this.thermalState = 'normal'
    this.particleCount = 0
    this.drawCalls = 0
  }
}

