// Global Memory Manager for Monitoring and Emergency Cleanup
export class MemoryManager {
  private static instance: MemoryManager | null = null
  private checkInterval = 5000 // Check every 5 seconds
  private intervalId: number | null = null
  private criticalThreshold = 150 // MB
  private warningThreshold = 100 // MB
  private cleanupCallbacks: Array<() => void> = []
  
  private constructor() {
    this.startMonitoring()
  }
  
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager()
    }
    return MemoryManager.instance
  }
  
  private startMonitoring(): void {
    if (typeof window === 'undefined') return
    
    this.intervalId = window.setInterval(() => {
      this.checkMemory()
    }, this.checkInterval)
  }
  
  private checkMemory(): void {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      return
    }
    
    const memInfo = (performance as any).memory
    const usedMB = memInfo.usedJSHeapSize / 1048576
    
    if (usedMB > this.criticalThreshold) {
      console.warn(`Critical memory usage: ${usedMB.toFixed(2)}MB`)
      this.emergencyCleanup()
    } else if (usedMB > this.warningThreshold) {
      console.warn(`High memory usage: ${usedMB.toFixed(2)}MB`)
    }
  }
  
  registerCleanupCallback(callback: () => void): void {
    this.cleanupCallbacks.push(callback)
  }
  
  unregisterCleanupCallback(callback: () => void): void {
    const index = this.cleanupCallbacks.indexOf(callback)
    if (index > -1) {
      this.cleanupCallbacks.splice(index, 1)
    }
  }
  
  private emergencyCleanup(): void {
    console.log('Performing emergency memory cleanup...')
    
    // Call all registered cleanup callbacks
    this.cleanupCallbacks.forEach(callback => {
      try {
        callback()
      } catch (e) {
        console.error('Error in cleanup callback:', e)
      }
    })
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }
  
  getMemoryUsage(): number {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      return 0
    }
    
    const memInfo = (performance as any).memory
    return memInfo.usedJSHeapSize / 1048576 // Convert to MB
  }
  
  destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.cleanupCallbacks = []
  }
}

