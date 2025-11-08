// White Flash Transition Phase
import { AnimationPhase } from '../types'
import { COLORS } from '../constants'

export class WhitePhase implements AnimationPhase {
  name: 'white' = 'white'
  duration = 300
  progress = 0
  isComplete = false
  
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
  
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.white
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  }
  
  cleanup(): void {
    this.progress = 0
    this.isComplete = false
  }
}

