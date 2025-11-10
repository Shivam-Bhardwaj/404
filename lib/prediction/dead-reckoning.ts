// Dead Reckoning and Velocity-Based Prediction
// Smooths motion between WebSocket updates using velocity extrapolation

import { StreamedBoidState } from '../api/streaming'

export interface PredictedBoidState {
  x: number
  y: number
  vx: number
  vy: number
  timestamp: number
  predicted: boolean
}

export class DeadReckoningPredictor {
  private lastStates: Map<number, StreamedBoidState> = new Map()
  private lastUpdateTime: number = 0
  private smoothingFactor = 0.1
  private maxPredictionTime = 100 // ms
  
  constructor(smoothingFactor: number = 0.1) {
    this.smoothingFactor = smoothingFactor
  }
  
  update(states: StreamedBoidState[], currentTime: number): PredictedBoidState[] {
    const predicted: PredictedBoidState[] = []
    const dt = this.lastUpdateTime > 0 ? currentTime - this.lastUpdateTime : 16 // Default 16ms
    
    for (let i = 0; i < states.length; i++) {
      const state = states[i]
      const lastState = this.lastStates.get(i)
      
      let predictedState: PredictedBoidState
      
      if (lastState && dt > 0 && dt < this.maxPredictionTime) {
        // Calculate velocity from last state if not provided
        const vx = state.vx !== undefined ? state.vx : (state.x - lastState.x) / dt
        const vy = state.vy !== undefined ? state.vy : (state.y - lastState.y) / dt
        
        // Smooth velocity using exponential moving average
        const smoothedVx = lastState.vx !== undefined 
          ? lastState.vx * (1 - this.smoothingFactor) + vx * this.smoothingFactor
          : vx
        const smoothedVy = lastState.vy !== undefined
          ? lastState.vy * (1 - this.smoothingFactor) + vy * this.smoothingFactor
          : vy
        
        // Predict position using velocity
        const predictionTime = currentTime - state.timestamp
        const predictedX = state.x + smoothedVx * predictionTime
        const predictedY = state.y + smoothedVy * predictionTime
        
        predictedState = {
          x: predictedX,
          y: predictedY,
          vx: smoothedVx,
          vy: smoothedVy,
          timestamp: currentTime,
          predicted: predictionTime > 0,
        }
      } else {
        // First update or too much time passed - use state as-is
        predictedState = {
          x: state.x,
          y: state.y,
          vx: state.vx || 0,
          vy: state.vy || 0,
          timestamp: state.timestamp,
          predicted: false,
        }
      }
      
      // Store for next update
      this.lastStates.set(i, {
        x: state.x,
        y: state.y,
        vx: predictedState.vx,
        vy: predictedState.vy,
        timestamp: state.timestamp,
      })
      
      predicted.push(predictedState)
    }
    
    this.lastUpdateTime = currentTime
    
    // Clean up old states if array shrunk
    if (this.lastStates.size > states.length) {
      for (let i = states.length; i < this.lastStates.size; i++) {
        this.lastStates.delete(i)
      }
    }
    
    return predicted
  }
  
  reset(): void {
    this.lastStates.clear()
    this.lastUpdateTime = 0
  }
  
  setSmoothingFactor(factor: number): void {
    this.smoothingFactor = Math.max(0, Math.min(1, factor))
  }
}

// Cubic spline interpolation for smooth motion
export class CubicSplineInterpolator {
  private history: Array<{ state: StreamedBoidState; time: number }> = []
  private maxHistory = 4
  
  addState(state: StreamedBoidState, time: number): void {
    this.history.push({ state, time })
    
    // Keep only recent history
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
  }
  
