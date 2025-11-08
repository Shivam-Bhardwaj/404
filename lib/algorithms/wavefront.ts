// Wavefront Propagation for Character Materialization
import { Vec2 } from '../types'
import { distance } from '../utils/math'

export class WavefrontPropagation {
  private waveSpeed = 50 // pixels per second
  private amplitude = 1.0
  private frequency = 0.1
  private damping = 0.95
  
  // Wave equation: ∂²u/∂t² = c²∇²u + f(x,y,t)
  computeWave(
    position: Vec2,
    source: Vec2,
    time: number,
    width: number,
    height: number
  ): number {
    const dx = position.x - source.x
    const dy = position.y - source.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    // Wave propagation
    const waveFront = dist - this.waveSpeed * time
    
    if (waveFront > 0) {
      // Wave hasn't reached this point yet
      return 0
    }
    
    // Wave amplitude with damping
    const amplitude = this.amplitude * Math.exp(-dist * this.frequency)
    
    // Sinusoidal wave
    const wave = Math.sin(waveFront * this.frequency) * amplitude
    
    // Apply damping over time
    return wave * Math.pow(this.damping, time * 0.1)
  }
  
  // Check if point should materialize (wave amplitude exceeds threshold)
  shouldMaterialize(
    position: Vec2,
    source: Vec2,
    time: number,
    threshold: number = 0.3
  ): boolean {
    const waveValue = this.computeWave(position, source, time, 0, 0)
    return Math.abs(waveValue) > threshold
  }
  
  // Get materialization probability (0-1)
  getMaterializationProbability(
    position: Vec2,
    source: Vec2,
    time: number
  ): number {
    const waveValue = this.computeWave(position, source, time, 0, 0)
    return Math.max(0, Math.min(1, (waveValue + 1) / 2))
  }
}

