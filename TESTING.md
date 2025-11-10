# Testing Guide: GPU Mothership Architecture

## Quick Start

### 1. Start the Backend Server

```bash
cd /404-public/repo/backend
cargo run --release
```

Expected output:
```
INFO: Initializing CUDA context...
INFO: CUDA Device: <your GPU name>
INFO: Creating simulation engine with 100000 boids
INFO: Starting persistent simulation engine at 500 Hz
INFO: Simulation engine started
INFO: Physics backend server listening on http://0.0.0.0:3001
INFO: Endpoints:
INFO:   GET  /health
INFO:   GET  /api/gpu-info
INFO:   GET  /api/gpu-stats
INFO:   POST /api/simulate/sph
INFO:   POST /api/simulate/boids
INFO:   POST /api/simulate/grayscott
INFO:   WS   /ws
```

### 2. Test WebSocket Connection

#### Option A: Browser Console Test

Open browser console on your frontend and run:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
ws.binaryType = 'arraybuffer';

ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (event) => {
  const data = new DataView(event.data);
  const timestamp = Number(data.getBigUint64(0, true));
  const numBoids = data.getUint32(8, true);
  console.log(`📦 Received: ${numBoids} boids at timestamp ${timestamp}`);
};
ws.onerror = (error) => console.error('❌ Error:', error);
ws.onclose = () => console.log('🔌 Disconnected');
```

#### Option B: Using `websocat` (if installed)

```bash
websocat ws://localhost:3001/ws --binary
```

#### Option C: Node.js Test Script

```javascript
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  console.log('✅ Connected to WebSocket');
});

ws.on('message', (data) => {
  const view = new DataView(data.buffer);
  const timestamp = Number(view.getBigUint64(0, true));
  const numBoids = view.getUint32(8, true);
  console.log(`📦 ${numBoids} boids @ ${timestamp}ms`);
});

ws.on('error', (error) => {
  console.error('❌ Error:', error);
});
```

### 3. Test Frontend Integration

1. **Start the frontend** (if not already running):
   ```bash
   cd /404-public/repo
   npm run dev
   ```

2. **Navigate to the ecosystem phase** - The ecosystem should automatically connect to the WebSocket.

3. **Check browser console** for:
   - `WebSocket connected` message
   - No errors about failed connections
   - Smooth animation (no stuttering)

### 4. Verify Performance

#### Check Backend Logs

Look for:
- ✅ `Simulation engine started` - Engine is running
- ✅ No `Simulation falling behind target FPS` warnings
- ✅ Regular WebSocket connections

#### Check Frontend Performance

Open browser DevTools → Performance tab:
- **Frame rate**: Should be 60 FPS
- **No dropped frames**: Smooth animation
- **Network tab**: WebSocket connection shows continuous messages

#### Monitor GPU Usage

```bash
# If nvidia-smi is available
watch -n 1 nvidia-smi
```

Expected:
- GPU utilization: 50-95%
- Memory usage: Depends on particle count
- Temperature: < 80°C

### 5. Load Testing (Multiple Clients)

Test with multiple browser tabs/windows:

1. Open 5-10 browser tabs to your frontend
2. All should connect to the same WebSocket
3. All should show smooth animation
4. Check backend logs for connection count

### 6. Verify Binary Protocol

The WebSocket sends binary data in this format:
```
[timestamp: u64 (8 bytes)] [num_boids: u32 (4 bytes)] [boid_data: f32[] (16 bytes per boid)]
```

Each boid is: `[x: f32, y: f32, vx: f32, vy: f32]`

### 7. Troubleshooting

#### Backend won't start
- Check CUDA is installed: `nvidia-smi`
- Check port 3001 is available: `lsof -i :3001`
- Check logs for CUDA initialization errors

#### WebSocket connection fails
- Verify backend is running: `curl http://localhost:3001/health`
- Check WebSocket URL matches backend address
- Check browser console for CORS/connection errors

#### No particles visible
- Check browser console for WebSocket messages
- Verify `handleStreamedState` is being called
- Check that `renderOrganisms` array has data

#### Slow/stuttering animation
- Check GPU utilization (should be high)
- Verify WebSocket messages arriving at 60 FPS
- Check browser performance tab for bottlenecks
- Reduce particle count if needed (modify `num_boids` in `main.rs`)

### 8. Expected Behavior

✅ **Success indicators:**
- Backend starts without errors
- WebSocket connects successfully
- Particles move smoothly at 60 FPS
- No network latency visible
- GPU running at high utilization
- Multiple clients can connect simultaneously

❌ **Failure indicators:**
- Connection refused errors
- Particles not moving or updating slowly
- Browser console shows WebSocket errors
- Backend logs show simulation errors
- GPU not being utilized

### 9. Performance Benchmarks

Expected performance:
- **Backend simulation**: 500 Hz internal update rate
- **WebSocket broadcast**: 60 FPS (16ms intervals)
- **Frontend rendering**: 60 FPS smooth
- **Latency**: < 50ms end-to-end
- **Particle count**: 10K-100K depending on GPU

### 10. Cleanup

To stop the backend:
- Press `Ctrl+C` in the terminal
- The simulation engine will stop gracefully
- WebSocket connections will close

To test reconnection:
- Stop backend, start it again
- Frontend should automatically reconnect
- Check console for reconnection messages
