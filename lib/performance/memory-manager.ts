// Global Memory Manager for Monitoring and Emergency Cleanup

export type MemoryStatus = 'normal' | 'warning' | 'critical'
export type MemoryEventType = 'sample' | 'warning' | 'critical' | 'cleanup'

export interface MemorySample {
  timestamp: number
  usedMB: number
}

export interface MemoryEvent {
  type: MemoryEventType
  usedMB: number
  timestamp: number
  status: MemoryStatus
}

export interface MemoryStats {
  currentUsage: number
  averageUsage: number
  peakUsage: number
  warningCount: number
  criticalCount: number
  cleanupCount: number
  status: MemoryStatus
  leakSuspected: boolean
  lastEvent?: MemoryEvent
}

export class MemoryManager {
  private static instance: MemoryManager | null = null
  private checkInterval = 2000 // Check every 2 seconds by default
  private intervalId: number | null = null
  private criticalThreshold = 150 // MB
  private warningThreshold = 100 // MB
  private cleanupCallbacks: Array<() => void> = []

  private history: MemorySample[] = []
  private historyLimit = 300
  private warningEvents = 0
  private criticalEvents = 0
  private cleanupEvents = 0
  private status: MemoryStatus = 'normal'
  private currentUsage = 0
  private lastEvent: MemoryEvent | null = null

  private listeners: Array<(event: MemoryEvent) => void> = []
  private eventCooldown = 3000
  private lastWarningAt = 0
  private lastCriticalAt = 0

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
      this.pollMemory()
    }, this.checkInterval)
  }

  private pollMemory(): void {
    if (typeof performance === 'undefined' || !('memory' in performance)) {
      return
    }

    const memInfo = (performance as any).memory
    const usedMB = memInfo.usedJSHeapSize / 1048576
    this.processSample(usedMB)
  }

  processSample(usedMB: number): void {
    const timestamp = Date.now()
    this.recordSample(usedMB, timestamp)

    if (usedMB > this.criticalThreshold) {
      this.handleCritical(usedMB, timestamp)
    } else if (usedMB > this.warningThreshold) {
      this.handleWarning(usedMB, timestamp)
    } else {
      this.status = 'normal'
    }
  }

  private recordSample(usedMB: number, timestamp: number): void {
    this.currentUsage = usedMB
    this.history.push({ timestamp, usedMB })
    if (this.history.length > this.historyLimit) {
      this.history.shift()
    }
    this.emit({ type: 'sample', usedMB, timestamp, status: this.status })
  }

  private handleWarning(usedMB: number, timestamp: number): void {
    this.warningEvents++
    if (timestamp - this.lastWarningAt >= this.eventCooldown) {
      this.status = 'warning'
      this.lastWarningAt = timestamp
      this.emit({ type: 'warning', usedMB, timestamp, status: this.status })
    }
  }

  private handleCritical(usedMB: number, timestamp: number): void {
    this.criticalEvents++
    if (timestamp - this.lastCriticalAt >= this.eventCooldown) {
      this.status = 'critical'
      this.lastCriticalAt = timestamp
      this.emit({ type: 'critical', usedMB, timestamp, status: this.status })
    }
    this.emergencyCleanup(timestamp)
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

  private emergencyCleanup(timestamp: number = Date.now()): void {
    console.log('Performing emergency memory cleanup...')

    // Call all registered cleanup callbacks
    this.cleanupCallbacks.forEach((callback) => {
      try {
        callback()
      } catch (e) {
        console.error('Error in cleanup callback:', e)
      }
    })

    this.cleanupEvents++
    this.status = 'normal'
    this.emit({ type: 'cleanup', usedMB: this.currentUsage, timestamp, status: this.status })

    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
  }

  subscribe(listener: (event: MemoryEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private emit(event: MemoryEvent): void {
    this.lastEvent = event
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (e) {
        console.error('Memory subscriber error:', e)
      }
    })
  }

  getStats(): MemoryStats {
    const usageValues = this.history.map((sample) => sample.usedMB)
    const averageUsage = usageValues.length
      ? usageValues.reduce((sum, value) => sum + value, 0) / usageValues.length
      : 0
    const peakUsage = usageValues.length ? Math.max(...usageValues) : 0

    return {
      currentUsage: this.currentUsage,
      averageUsage,
      peakUsage,
      warningCount: this.warningEvents,
      criticalCount: this.criticalEvents,
      cleanupCount: this.cleanupEvents,
      status: this.status,
      leakSuspected: this.detectMemoryLeak(),
      lastEvent: this.lastEvent ?? undefined,
    }
  }

  getHistory(limit = this.history.length): MemorySample[] {
    if (limit >= this.history.length) {
      return [...this.history]
    }
    return this.history.slice(-limit)
  }

  setThresholds(warningMB: number, criticalMB: number): void {
    this.warningThreshold = warningMB
    this.criticalThreshold = criticalMB
  }

  getMemoryUsage(): number {
    return this.currentUsage
  }

  getStatus(): MemoryStatus {
    return this.status
  }

  destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.cleanupCallbacks = []
    this.listeners = []
    this.history = []
    this.warningEvents = 0
    this.criticalEvents = 0
    this.cleanupEvents = 0
    this.status = 'normal'
    this.currentUsage = 0
    this.lastEvent = null
  }

  detectMemoryLeak(): boolean {
    if (this.history.length < 60) return false

    const recent = this.history.slice(-30)
    const older = this.history.slice(0, 30)

    const recentAvg = recent.reduce((a, b) => a + b.usedMB, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b.usedMB, 0) / older.length

    // If memory increased by more than 20%, potential leak
    return recentAvg > olderAvg * 1.2
  }
}

