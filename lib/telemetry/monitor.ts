// Real-time Performance Monitoring and Telemetry
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
  private memoryHistory: number[] = []
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
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      const usedMB = memInfo.usedJSHeapSize / 1048576
      this.memoryHistory.push(usedMB)
      if (this.memoryHistory.length > this.historySize) {
        this.memoryHistory.shift()
      }
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
    if (this.memoryHistory.length === 0) return 0
    return this.memoryHistory.reduce((a, b) => a + b, 0) / this.memoryHistory.length
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
    if (this.memoryHistory.length < 60) return false
    
    const recent = this.memoryHistory.slice(-30)
    const older = this.memoryHistory.slice(0, 30)
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    
    // If memory increased by more than 20%, potential leak
    return recentAvg > olderAvg * 1.2
  }
  
  // Get performance score (0-100)
  getPerformanceScore(): number {
    const fpsScore = Math.min(100, (this.currentFPS / 60) * 100)
    const frameTimeScore = Math.max(0, 100 - ((this.currentFrameTime - 16.67) / 16.67) * 100)
    const memoryScore = Math.max(0, 100 - (this.currentMemory / 100) * 100) // Penalize > 100MB
    
    return (fpsScore * 0.5 + frameTimeScore * 0.3 + memoryScore * 0.2)
  }
  
  reset(): void {
    this.fpsHistory = []
    this.frameTimeHistory = []
    this.memoryHistory = []
    this.frameCount = 0
    this.thermalState = 'normal'
    this.particleCount = 0
    this.drawCalls = 0
  }
}

