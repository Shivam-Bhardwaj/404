// Tests for L-System
import { LSystem } from '@/lib/algorithms/l-system'

describe('LSystem', () => {
  test('should create L-system with axiom and rules', () => {
    const rules = [{ from: 'F', to: 'FF' }]
    const lsystem = new LSystem('F', rules)
    expect(lsystem).toBeDefined()
  })

  test('should generate strings from rules', () => {
    const rules = [{ from: 'F', to: 'FF' }]
    const lsystem = new LSystem('F', rules)
    
    const result = lsystem.generate(3)
    expect(result.length).toBeGreaterThan(1)
  })

  test('should mutate text with corruption rules', () => {
    const text = '404'
    const mutated = LSystem.mutateText(text, 0.5)
    expect(mutated.length).toBeGreaterThanOrEqual(text.length)
  })

  test('should generate corruption patterns', () => {
    const pattern = LSystem.generateCorruptionPattern('A', { x: 100, y: 100 }, 50, 2)
    expect(pattern.length).toBeGreaterThan(0)
    expect(pattern[0]).toHaveProperty('x')
    expect(pattern[0]).toHaveProperty('y')
  })

  test('should interpret commands to positions', () => {
    const rules = [{ from: 'F', to: 'F+F' }]
    const lsystem = new LSystem('F', rules)
    const commands = lsystem.generate(2)
    
    const positions = lsystem.interpret(commands, { x: 0, y: 0 }, 0, 10)
    expect(positions.length).toBeGreaterThan(0)
  })
})

