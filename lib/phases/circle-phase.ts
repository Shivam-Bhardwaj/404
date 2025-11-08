// Circle Closing Animation with Signed Distance Fields
import { AnimationPhase } from '../types'
import { COLORS } from '../constants'
import { lerp } from '../utils/math'

export class CirclePhase implements AnimationPhase {
  name: 'circle' = 'circle'
  duration = 1500
  progress = 0
  isComplete = false
  
  private centerX = 0
  private centerY = 0
  private maxRadius = 0
  
  constructor(width: number, height: number) {
    this.centerX = width / 2
    this.centerY = height / 2
    this.maxRadius = Math.max(width, height) * 0.7
  }
  
  init(): void {
    this.progress = 0
    this.isComplete = false
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }
  
  // Signed Distance Field for perfect circle
  private circleSDF(x: number, y: number, cx: number, cy: number, radius: number): number {
    const dx = x - cx
    const dy = y - cy
    return Math.sqrt(dx * dx + dy * dy) - radius
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    const width = ctx.canvas.width
    const height = ctx.canvas.height
    
    // Easing function for smooth closing
    const easeInOut = (t: number) => t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2
    
    const easedProgress = easeInOut(this.progress)
    const currentRadius = lerp(this.maxRadius, 0, easedProgress)
    
    // Fill background
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, width, height)
    
    // Draw circle with SDF for perfect anti-aliasing
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data
    
    // Sample step for performance (can be 1 for best quality)
    const step = 2
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const dist = this.circleSDF(x, y, this.centerX, this.centerY, currentRadius)
        
        // Smooth alpha based on distance
        let alpha = 0
        if (dist <= 0) {
          alpha = 255 // Inside circle
        } else if (dist < 2) {
          // Anti-aliasing at edge
          alpha = Math.floor((1 - dist / 2) * 255)
        }
        
        // Fill pixel and neighbors for performance
        for (let dy = 0; dy < step; dy++) {
          for (let dx = 0; dx < step; dx++) {
            const px = x + dx
            const py = y + dy
            if (px < width && py < height) {
              const idx = (py * width + px) * 4
              data[idx] = 255     // R
              data[idx + 1] = 255 // G
              data[idx + 2] = 255 // B
              data[idx + 3] = alpha
            }
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    
    // Add glow effect
    if (currentRadius > 10) {
      ctx.globalAlpha = 0.3
      ctx.fillStyle = COLORS.white
      ctx.shadowColor = COLORS.white
      ctx.shadowBlur = 30
      ctx.beginPath()
      ctx.arc(this.centerX, this.centerY, currentRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
    }
  }
  
  cleanup(): void {
    this.progress = 0
    this.isComplete = false
  }
}

