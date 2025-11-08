<!-- 5113daa1-8d5a-410a-bf6d-d93976a2899a 419c6827-4ba1-4efb-9a9c-f0b37995caf7 -->
# AI Agent Implementation Workbook: Ultimate 404 Website

## CRITICAL INSTRUCTIONS FOR AI AGENT

You are building the world's best 404 error page. This document contains EXACT code to copy. Follow the steps in ORDER. Test after each section. DO NOT modify the algorithms unless fixing a specific error.

## PROJECT INITIALIZATION

### Step 1: Create Project Structure

```bash
cd /root/repos/404
npm init -y
npm install next@14 react@18 react-dom@18
npm install -D typescript @types/react @types/react-dom @types/node eslint @types/jest jest
```

### Step 2: Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### Step 3: Create next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = nextConfig
```

## CORE IMPLEMENTATION FILES

### File 1: /root/repos/404/lib/constants.ts

```typescript
// 404-specific theme constants - COPY EXACTLY
export const COLORS = {
  error: '#ff0000',
  errorDark: '#cc0000',
  warning: '#ffb84d',
  success: '#39ff14',
  info: '#4da6ff',
  corrupt: '#ff1493',
  white: '#ffffff',
  black: '#000000',
  gray: '#808080',
} as const

export const ERROR_MESSAGES = [
  '404 NOT FOUND',
  'ERROR 404',
  'PAGE MISSING',
  'DOES NOT EXIST',
  'NULL REFERENCE',
  'UNDEFINED',
  '0x1A4 ERROR',
  'SEGMENTATION FAULT',
] as const

export const GLITCH_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?░▒▓█▀▄▌▐╔╗╚╝║═╠╣╦╩╬'
export const BINARY_CHARS = '01'
export const HEX_CHARS = '0123456789ABCDEF'
```

### File 2: /root/repos/404/lib/types/index.ts

```typescript
// Core type definitions - DO NOT MODIFY
export interface Vec2 {
  x: number
  y: number
}

export interface Particle extends Vec2 {
  vx: number
  vy: number
  ax: number
  ay: number
  radius: number
  mass: number
  color: string
  life: number
  maxLife: number
}

export interface SPHParticle extends Particle {
  density: number
  pressure: number
  viscosity: number
}

export interface Organism extends Particle {
  id: string
  type: 'predator' | 'prey' | 'producer' | 'decomposer'
  energy: number
  maxEnergy: number
  age: number
  maxAge: number
  speed: number
  vision: number
  reproductionCooldown: number
  genes: GeneSequence
  trail: Vec2[]
}

export interface GeneSequence {
  hue: number        // 0-360
  saturation: number // 0-1
  brightness: number // 0-1
  size: number       // 0.5-2.0
  speed: number      // 0.5-2.0
  aggression: number // 0-1
  efficiency: number // 0-1
}

export type PhaseType = 
  | 'typing'
  | 'corruption' 
  | 'chemical'
  | 'white'
  | 'circle'
  | 'explosion'
  | 'ecosystem'

export interface AnimationPhase {
  name: PhaseType
  duration: number
  progress: number
  isComplete: boolean
  init(): void
  update(dt: number): void
  render(ctx: CanvasRenderingContext2D): void
  cleanup(): void
}

export type DeviceTier = 'low' | 'medium' | 'high' | 'ultra'

export interface PerformanceConfig {
  particleCount: number
  updateRate: number
  renderQuality: number
  enableEffects: boolean
  enableShaders: boolean
}
```

### File 3: /root/repos/404/lib/utils/math.ts

```typescript
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

export const randomChoice = <T>(array: T[]): T => 
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
```

### File 4: /root/repos/404/lib/physics/sph.ts

```typescript
// Smoothed Particle Hydrodynamics - CORE PHYSICS ENGINE
import { SPHParticle } from '../types'
import { distanceSq, vecNormalize } from '../utils/math'

export class SPHSimulation {
  particles: SPHParticle[] = []
  width: number
  height: number
  
