// Dynamic Quality Scaling Based on Performance
import { PerformanceConfig, DeviceTier } from '../types'

export class QualityScaler {
  private targetFPS = 60
  private fpsHistory: number[] = []
  private historySize = 30
  private currentQuality = 1.0
  private minQuality = 0.3
  private maxQuality = 1.5
  
  constructor(targetFPS = 60) {
    this.targetFPS = targetFPS
  }
  
  recordFrame(fps: number): void {
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > this.historySize) {
      this.fpsHistory.shift()
    }
  }
  
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return this.targetFPS
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
  }
  
  shouldAdjustQuality(): boolean {
    if (this.fpsHistory.length < this.historySize / 2) return false
    
    const avgFPS = this.getAverageFPS()
    const fpsRatio = avgFPS / this.targetFPS
    
    // Significant deviation from target
    return fpsRatio < 0.85 || fpsRatio > 1.15
  }
  
  adjustQuality(): number {
    const avgFPS = this.getAverageFPS()
    const fpsRatio = avgFPS / this.targetFPS
    
    if (fpsRatio < 0.85) {
      // Performance is poor, reduce quality
      this.currentQuality = Math.max(
        this.minQuality,
        this.currentQuality * 0.95
      )
    } else if (fpsRatio > 1.15 && this.currentQuality < this.maxQuality) {
      // Performance is good, increase quality
      this.currentQuality = Math.min(
        this.maxQuality,
        this.currentQuality * 1.02
      )
    }
    
    return this.currentQuality
  }
  
  getQualityMultiplier(): number {
    return this.currentQuality
  }
  
  getScaledParticleCount(baseCount: number): number {
    return Math.floor(baseCount * this.currentQuality)
  }
  
  getScaledResolution(baseWidth: number, baseHeight: number): [number, number] {
    return [
      Math.floor(baseWidth * this.currentQuality),
      Math.floor(baseHeight * this.currentQuality),
    ]
  }
  
  reset(): void {
    this.fpsHistory = []
    this.currentQuality = 1.0
  }
  
  getPerformanceStatus(): {
    avgFPS: number
    quality: number
    status: 'excellent' | 'good' | 'poor' | 'critical'
  } {
    const avgFPS = this.getAverageFPS()
    const fpsRatio = avgFPS / this.targetFPS
    
    let status: 'excellent' | 'good' | 'poor' | 'critical'
    if (fpsRatio >= 1.0) status = 'excellent'
    else if (fpsRatio >= 0.85) status = 'good'
    else if (fpsRatio >= 0.5) status = 'poor'
    else status = 'critical'
    
    return {
      avgFPS,
      quality: this.currentQuality,
      status,
    }
  }
}

