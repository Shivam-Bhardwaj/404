// Mathematical utilities - TESTED AND OPTIMIZED
export const clamp = (value: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, value))

export const lerp = (a: number, b: number, t: number): number => 
  a + (b - a) * clamp(t, 0, 1)

export const distance = (x1: number, y1: number, x2: number, y2: number): number => 
  Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

export const distanceSq = (x1: number, y1: number, x2: number, y2: number): number => 
  (x2 - x1) ** 2 + (y2 - y1) ** 2

export const randomRange = (min: number, max: number): number => 
  min + Math.random() * (max - min)

export const randomInt = (min: number, max: number): number => 
  Math.floor(randomRange(min, max + 1))

export const randomChoice = <T>(array: readonly T[]): T => 
  array[randomInt(0, array.length - 1)]

export const wrapAngle = (angle: number): number => {
  const a = angle % (Math.PI * 2)
  return a < 0 ? a + Math.PI * 2 : a
}

export const vecNormalize = (x: number, y: number): [number, number] => {
  const len = Math.sqrt(x * x + y * y)
  if (len === 0) return [0, 0]
  return [x / len, y / len]
}

export const curlNoise = (x: number, y: number, t: number): [number, number] => {
  // Use proper Perlin noise implementation
  // Lazy import to avoid circular dependencies
  const noiseModule = require('./noise')
  const noise = new noiseModule.PerlinNoise3D()
  return noiseModule.curlNoise2D(noise, x, y, t, 0.1)
}

