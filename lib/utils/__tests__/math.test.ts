// Tests for Math Utilities
import {
  clamp,
  lerp,
  distance,
  distanceSq,
  randomRange,
  randomInt,
  randomChoice,
  wrapAngle,
  vecNormalize,
} from '@/lib/utils/math'

describe('Math Utilities', () => {
  describe('clamp', () => {
    test('should clamp value within range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('lerp', () => {
    test('should interpolate between values', () => {
      expect(lerp(0, 10, 0.5)).toBe(5)
      expect(lerp(0, 10, 0)).toBe(0)
      expect(lerp(0, 10, 1)).toBe(10)
    })

    test('should clamp t parameter', () => {
      expect(lerp(0, 10, -1)).toBe(0)
      expect(lerp(0, 10, 2)).toBe(10)
    })
  })

  describe('distance', () => {
    test('should calculate distance correctly', () => {
      expect(distance(0, 0, 3, 4)).toBe(5)
      expect(distance(0, 0, 0, 0)).toBe(0)
    })
  })

  describe('distanceSq', () => {
    test('should calculate squared distance', () => {
      expect(distanceSq(0, 0, 3, 4)).toBe(25)
      expect(distanceSq(0, 0, 0, 0)).toBe(0)
    })
  })

  describe('randomRange', () => {
    test('should generate value within range', () => {
      for (let i = 0; i < 100; i++) {
        const value = randomRange(5, 10)
        expect(value).toBeGreaterThanOrEqual(5)
        expect(value).toBeLessThan(10)
      }
    })
  })

  describe('randomInt', () => {
    test('should generate integer within range', () => {
      for (let i = 0; i < 100; i++) {
        const value = randomInt(5, 10)
        expect(value).toBeGreaterThanOrEqual(5)
        expect(value).toBeLessThanOrEqual(10)
        expect(Number.isInteger(value)).toBe(true)
      }
    })
  })

  describe('randomChoice', () => {
    test('should return element from array', () => {
      const arr = [1, 2, 3, 4, 5]
      for (let i = 0; i < 100; i++) {
        const choice = randomChoice(arr)
        expect(arr).toContain(choice)
      }
    })
  })

  describe('wrapAngle', () => {
    test('should wrap angles to 0-2π', () => {
      expect(wrapAngle(0)).toBe(0)
      expect(wrapAngle(Math.PI * 2)).toBeCloseTo(0)
      expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI)
      expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI)
    })
  })

  describe('vecNormalize', () => {
    test('should normalize vector', () => {
      const [x, y] = vecNormalize(3, 4)
      const len = Math.sqrt(x * x + y * y)
      expect(len).toBeCloseTo(1)
    })

    test('should handle zero vector', () => {
      const [x, y] = vecNormalize(0, 0)
      expect(x).toBe(0)
      expect(y).toBe(0)
    })
  })
})

