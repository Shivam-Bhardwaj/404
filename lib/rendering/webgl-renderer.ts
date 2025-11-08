// WebGL2 Renderer Setup and Management
export class WebGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private programs: Map<string, WebGLProgram> = new Map()
  private textures: Map<string, WebGLTexture> = new Map()
  private framebuffers: Map<string, WebGLFramebuffer> = new Map()
  private vertexBuffer: WebGLBuffer | null = null
  private isSupported = false
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.init()
  }
  
  private init(): void {
    if (!this.canvas) return
    
    // Try to get WebGL2 context
    const gl = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    
    if (!gl) {
      console.warn('WebGL2 not supported, falling back to Canvas 2D')
      this.isSupported = false
      return
    }
    
    this.gl = gl
    this.isSupported = true
    
    // Create full-screen quad for rendering
    this.createFullScreenQuad()
    
    // Set viewport
    this.resize()
  }
  
  private createFullScreenQuad(): void {
    if (!this.gl) return
    
    // Create vertex buffer for full-screen quad
    const vertices = new Float32Array([
      -1, -1,  0, 0,
       1, -1,  1, 0,
      -1,  1,  0, 1,
       1,  1,  1, 1,
    ])
    
    this.vertexBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)
  }
  
  resize(): void {
    if (!this.gl || !this.canvas) return
    
    const dpr = window.devicePixelRatio || 1
    const width = this.canvas.clientWidth * dpr
    const height = this.canvas.clientHeight * dpr
    
    this.canvas.width = width
    this.canvas.height = height
    
    this.gl.viewport(0, 0, width, height)
  }
  
  compileShader(source: string, type: number): WebGLShader | null {
    if (!this.gl) return null
    
    const shader = this.gl.createShader(type)
    if (!shader) return null
    
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(shader)
      console.error('Shader compilation error:', error)
      this.gl.deleteShader(shader)
      return null
    }
    
    return shader
  }
  
  createProgram(vertexSource: string, fragmentSource: string, name: string): WebGLProgram | null {
    if (!this.gl) return null
    
    const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER)
    const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER)
    
    if (!vertexShader || !fragmentShader) return null
    
    const program = this.gl.createProgram()
    if (!program) return null
    
    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)
    
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program)
      console.error('Program linking error:', error)
      this.gl.deleteProgram(program)
      return null
    }
    
    // Clean up shaders
    this.gl.deleteShader(vertexShader)
    this.gl.deleteShader(fragmentShader)
    
    this.programs.set(name, program)
    return program
  }
  
  createTexture(width: number, height: number, format: number = this.gl!.RGBA): any {
    if (!this.gl) return null
    
    const texture = this.gl.createTexture()
    if (!texture) return null
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      format,
      width,
      height,
      0,
      format,
      this.gl.UNSIGNED_BYTE,
      null
    )
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    
    return texture
  }
  
  createFramebuffer(texture: any, name: string): any {
    if (!this.gl) return null
    
    const framebuffer = this.gl.createFramebuffer()
    if (!framebuffer) return null
    
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      texture,
      0
    )
    
    this.framebuffers.set(name, framebuffer)
    return framebuffer
  }
  
  useProgram(name: string): boolean {
    if (!this.gl) return false
    
    const program = this.programs.get(name)
    if (!program) return false
    
    this.gl.useProgram(program)
    return true
  }
  
  setUniform(programName: string, name: string, type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'int' | 'sampler2D', value: any): void {
    if (!this.gl) return
    
    const program = this.programs.get(programName)
    if (!program) return
    
    const location = this.gl.getUniformLocation(program, name)
    if (!location) return
    
    switch (type) {
      case 'float':
        this.gl.uniform1f(location, value)
        break
      case 'vec2':
        this.gl.uniform2f(location, value[0], value[1])
        break
      case 'vec3':
        this.gl.uniform3f(location, value[0], value[1], value[2])
        break
      case 'vec4':
        this.gl.uniform4f(location, value[0], value[1], value[2], value[3])
        break
      case 'int':
        this.gl.uniform1i(location, value)
        break
      case 'sampler2D':
        this.gl.uniform1i(location, value)
        break
    }
  }
  
  bindTexture(texture: any, unit: number = 0): void {
    if (!this.gl) return
    
    this.gl.activeTexture(this.gl.TEXTURE0 + unit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
  }
  
  bindFramebuffer(name: string | null): void {
    if (!this.gl) return
    
    if (name === null) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
      return
    }
    
    const framebuffer = this.framebuffers.get(name)
    if (framebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    }
  }
  
  renderFullScreenQuad(): void {
    if (!this.gl || !this.vertexBuffer) return
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
    
    // Position attribute
    const positionLoc = this.gl.getAttribLocation(this.gl.getParameter(this.gl.CURRENT_PROGRAM) as WebGLProgram, 'a_position')
    if (positionLoc >= 0) {
      this.gl.enableVertexAttribArray(positionLoc)
      this.gl.vertexAttribPointer(positionLoc, 2, this.gl.FLOAT, false, 16, 0)
    }
    
    // Texcoord attribute
    const texcoordLoc = this.gl.getAttribLocation(this.gl.getParameter(this.gl.CURRENT_PROGRAM) as WebGLProgram, 'a_texcoord')
    if (texcoordLoc >= 0) {
      this.gl.enableVertexAttribArray(texcoordLoc)
      this.gl.vertexAttribPointer(texcoordLoc, 2, this.gl.FLOAT, false, 16, 8)
    }
    
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }
  
  clear(r: number = 0, g: number = 0, b: number = 0, a: number = 1): void {
    if (!this.gl) return
    
    this.gl.clearColor(r, g, b, a)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
  }
  
  getContext(): WebGL2RenderingContext | null {
    return this.gl
  }
  
  isWebGLSupported(): boolean {
    return this.isSupported
  }
  
  cleanup(): void {
    if (!this.gl) return
    
    // Clean up programs
    this.programs.forEach((program) => {
      this.gl!.deleteProgram(program)
    })
    this.programs.clear()
    
    // Clean up textures
    this.textures.forEach((texture) => {
      this.gl!.deleteTexture(texture)
    })
    this.textures.clear()
    
    // Clean up framebuffers
    this.framebuffers.forEach((framebuffer) => {
      this.gl!.deleteFramebuffer(framebuffer)
    })
    this.framebuffers.clear()
    
    // Clean up buffer
    if (this.vertexBuffer) {
      this.gl.deleteBuffer(this.vertexBuffer)
      this.vertexBuffer = null
    }
  }
}

