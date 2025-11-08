// Hardware Detection and Benchmarking System
import { DeviceTier, PerformanceConfig } from '../types'

export class HardwareDetector {
  private gpuScore = 0
  private cpuScore = 0
  private memoryScore = 0
  private deviceTier: DeviceTier = 'medium'
  
  async benchmark(): Promise<DeviceTier> {
    await this.benchmarkGPU()
    await this.benchmarkCPU()
    this.benchmarkMemory()
    this.deviceTier = this.classifyDevice()
    return this.deviceTier
  }
  
  private async benchmarkGPU(): Promise<void> {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    
    if (!gl) {
      this.gpuScore = 0
      return
    }
    
    const start = performance.now()
    
    // Render test triangles
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `)
    gl.compileShader(vertexShader)
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, `
      precision mediump float;
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `)
    gl.compileShader(fragmentShader)
    
    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.useProgram(program)
    
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const vertices = new Float32Array([-1, -1, 1, -1, 0, 1])
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
    
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    
    // Draw many times
    for (let i = 0; i < 10000; i++) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    
    gl.finish()
    const elapsed = performance.now() - start
    this.gpuScore = 10000 / elapsed
  }
  
  private async benchmarkCPU(): Promise<void> {
    const start = performance.now()
    
    // CPU intensive calculations
    let result = 0
    for (let i = 0; i < 1000000; i++) {
      result += Math.sqrt(i) * Math.sin(i) * Math.cos(i)
    }
    
    const elapsed = performance.now() - start
    this.cpuScore = 1000000 / elapsed
    
    // Prevent optimization
    if (result < 0) console.log(result)
  }
  
  private benchmarkMemory(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      this.memoryScore = memory.jsHeapSizeLimit / (1024 * 1024 * 1024) // GB
    } else {
      this.memoryScore = 2 // Assume 2GB default
    }
  }
  
  private classifyDevice(): DeviceTier {
    // Score based classification
    const score = this.gpuScore * 0.6 + this.cpuScore * 0.3 + this.memoryScore * 10
    
    if (score < 50) return 'low'
    if (score < 200) return 'medium'
    if (score < 500) return 'high'
    return 'ultra'
  }
  
  getPerformanceConfig(): PerformanceConfig {
    switch (this.deviceTier) {
      case 'low':
        return {
          particleCount: 100,
          updateRate: 30,
          renderQuality: 0.5,
          enableEffects: false,
          enableShaders: false,
        }
      case 'medium':
        return {
          particleCount: 500,
          updateRate: 60,
          renderQuality: 0.75,
          enableEffects: true,
          enableShaders: false,
        }
      case 'high':
        return {
          particleCount: 2000,
          updateRate: 60,
          renderQuality: 1.0,
          enableEffects: true,
          enableShaders: true,
        }
      case 'ultra':
        return {
          particleCount: 10000,
          updateRate: 120,
          renderQuality: 1.5,
          enableEffects: true,
          enableShaders: true,
        }
    }
  }
  
  getDeviceTier(): DeviceTier {
    return this.deviceTier
  }
  
  getScores() {
    return {
      gpu: this.gpuScore.toFixed(2),
      cpu: this.cpuScore.toFixed(2),
      memory: this.memoryScore.toFixed(2),
    }
  }
}