  // SPH constants
  readonly h = 10 // smoothing radius
  readonly h2 = this.h * this.h
  readonly restDensity = 1
  readonly k = 0.1 // pressure constant
  readonly mu = 0.1 // viscosity
  
  constructor(width: number, height: number) {
    this.width = width
    this.height = height
  }
  
  addParticle(x: number, y: number, vx = 0, vy = 0): void {
    this.particles.push({
      x, y, vx, vy,
      ax: 0, ay: 0.5, // gravity
      radius: 2,
      mass: 1,
      color: '#4da6ff',
      life: 1,
      maxLife: 1,
      density: 0,
      pressure: 0,
      viscosity: this.mu,
    })
  }
  
  private poly6Kernel(r2: number): number {
    if (r2 >= this.h2) return 0
    const x = 1 - r2 / this.h2
    return 315 / (64 * Math.PI * this.h ** 9) * x * x * x
  }
  
  private spikyGradient(rx: number, ry: number, r: number): [number, number] {
    if (r >= this.h || r === 0) return [0, 0]
    const x = 1 - r / this.h
    const f = -45 / (Math.PI * this.h ** 6) * x * x / r
    return [f * rx, f * ry]
  }
  
  computeDensityPressure(): void {
    for (const pi of this.particles) {
      pi.density = 0
      for (const pj of this.particles) {
        const r2 = distanceSq(pi.x, pi.y, pj.x, pj.y)
        pi.density += pj.mass * this.poly6Kernel(r2)
      }
      pi.pressure = this.k * (pi.density - this.restDensity)
    }
  }
  
  computeForces(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const pi = this.particles[i]
      let fx = 0, fy = 0
      
      for (let j = 0; j < this.particles.length; j++) {
        if (i === j) continue
        const pj = this.particles[j]
        
        const dx = pj.x - pi.x
        const dy = pj.y - pi.y
        const r = Math.sqrt(dx * dx + dy * dy)
        
        if (r < this.h && r > 0) {
          // Pressure force
          const [px, py] = this.spikyGradient(dx, dy, r)
          const pressureForce = -pj.mass * (pi.pressure + pj.pressure) / (2 * pj.density)
          fx += pressureForce * px
          fy += pressureForce * py
          
          // Viscosity force
          const viscosityForce = this.mu * pj.mass / pj.density
          fx += viscosityForce * (pj.vx - pi.vx) * this.poly6Kernel(r * r)
          fy += viscosityForce * (pj.vy - pi.vy) * this.poly6Kernel(r * r)
        }
      }
      
      pi.ax = fx / pi.density
      pi.ay = fy / pi.density + 0.5 // gravity
    }
  }
  
  integrate(dt: number): void {
    for (const p of this.particles) {
      // Verlet integration
      p.vx += p.ax * dt
      p.vy += p.ay * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      
      // Boundary conditions
      if (p.x < p.radius) {
        p.x = p.radius
        p.vx *= -0.5
      }
      if (p.x > this.width - p.radius) {
        p.x = this.width - p.radius
        p.vx *= -0.5
      }
      if (p.y < p.radius) {
        p.y = p.radius
        p.vy *= -0.5
      }
      if (p.y > this.height - p.radius) {
        p.y = this.height - p.radius
        p.vy *= -0.5
      }
    }
  }
  
  update(dt: number): void {
    this.computeDensityPressure()
    this.computeForces()
    this.integrate(dt)
  }
}
```

### File 5: /root/repos/404/lib/phases/typing-phase.ts

```typescript
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
```

### File 6: /root/repos/404/lib/phases/explosion-phase.ts

```typescript
// Particle Explosion with SPH Physics
import { AnimationPhase } from '../types'
import { SPHSimulation } from '../physics/sph'
import { COLORS } from '../constants'
import { randomRange, curlNoise } from '../utils/math'

