// Jest setup file
require('@testing-library/jest-dom')

// Mock canvas for tests
const mockCanvas2D = {
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => []),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
  canvas: {
    width: 800,
    height: 600,
  },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  shadowColor: '',
  shadowBlur: 0,
  textAlign: 'left',
  textBaseline: 'top',
  font: '10px sans-serif',
}

HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvas2D)

// Mock WebGL
const mockWebGLContext = {
  canvas: { width: 800, height: 600 },
  viewport: jest.fn(),
  clearColor: jest.fn(),
  clear: jest.fn(),
  createShader: jest.fn(() => ({})),
  shaderSource: jest.fn(),
  compileShader: jest.fn(),
  getShaderParameter: jest.fn(() => true),
  getShaderInfoLog: jest.fn(() => ''),
  createProgram: jest.fn(() => ({})),
  attachShader: jest.fn(),
  linkProgram: jest.fn(),
  getProgramParameter: jest.fn(() => true),
  getProgramInfoLog: jest.fn(() => ''),
  useProgram: jest.fn(),
  getUniformLocation: jest.fn(() => ({})),
  uniform1f: jest.fn(),
  uniform2f: jest.fn(),
  uniform3f: jest.fn(),
  uniform4f: jest.fn(),
  uniform1i: jest.fn(),
  activeTexture: jest.fn(),
  bindTexture: jest.fn(),
  createTexture: jest.fn(() => ({})),
  bindFramebuffer: jest.fn(),
  createFramebuffer: jest.fn(() => ({})),
  framebufferTexture2D: jest.fn(),
  texImage2D: jest.fn(),
  texParameteri: jest.fn(),
  createBuffer: jest.fn(() => ({})),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  enableVertexAttribArray: jest.fn(),
  vertexAttribPointer: jest.fn(),
  getAttribLocation: jest.fn(() => 0),
  drawArrays: jest.fn(),
  deleteShader: jest.fn(),
  deleteProgram: jest.fn(),
  deleteTexture: jest.fn(),
  deleteFramebuffer: jest.fn(),
  deleteBuffer: jest.fn(),
  getParameter: jest.fn((param) => {
    if (param === 0x8B4C) return {} // CURRENT_PROGRAM
    return null
  }),
  TEXTURE_2D: 0x0DE1,
  FRAMEBUFFER: 0x8D40,
  COLOR_ATTACHMENT0: 0x8CE0,
  RGBA: 0x1908,
  UNSIGNED_BYTE: 0x1401,
  LINEAR: 0x2601,
  CLAMP_TO_EDGE: 0x812F,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88E4,
  TRIANGLE_STRIP: 0x0005,
  COLOR_BUFFER_BIT: 0x00004000,
}

HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === 'webgl2') {
    return mockWebGLContext
  }
  return mockCanvas2D
})

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
}

// Mock window.innerWidth and innerHeight
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1920,
})

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 1080,
})

Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  configurable: true,
  value: 1,
})

