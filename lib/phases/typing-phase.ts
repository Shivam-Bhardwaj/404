// Glitched 404 Typing Animation - MARKOV CHAIN IMPLEMENTATION
import { AnimationPhase } from '../types'
import { GLITCH_CHARS, ERROR_MESSAGES, COLORS } from '../constants'
import { randomChoice, randomRange } from '../utils/math'

export class TypingPhase implements AnimationPhase {
  name: 'typing' = 'typing'
  duration = 3000
  progress = 0
  isComplete = false
  
  private text = '404'
  private displayText = ''
  private targetText = randomChoice(ERROR_MESSAGES)
  private typeIndex = 0
  private lastTypeTime = 0
  private typeSpeed = 50
  private glitchProbability = 0.1
  
  // Markov chain for realistic typing
  private markovDelays: Map<string, number[]> = new Map([
    ['space', [100, 150, 200]],
    ['punct', [200, 250, 300]],
    ['char', [30, 50, 70]],
  ])
  
  init(): void {
    this.displayText = ''
    this.typeIndex = 0
    this.lastTypeTime = Date.now()
  }
  
  private getNextDelay(prevChar: string, nextChar: string): number {
    let delayType = 'char'
    if (prevChar === ' ' || nextChar === ' ') delayType = 'space'
    if ('.!?,;:'.includes(prevChar) || '.!?,;:'.includes(nextChar)) delayType = 'punct'
    
    const delays = this.markovDelays.get(delayType) || [50]
    return randomChoice(delays)
  }
  
  private corruptChar(char: string): string {
    if (Math.random() < this.glitchProbability) {
      return randomChoice(GLITCH_CHARS.split(''))
    }
    return char
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    
    const now = Date.now()
    const prevChar = this.typeIndex > 0 ? this.targetText[this.typeIndex - 1] : ''
    const nextChar = this.targetText[this.typeIndex] || ''
    const delay = this.getNextDelay(prevChar, nextChar)
    
    if (now - this.lastTypeTime > delay && this.typeIndex < this.targetText.length) {
      const char = this.corruptChar(this.targetText[this.typeIndex])
      this.displayText += char
      this.typeIndex++
      this.lastTypeTime = now
      
      // Randomly add glitch bursts
      if (Math.random() < 0.05) {
        for (let i = 0; i < randomRange(2, 5); i++) {
          this.displayText += randomChoice(GLITCH_CHARS.split(''))
        }
      }
    }
    
    // Corruption increases over time
    if (this.progress > 0.5) {
      this.glitchProbability = 0.1 + (this.progress - 0.5) * 0.8
    }
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    ctx.font = '48px monospace'
    ctx.fillStyle = COLORS.error
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Main text with glitch effect
    const x = ctx.canvas.width / 2
    const y = ctx.canvas.height / 2
    
    // Glitch layers
    if (Math.random() < this.glitchProbability) {
      ctx.fillStyle = COLORS.info
      ctx.fillText(this.displayText, x + randomRange(-2, 2), y + randomRange(-2, 2))
      
      ctx.fillStyle = COLORS.corrupt
      ctx.fillText(this.displayText, x + randomRange(-2, 2), y + randomRange(-2, 2))
    }
    
    ctx.fillStyle = COLORS.error
    ctx.fillText(this.displayText, x, y)
    
    // Cursor
    if (this.typeIndex < this.targetText.length) {
      const cursorX = x + ctx.measureText(this.displayText).width / 2 + 5
      ctx.fillRect(cursorX, y - 20, 3, 40)
    }
  }
  
  cleanup(): void {
    this.displayText = ''
    this.typeIndex = 0
    this.progress = 0
    this.isComplete = false
  }
}

