// L-System Text Mutation for Corruption Effects
import { Vec2 } from '../types'

export interface LSystemRule {
  from: string
  to: string
  probability?: number
}

export class LSystem {
  private rules: LSystemRule[] = []
  private axiom = ''
  private iterations = 0
  private angle = Math.PI / 6
  
  constructor(axiom: string, rules: LSystemRule[]) {
    this.axiom = axiom
    this.rules = rules
  }
  
  setAxiom(axiom: string): void {
    this.axiom = axiom
  }
  
  addRule(rule: LSystemRule): void {
    this.rules.push(rule)
  }
  
  generate(iterations: number): string {
    let result = this.axiom
    
    for (let i = 0; i < iterations; i++) {
      result = this.applyRules(result)
    }
    
    this.iterations = iterations
    return result
  }
  
  private applyRules(input: string): string {
    let output = ''
    
    for (const char of input) {
      let replaced = false
      
      for (const rule of this.rules) {
        if (rule.from === char) {
          // Check probability if specified
          if (rule.probability !== undefined) {
            if (Math.random() > rule.probability) {
              output += char
              replaced = true
              break
            }
          }
          
          output += rule.to
          replaced = true
          break
        }
      }
      
      if (!replaced) {
        output += char
      }
    }
    
    return output
  }
  
  // Convert L-system string to drawing commands
  interpret(commands: string, startPos: Vec2, startAngle: number, stepSize: number): Vec2[] {
    const positions: Vec2[] = [startPos]
    const stack: Array<{ pos: Vec2; angle: number }> = []
    
    let currentPos = { ...startPos }
    let currentAngle = startAngle
    
    for (const cmd of commands) {
      switch (cmd) {
        case 'F': // Move forward and draw
        case 'G': // Move forward without drawing
          const newPos: Vec2 = {
            x: currentPos.x + Math.cos(currentAngle) * stepSize,
            y: currentPos.y + Math.sin(currentAngle) * stepSize,
          }
          positions.push(newPos)
          currentPos = newPos
          break
          
        case '+': // Turn right
          currentAngle += this.angle
          break
          
        case '-': // Turn left
          currentAngle -= this.angle
          break
          
        case '[': // Push state
          stack.push({ pos: { ...currentPos }, angle: currentAngle })
          break
          
        case ']': // Pop state
          const state = stack.pop()
          if (state) {
            currentPos = state.pos
            currentAngle = state.angle
          }
          break
          
        case '|': // Reverse direction
          currentAngle += Math.PI
          break
      }
    }
    
    return positions
  }
  
  // Create corruption rules for text mutation
  static createCorruptionRules(): LSystemRule[] {
    return [
      { from: '0', to: 'O', probability: 0.3 },
      { from: '4', to: 'A', probability: 0.3 },
      { from: 'E', to: '3', probability: 0.2 },
      { from: 'R', to: 'P', probability: 0.2 },
      { from: 'O', to: '0', probability: 0.2 },
      { from: 'A', to: '4', probability: 0.2 },
      { from: ' ', to: '_', probability: 0.1 },
      { from: 'N', to: 'M', probability: 0.3 },
      { from: 'T', to: '7', probability: 0.2 },
    ]
  }
  
  // Create fractal growth rules
  static createFractalRules(): LSystemRule[] {
    return [
      { from: 'F', to: 'F[+F]F[-F]F', probability: 0.7 },
      { from: 'F', to: 'FF', probability: 0.3 },
    ]
  }
  
  // Mutate text using L-system rules
  static mutateText(text: string, intensity: number): string {
    const rules = LSystem.createCorruptionRules()
    const lsystem = new LSystem(text, rules)
    
    // Adjust rule probabilities based on intensity
    rules.forEach((rule) => {
      if (rule.probability !== undefined) {
        rule.probability = rule.probability * intensity
      }
    })
    
    return lsystem.generate(1)
  }
  
  // Generate corruption pattern for character
  static generateCorruptionPattern(char: string, center: Vec2, size: number, iterations: number): Vec2[] {
    const rules: LSystemRule[] = [
      { from: 'F', to: 'FF+[+F-F-F]-[-F+F+F]' },
    ]
    
    const lsystem = new LSystem('F', rules)
    const commands = lsystem.generate(iterations)
    
    return lsystem.interpret(commands, center, 0, size / (2 ** iterations))
  }
}