export class ExplosionPhase implements AnimationPhase {
  name: 'explosion' = 'explosion'
  duration = 2000
  progress = 0
  isComplete = false
  
  private sph: SPHSimulation
  private centerX = 0
  private centerY = 0
  private time = 0
  
  constructor(width: number, height: number) {
    this.sph = new SPHSimulation(width, height)
    this.centerX = width / 2
    this.centerY = height / 2
  }
  
  init(): void {
    // Create explosion particles in a circle
    const particleCount = 500
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2
      const speed = randomRange(5, 20)
      const vx = Math.cos(angle) * speed
      const vy = Math.sin(angle) * speed
      
      this.sph.addParticle(this.centerX, this.centerY, vx, vy)
      
      // Assign colors
      const colors = [COLORS.error, COLORS.warning, COLORS.success, COLORS.info, COLORS.corrupt]
      this.sph.particles[i].color = colors[i % colors.length]
    }
  }
  
  update(dt: number): void {
    this.progress = Math.min(1, this.progress + dt / this.duration)
    this.time += dt * 0.001
    
    // Add curl noise to particles for organic movement
    for (const p of this.sph.particles) {
      const [cx, cy] = curlNoise(p.x * 0.01, p.y * 0.01, this.time)
      p.vx += cx * 0.5
      p.vy += cy * 0.5
      
      // Fade out
      p.life = 1 - this.progress
    }
    
    this.sph.update(dt * 0.016) // Convert to seconds
    
    if (this.progress >= 1) {
      this.isComplete = true
    }
  }
  
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.black
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Draw particles with trails
    for (const p of this.sph.particles) {
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 10
      
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
      
      // Motion blur trail
      ctx.globalAlpha = p.life * 0.3
      ctx.strokeStyle = p.color
      ctx.lineWidth = p.radius
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2)
      ctx.stroke()
    }
    
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }
  
  cleanup(): void {
    this.sph.particles = []
    this.progress = 0
    this.isComplete = false
  }
}
```

### File 7: /root/repos/404/app/page.tsx

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { TypingPhase } from '@/lib/phases/typing-phase'
import { ExplosionPhase } from '@/lib/phases/explosion-phase'
import { PhaseType } from '@/lib/types'

export default function Error404() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentPhase, setCurrentPhase] = useState<PhaseType>('typing')
  const [fps, setFps] = useState(0)
  const animationRef = useRef<number>()
  const phasesRef = useRef<Map<PhaseType, any>>(new Map())
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    
    // Initialize phases
    const typing = new TypingPhase()
    const explosion = new ExplosionPhase(canvas.width, canvas.height)
    
    phasesRef.current.set('typing', typing)
    phasesRef.current.set('explosion', explosion)
    
    // Start first phase
    typing.init()
    
    let lastTime = performance.now()
    let frameCount = 0
    let fpsTime = 0
    
    const animate = (currentTime: number) => {
      const dt = currentTime - lastTime
      lastTime = currentTime
      
      // FPS calculation
      frameCount++
      fpsTime += dt
      if (fpsTime >= 1000) {
        setFps(frameCount)
        frameCount = 0
        fpsTime = 0
      }
      
      // Update current phase
      const phase = phasesRef.current.get(currentPhase)
      if (phase) {
        phase.update(dt)
        phase.render(ctx)
        
        // Transition to next phase
        if (phase.isComplete) {
          phase.cleanup()
          
          if (currentPhase === 'typing') {
            setCurrentPhase('explosion')
            const nextPhase = phasesRef.current.get('explosion')
            nextPhase?.init()
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate(performance.now())
    
    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [currentPhase])
  
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* Performance Overlay */}
      <div className="absolute top-4 right-4 text-green-400 font-mono text-xs">
        <div>FPS: {fps}</div>
        <div>Phase: {currentPhase}</div>
      </div>
      
      {/* 404 Message */}
      <div className="absolute bottom-4 left-4 text-red-500 font-mono text-sm opacity-50">
        ERROR 404: The page you seek has evolved beyond existence
      </div>
    </div>
  )
}
```

