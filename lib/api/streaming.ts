// WebSocket client for streaming simulation state
function buildWebSocketUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_PHYSICS_API_BASE ?? ''
  
  // If empty or just "/", try to detect production vs development
  if (!apiBase || apiBase === '/') {
    // In browser, check if we're on HTTPS (production) or HTTP (development)
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.hostname
      // Use port 3001 for backend, or same port if proxied
      const port = window.location.port ? `:${window.location.port}` : ''
      // If on same domain, try /ws directly (backend is on /ws, not /api/ws)
      // First try /ws, if that fails the connection handler will handle it
      return `${protocol}//${host}${port}/ws`
    }
    // Fallback for SSR
    return 'ws://localhost:3001/ws'
  }
  
  // Convert http/https to ws/wss
  let wsBase = apiBase.replace(/^http/, 'ws').replace(/^https/, 'wss')
  
  // Remove trailing slash
  wsBase = wsBase.replace(/\/$/, '')
  
  // Ensure we have a protocol
  if (!wsBase.match(/^wss?:\/\//)) {
    // If no protocol, assume ws://
    wsBase = `ws://${wsBase}`
  }
  
  // Add /ws path (or /api/ws if using API base)
  if (wsBase.includes('/api')) {
    return `${wsBase}/ws`
  }
  return `${wsBase}/ws`
}

export interface StreamedBoidState {
  x: number
  y: number
  vx: number
  vy: number
  timestamp: number
}

export class SimulationStream {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private onStateCallback: ((states: StreamedBoidState[]) => void) | null = null
  private onErrorCallback: ((error: Error) => void) | null = null
  private onConnectionStatusCallback: ((connected: boolean) => void) | null = null
  private isConnecting = false
  private shouldReconnect = true
  private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected'

  constructor() {
    // Auto-reconnect on close
  }

  connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return Promise.resolve()
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      const wsUrl = buildWebSocketUrl()
      
      console.log(`[SimulationStream] Connecting to: ${wsUrl}`)
      
      try {
        const ws = new WebSocket(wsUrl)
        
        ws.binaryType = 'arraybuffer'
        
        ws.onopen = () => {
          this.ws = ws
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.connectionStatus = 'connected'
          console.log('[SimulationStream] WebSocket connected')
          if (this.onConnectionStatusCallback) {
            this.onConnectionStatusCallback(true)
          }
          resolve()
        }
        
        ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            this.handleBinaryMessage(event.data)
          }
        }
        
        ws.onerror = (error) => {
          this.isConnecting = false
          console.error('[SimulationStream] WebSocket error:', error)
          const err = new Error('WebSocket error')
          if (this.onErrorCallback) {
            this.onErrorCallback(err)
          }
          reject(err)
        }
        
        ws.onclose = (event) => {
          this.ws = null
          this.isConnecting = false
          this.connectionStatus = 'disconnected'
          console.log(`[SimulationStream] WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`)
          if (this.onConnectionStatusCallback) {
            this.onConnectionStatusCallback(false)
          }
          
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
            console.log(`[SimulationStream] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
            
            setTimeout(() => {
              this.connect().catch(() => {
                // Reconnection failed, will retry on next attempt
              })
            }, delay)
          }
        }
      } catch (error) {
        this.isConnecting = false
        console.error('[SimulationStream] Failed to create WebSocket:', error)
        reject(error)
      }
    })
  }

  private handleBinaryMessage(data: ArrayBuffer): void {
    const view = new DataView(data)
    let offset = 0
    
    // Read timestamp (u64 = 8 bytes)
    const timestamp = Number(view.getBigUint64(offset, true))
    offset += 8
    
    // Read num_boids (u32 = 4 bytes)
    const numBoids = view.getUint32(offset, true)
    offset += 4
    
    // Read boid data (each boid is 4 floats = 16 bytes)
    const states: StreamedBoidState[] = []
    
    for (let i = 0; i < numBoids; i++) {
      const x = view.getFloat32(offset, true)
      offset += 4
      const y = view.getFloat32(offset, true)
      offset += 4
      const vx = view.getFloat32(offset, true)
      offset += 4
      const vy = view.getFloat32(offset, true)
      offset += 4
      
      states.push({ x, y, vx, vy, timestamp: Number(timestamp) })
    }
    
    if (this.onStateCallback) {
      this.onStateCallback(states)
    }
  }

  onState(callback: (states: StreamedBoidState[]) => void): void {
    this.onStateCallback = callback
  }

  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback
  }

  onConnectionStatus(callback: (connected: boolean) => void): void {
    this.onConnectionStatusCallback = callback
  }

  getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
    return this.connectionStatus
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}

