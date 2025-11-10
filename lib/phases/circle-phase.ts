// Black Circle Expanding Animation - Reveals Ecosystem
import { AnimationPhase } from '../types'
import { COLORS } from '../constants'
import { lerp } from '../utils/math'
import { EcosystemPhase } from './ecosystem-phase'

export class CirclePhase implements AnimationPhase {
  name: 'circle' = 'circle'
  duration = 1500
  progress = 0
  isComplete = false
  
  private centerX = 0
  private centerY = 0
  private maxRadius = 0
  private ecosystemPhase: EcosystemPhase | null = null
  
  constructor(width: number, height: number, ecosystemPhase?: EcosystemPhase) {
    this.centerX = width / 2
    this.centerY = height / 2
    // Calculate max radius to cover entire screen (diagonal)
    this.maxRadius = Math.sqrt(width * width + height * height) / 2
    this.ecosystemPhase = ecosystemPhase || null
  }
  
  init(): void {
    this.progress = 0
    this.isComplete = false
    
    // Initialize ecosystem phase if provided so it's ready to render
    if (this.ecosystemPhase) {
      this.ecosystemPhase.init()
    }
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    
    // Update ecosystem phase so it animates while being revealed
    if (this.ecosystemPhase) {
      this.ecosystemPhase.update(dt)
    }
    
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
    
    // First, render the ecosystem phase underneath if available
    if (this.ecosystemPhase) {
      this.ecosystemPhase.render(ctx)
    }
    
    // Easing function for smooth expansion
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
    
    const easedProgress = easeOut(this.progress)
    // Circle expands from 0 to maxRadius
    const currentRadius = lerp(0, this.maxRadius, easedProgress)
    
    // Draw black expanding circle mask on top
    // Fill entire screen with black first
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, width, height)
    
    // Then use destination-out to erase the expanding circle, revealing ecosystem underneath
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    
    // Draw expanding circle with SDF for perfect anti-aliasing
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data
    
    // Sample step for performance
    const step = 2
    
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const dist = this.circleSDF(x, y, this.centerX, this.centerY, currentRadius)
        
        // Alpha: 255 (fully erase) inside circle, 0 (keep) outside circle
        let alpha = 0 // Default to keep (don't erase)
        if (dist <= 0) {
          alpha = 255 // Inside circle - fully erase (reveals ecosystem)
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
              data[idx] = 0       // R (not used for destination-out)
              data[idx + 1] = 0   // G (not used for destination-out)
              data[idx + 2] = 0   // B (not used for destination-out)
              data[idx + 3] = alpha // A (controls erasure)
            }
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
    ctx.restore()
  }
  
  cleanup(): void {
    this.progress = 0
    this.isComplete = false
  }
}

