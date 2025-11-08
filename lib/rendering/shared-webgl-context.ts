// Shared WebGL Context Manager
// A canvas can only have one WebGL context, so we need to share it
export class SharedWebGLContext {
  private static instance: SharedWebGLContext | null = null
  private gl: WebGL2RenderingContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private renderer: any = null
  
  private constructor() {}
  
  static getInstance(): SharedWebGLContext {
    if (!SharedWebGLContext.instance) {
      SharedWebGLContext.instance = new SharedWebGLContext()
    }
    return SharedWebGLContext.instance
  }
  
  initialize(canvas: HTMLCanvasElement, renderer: any): boolean {
    if (this.canvas && this.canvas !== canvas) {
      console.warn('WebGL context already initialized on different canvas')
      return false
    }
    
    if (!this.gl) {
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      })
      
      if (!gl) {
        return false
      }
      
      this.gl = gl
      this.canvas = canvas
      this.renderer = renderer
    }
    
    return true
  }
  
  getContext(): WebGL2RenderingContext | null {
    return this.gl
  }
  
  getRenderer(): any {
    return this.renderer
  }
  
  isInitialized(): boolean {
    return this.gl !== null
  }
  
  reset(): void {
    // Don't destroy the context, just mark as available
    // The context persists across phases
  }
}

