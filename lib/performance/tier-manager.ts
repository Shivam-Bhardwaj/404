// Performance Tiers with Automatic Quality Scaling
// Dynamically adjusts simulation quality based on performance metrics

export interface PerformanceTier {
  name: string
  particleCount: number
  updateRate: number // Hz
  renderQuality: number // 0-1
  enableInterpolation: boolean
  enablePrediction: boolean
  textureSize: number
}

export class PerformanceTierManager {
  private tiers: PerformanceTier[] = [
    {
      name: 'ultra',
      particleCount: 100000,
      updateRate: 60,
      renderQuality: 1.0,
      enableInterpolation: true,
      enablePrediction: true,
      textureSize: 512,
    },
    {
      name: 'high',
      particleCount: 50000,
      updateRate: 60,
      renderQuality: 0.8,
      enableInterpolation: true,
      enablePrediction: true,
      textureSize: 256,
    },
    {
      name: 'medium',
      particleCount: 20000,
      updateRate: 30,
      renderQuality: 0.6,
      enableInterpolation: true,
      enablePrediction: false,
      textureSize: 256,
    },
    {
      name: 'low',
      particleCount: 10000,
      updateRate: 30,
      renderQuality: 0.4,
      enableInterpolation: false,
      enablePrediction: false,
      textureSize: 128,
    },
    {
      name: 'minimal',
      particleCount: 5000,
      updateRate: 15,
      renderQuality: 0.2,
      enableInterpolation: false,
      enablePrediction: false,
      textureSize: 128,
    },
  ]
  
  private currentTierIndex = 2 // Start at medium
  private frameTimes: number[] = []
  private maxFrameTimeHistory = 60
  private targetFPS = 60
  private fpsHistory: number[] = []
  private maxFPSHistory = 30
  
  getCurrentTier(): PerformanceTier {
    return this.tiers[this.currentTierIndex]
  }
  
  recordFrameTime(frameTime: number): void {
    this.frameTimes.push(frameTime)
    if (this.frameTimes.length > this.maxFrameTimeHistory) {
      this.frameTimes.shift()
    }
    
    const fps = 1000 / frameTime
    this.fpsHistory.push(fps)
    if (this.fpsHistory.length > this.maxFPSHistory) {
      this.fpsHistory.shift()
    }
  }
  
  updateTier(): PerformanceTier {
    if (this.frameTimes.length < 10) {
      return this.getCurrentTier()
    }
    
    // Calculate average FPS
    const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length
    
    // Calculate frame time variance (jitter)
    const variance = this.frameTimes.reduce((sum, t) => {
      return sum + Math.pow(t - avgFrameTime, 2)
    }, 0) / this.frameTimes.length
    const jitter = Math.sqrt(variance)
    
    // Determine if we need to change tier
    const targetFrameTime = 1000 / this.targetFPS
    const performanceRatio = avgFPS / this.targetFPS
    
    // If consistently above target, try higher tier
    if (performanceRatio > 1.1 && avgFrameTime < targetFrameTime * 0.9 && jitter < targetFrameTime * 0.1) {
      if (this.currentTierIndex > 0) {
        this.currentTierIndex--
        console.log(`[Performance] Upgrading to tier: ${this.tiers[this.currentTierIndex].name}`)
      }
    }
    // If consistently below target or high jitter, downgrade
    else if (performanceRatio < 0.9 || avgFrameTime > targetFrameTime * 1.2 || jitter > targetFrameTime * 0.3) {
      if (this.currentTierIndex < this.tiers.length - 1) {
        this.currentTierIndex++
        console.log(`[Performance] Downgrading to tier: ${this.tiers[this.currentTierIndex].name}`)
      }
    }
    
    return this.getCurrentTier()
  }
  
  getRecommendedParticleCount(): number {
    return this.getCurrentTier().particleCount
  }
  
  getRecommendedUpdateRate(): number {
    return this.getCurrentTier().updateRate
  }
  
  shouldUseInterpolation(): boolean {
    return this.getCurrentTier().enableInterpolation
  }
  
  shouldUsePrediction(): boolean {
    return this.getCurrentTier().enablePrediction
  }
  
  getRenderQuality(): number {
    return this.getCurrentTier().renderQuality
  }
  
  reset(): void {
    this.frameTimes = []
    this.fpsHistory = []
    this.currentTierIndex = 2 // Reset to medium
  }
  
  // Detect device capabilities
  detectDeviceCapabilities(): PerformanceTier {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    
    if (!gl) {
      return this.tiers[this.tiers.length - 1] // Minimal if no WebGL
    }
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : ''
    
    // Detect GPU capabilities
    const isHighEndGPU = /nvidia|amd|radeon|geforce|rtx|gtx/i.test(renderer)
    const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent)
    const isLowEnd = /intel.*hd|mali|adreno.*3/i.test(renderer)
    
    // Estimate based on device
    if (isHighEndGPU && !isMobile) {
      this.currentTierIndex = 0 // Ultra
    } else if (!isLowEnd && !isMobile) {
      this.currentTierIndex = 1 // High
    } else if (isMobile && !isLowEnd) {
      this.currentTierIndex = 2 // Medium
    } else {
      this.currentTierIndex = 3 // Low
    }
    
    console.log(`[Performance] Detected device: ${renderer}, Selected tier: ${this.tiers[this.currentTierIndex].name}`)
    
    return this.getCurrentTier()
  }
}

// Adaptive quality scaler that adjusts in real-time
export class AdaptiveQualityScaler {
  private tierManager: PerformanceTierManager
  private currentParticleCount: number
  private currentUpdateRate: number
  private adaptationInterval = 2000 // Adapt every 2 seconds
  private lastAdaptationTime = 0
  
  constructor(initialParticleCount: number = 20000) {
    this.tierManager = new PerformanceTierManager()
    this.currentParticleCount = initialParticleCount
    this.currentUpdateRate = 60
    
    // Detect device on initialization
    this.tierManager.detectDeviceCapabilities()
    const tier = this.tierManager.getCurrentTier()
    this.currentParticleCount = tier.particleCount
    this.currentUpdateRate = tier.updateRate
  }
  
  update(currentTime: number, frameTime: number): {
    particleCount: number
    updateRate: number
    renderQuality: number
    enableInterpolation: boolean
    enablePrediction: boolean
  } {
    this.tierManager.recordFrameTime(frameTime)
    
    // Adapt tier periodically
    if (currentTime - this.lastAdaptationTime > this.adaptationInterval) {
      const tier = this.tierManager.updateTier()
      
      // Smoothly transition particle count
      const targetCount = tier.particleCount
      const diff = targetCount - this.currentParticleCount
      this.currentParticleCount += Math.sign(diff) * Math.min(Math.abs(diff), targetCount * 0.1)
      
      this.currentUpdateRate = tier.updateRate
      this.lastAdaptationTime = currentTime
    }
    
    return {
      particleCount: Math.round(this.currentParticleCount),
      updateRate: this.currentUpdateRate,
      renderQuality: this.tierManager.getRenderQuality(),
      enableInterpolation: this.tierManager.shouldUseInterpolation(),
      enablePrediction: this.tierManager.shouldUsePrediction(),
    }
  }
  
  getCurrentTier(): PerformanceTier {
    return this.tierManager.getCurrentTier()
  }
  
  reset(): void {
    this.tierManager.reset()
    const tier = this.tierManager.getCurrentTier()
    this.currentParticleCount = tier.particleCount
    this.currentUpdateRate = tier.updateRate
  }
}