  interpolate(targetTime: number): StreamedBoidState | null {
    if (this.history.length < 2) {
      return this.history.length === 1 ? this.history[0].state : null
    }
    
    // Find surrounding points
    let before: { state: StreamedBoidState; time: number } | null = null
    let after: { state: StreamedBoidState; time: number } | null = null
    
    for (let i = 0; i < this.history.length - 1; i++) {
      if (this.history[i].time <= targetTime && this.history[i + 1].time >= targetTime) {
        before = this.history[i]
        after = this.history[i + 1]
        break
      }
    }
    
    if (!before || !after) {
      // Extrapolate from most recent
      const latest = this.history[this.history.length - 1]
      const dt = targetTime - latest.time
      return {
        x: latest.state.x + (latest.state.vx || 0) * dt,
        y: latest.state.y + (latest.state.vy || 0) * dt,
        vx: latest.state.vx || 0,
        vy: latest.state.vy || 0,
        timestamp: targetTime,
      }
    }
    
    // Cubic Hermite spline interpolation
    const t = (targetTime - before.time) / (after.time - before.time)
    const t2 = t * t
    const t3 = t2 * t
    
    // Hermite basis functions
    const h1 = 2 * t3 - 3 * t2 + 1
    const h2 = -2 * t3 + 3 * t2
    const h3 = t3 - 2 * t2 + t
    const h4 = t3 - t2
    
    // Tangents (velocities)
    const m1x = before.state.vx || 0
    const m1y = before.state.vy || 0
    const m2x = after.state.vx || 0
    const m2y = after.state.vy || 0
    
    const dt = after.time - before.time
    
    // Interpolate position
    const x = h1 * before.state.x + h2 * after.state.x + h3 * m1x * dt + h4 * m2x * dt
    const y = h1 * before.state.y + h2 * after.state.y + h3 * m1y * dt + h4 * m2y * dt
    
    // Interpolate velocity
    const vx = (1 - t) * m1x + t * m2x
    const vy = (1 - t) * m1y + t * m2y
    
    return {
      x,
      y,
      vx,
      vy,
      timestamp: targetTime,
    }
  }
  
  reset(): void {
    this.history = []
  }
}

// Adaptive blending between prediction methods
export class AdaptiveBlender {
  private predictor: DeadReckoningPredictor
  private interpolator: CubicSplineInterpolator
  private latency: number = 0
  private jitter: number = 0
  private blendFactor: number = 0.5
  
  constructor() {
    this.predictor = new DeadReckoningPredictor(0.1)
    this.interpolator = new CubicSplineInterpolator()
  }
  
  update(states: StreamedBoidState[], currentTime: number): PredictedBoidState[] {
    // Update latency and jitter estimates
    this.updateNetworkMetrics(states, currentTime)
    
    // Adapt blend factor based on network conditions
    if (this.latency > 100 || this.jitter > 50) {
      // High latency/jitter - favor prediction
      this.blendFactor = Math.min(0.8, this.blendFactor + 0.1)
    } else {
      // Low latency/jitter - favor interpolation
      this.blendFactor = Math.max(0.2, this.blendFactor - 0.1)
    }
    
    // Get predictions from both methods
    const predicted = this.predictor.update(states, currentTime)
    
    // Blend with interpolation if we have history
    const blended: PredictedBoidState[] = []
    
    for (let i = 0; i < states.length; i++) {
      const state = states[i]
      this.interpolator.addState(state, state.timestamp)
      
      const interpolated = this.interpolator.interpolate(currentTime)
      
      if (interpolated && this.blendFactor < 0.7) {
        // Blend prediction and interpolation
        const pred = predicted[i]
        blended.push({
          x: pred.x * this.blendFactor + interpolated.x * (1 - this.blendFactor),
          y: pred.y * this.blendFactor + interpolated.y * (1 - this.blendFactor),
          vx: pred.vx * this.blendFactor + interpolated.vx * (1 - this.blendFactor),
          vy: pred.vy * this.blendFactor + interpolated.vy * (1 - this.blendFactor),
          timestamp: currentTime,
          predicted: true,
        })
      } else {
        // Use prediction only
        blended.push(predicted[i])
      }
    }
    
    return blended
  }
  
  private updateNetworkMetrics(states: StreamedBoidState[], currentTime: number): void {
    if (states.length === 0) return
    
    // Calculate average latency
    let totalLatency = 0
    for (const state of states) {
      totalLatency += currentTime - state.timestamp
    }
    this.latency = totalLatency / states.length
    
    // Estimate jitter (variance in timestamps)
    const timestamps = states.map(s => s.timestamp)
    const mean = timestamps.reduce((a, b) => a + b, 0) / timestamps.length
    const variance = timestamps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / timestamps.length
    this.jitter = Math.sqrt(variance)
  }
  
  reset(): void {
    this.predictor.reset()
    this.interpolator.reset()
    this.latency = 0
    this.jitter = 0
    this.blendFactor = 0.5
  }
}