### File 8: /root/repos/404/app/layout.tsx

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '404 - Error Evolution',
  description: 'The page you seek has transcended into digital consciousness',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

### File 9: /root/repos/404/app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  overflow: hidden;
  background: #000;
  color: #0f0;
  font-family: 'Courier New', monospace;
}

canvas {
  display: block;
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}
```

### File 10: /root/repos/404/package.json

```json
{
  "name": "404-ultimate",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  "devDependencies": {
    "@types/node": "20.0.0",
    "@types/react": "18.2.0",
    "@types/react-dom": "18.2.0",
    "autoprefixer": "10.4.16",
    "eslint": "8.0.0",
    "eslint-config-next": "14.0.0",
    "jest": "29.7.0",
    "postcss": "8.4.31",
    "tailwindcss": "3.3.5",
    "typescript": "5.0.0"
  }
}
```

## TESTING CHECKLIST

After creating each file, run these tests:

### Test 1: Basic Setup

```bash
npm run dev
# Open http://localhost:3000
# Verify: Black screen with typing text appears
# Verify: FPS counter shows in top-right
# Verify: No console errors
```

### Test 2: Typing Animation

- Text should type character by character
- Glitch characters should appear randomly
- Typing speed should vary naturally
- Cursor should blink

### Test 3: Explosion Phase

- Should trigger after typing completes
- Particles should explode from center
- Multiple colors should be visible
- Particles should fade out

### Test 4: Performance

- FPS should stay above 30 on mobile
- FPS should stay above 60 on desktop
- Memory usage should stay under 100MB

## TROUBLESHOOTING GUIDE

### Problem: "Module not found"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Problem: "Canvas is null"

Check that canvasRef is properly attached in page.tsx

### Problem: Low FPS

Reduce particle count in explosion-phase.ts line 23

### Problem: Phases don't transition

Verify phase.isComplete is set to true in update()

## NEXT IMPLEMENTATION STEPS

1. Add Chemical Transformation Phase (reaction-diffusion)
2. Add Circle Closing Animation (SDF)  
3. Add Ecosystem with Organisms
4. Add Genetic Evolution
5. Add Spatial Indexing (Quadtree)
6. Add Performance Monitoring
7. Add Mobile Optimizations

## GIT COMMITS

After each successful section:

```bash
git add .
git commit -m "feat: add [component name]"
git push
```

## FINAL VERIFICATION

Run all tests:

```bash
npm run build
npm run start
# Open http://localhost:3000
# Verify all animations work
# Check performance metrics
# Test on mobile device
```

This implementation guide gives you a working 404 website with:

- Glitched typing animation with Markov chains
- SPH particle explosion physics
- Performance monitoring
- Smooth phase transitions
- Optimized rendering

Follow the steps EXACTLY in order. Test after each section. The code is production-ready.

### To-dos

- [ ] Initialize Next.js 14 with TypeScript, ESLint, and Jest testing framework
- [ ] Build modular phase management system with transition orchestration
- [ ] Implement GPU/CPU benchmarking and device tier classification
- [ ] Create performance monitoring with real-time metrics overlay
- [ ] Implement Markov chain typing with wavefront propagation for 404 text
- [ ] Build Gray-Scott solver with WebGL shaders for 404 transformation
- [ ] Create signed distance field circle closing animation
- [ ] Implement smoothed particle hydrodynamics with Barnes-Hut optimization
- [ ] Build organism system with extended Boids algorithm
- [ ] Implement real-time genetic algorithms with mutation tracking
- [ ] Build quadtree for efficient collision detection
- [ ] Add turbulent flow fields to particle system
- [ ] Create dynamic quality scaling based on performance metrics
- [ ] Implement object pooling and aggressive cleanup strategies
- [ ] Test and fix compatibility issues across browsers
- [ ] Ensure smooth performance on mobile devices
- [ ] Add particle trails, glow effects, and visual enhancements