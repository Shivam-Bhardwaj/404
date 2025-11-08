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
  const eps = 0.01
  const n1 = noise(x, y + eps, t)
  const n2 = noise(x, y - eps, t)
  const n3 = noise(x + eps, y, t)
  const n4 = noise(x - eps, y, t)
  const cx = (n1 - n2) / (2 * eps)
  const cy = (n4 - n3) / (2 * eps)
  return [cx, cy]
}

// Simple noise function
const noise = (x: number, y: number, t: number): number => {
  const n = Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t) * 
            Math.sin((x + y) * 0.02 + t * 2)
  return (n + 1) / 2
}

