// Proper 3D Perlin Noise Implementation
export class PerlinNoise3D {
  private permutation: number[] = []
  private p: number[] = []
  
  constructor(seed?: number) {
    // Create permutation table
    this.permutation = []
    for (let i = 0; i < 256; i++) {
      this.permutation[i] = i
    }
    
    // Shuffle based on seed
    const rng = seed !== undefined ? this.seededRandom(seed) : Math.random
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[this.permutation[i], this.permutation[j]] = [this.permutation[j], this.permutation[i]]
    }
    
    // Duplicate permutation array
    this.p = [...this.permutation, ...this.permutation]
  }
  
  private seededRandom(seed: number): () => number {
    let value = seed
    return () => {
      value = (value * 9301 + 49297) % 233280
      return value / 233280
    }
  }
  
  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a)
  }
  
  private grad(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15
    const u = h < 8 ? x : y
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
  }
  
  noise(x: number, y: number, z: number): number {
    // Find unit cube that contains the point
    const X = Math.floor(x) & 255
    const Y = Math.floor(y) & 255
    const Z = Math.floor(z) & 255
    
    // Find relative x, y, z of point in cube
    x -= Math.floor(x)
    y -= Math.floor(y)
    z -= Math.floor(z)
    
    // Compute fade curves for each of x, y, z
    const u = this.fade(x)
    const v = this.fade(y)
    const w = this.fade(z)
    
    // Hash coordinates of the 8 cube corners
    const A = this.p[X] + Y
    const AA = this.p[A] + Z
    const AB = this.p[A + 1] + Z
    const B = this.p[X + 1] + Y
    const BA = this.p[B] + Z
    const BB = this.p[B + 1] + Z
    
    // And add blended results from 8 corners of the cube
    return this.lerp(
      this.lerp(
        this.lerp(
          this.grad(this.p[AA], x, y, z),
          this.grad(this.p[BA], x - 1, y, z),
          u
        ),
        this.lerp(
          this.grad(this.p[AB], x, y - 1, z),
          this.grad(this.p[BB], x - 1, y - 1, z),
          u
        ),
        v
      ),
      this.lerp(
        this.lerp(
          this.grad(this.p[AA + 1], x, y, z - 1),
          this.grad(this.p[BA + 1], x - 1, y, z - 1),
          u
        ),
        this.lerp(
          this.grad(this.p[AB + 1], x, y - 1, z - 1),
          this.grad(this.p[BB + 1], x - 1, y - 1, z - 1),
          u
        ),
        v
      ),
      w
    )
  }
  
  // Octave noise (fractal noise)
  octaveNoise(x: number, y: number, z: number, octaves: number = 4, persistence: number = 0.5): number {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    
    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency, z * frequency) * amplitude
      maxValue += amplitude
      amplitude *= persistence
      frequency *= 2
    }
    
    return value / maxValue
  }
}

// Curl noise computation for incompressible flow
export function curlNoise3D(
  noise: PerlinNoise3D,
  x: number,
  y: number,
  z: number,
  scale: number = 0.1
): [number, number, number] {
  const eps = 0.01
  
  // Compute gradients using finite differences
  const dx = (noise.noise(x + eps, y, z) - noise.noise(x - eps, y, z)) / (2 * eps)
  const dy = (noise.noise(x, y + eps, z) - noise.noise(x, y - eps, z)) / (2 * eps)
  const dz = (noise.noise(x, y, z + eps) - noise.noise(x, y, z - eps)) / (2 * eps)
  
  // Curl = ∇ × potential
  // For 2D projection (z component is time), we get:
  const curlX = dy * scale
  const curlY = -dx * scale
  const curlZ = 0
  
  return [curlX, curlY, curlZ]
}

// 2D curl noise (for 2D simulations)
export function curlNoise2D(
  noise: PerlinNoise3D,
  x: number,
  y: number,
  t: number,
  scale: number = 0.1
): [number, number] {
  const eps = 0.01
  
  // Sample noise field at offset positions
  const n1 = noise.noise(x, y + eps, t)
  const n2 = noise.noise(x, y - eps, t)
  const n3 = noise.noise(x + eps, y, t)
  const n4 = noise.noise(x - eps, y, t)
  
  // Compute curl (2D)
  const curlX = (n1 - n2) / (2 * eps) * scale
  const curlY = -(n4 - n3) / (2 * eps) * scale
  
  return [curlX, curlY]
}

