# Quick Start Guide

## Step 1: Start Backend
Open a terminal and run:
```bash
cd /404-public/repo/backend
cargo run --release
```

Wait for: "Simulation engine started" and "WS   /ws"

## Step 2: Open Frontend
Open your browser to your frontend URL (usually http://localhost:3000)

## Step 3: Check Browser Console
Press F12 → Console tab

Look for:
- ✅ `[SimulationStream] Connecting to: ws://localhost:3001/ws`
- ✅ `[SimulationStream] WebSocket connected`

## Step 4: Navigate to Ecosystem Phase
The particles should move smoothly at 60 FPS!

## Troubleshooting

**If WebSocket won't connect:**
- Make sure backend is running (check terminal)
- Check the URL in console logs
- Try: `curl http://localhost:3001/health` (should return "OK")

**If no particles:**
- Check browser console for errors
- Verify WebSocket connected message appears
- Check Network tab → WS filter → should show active connection

**If particles are slow/stuttering:**
- Check GPU is being used (nvidia-smi if available)
- Reduce particle count in backend/src/main.rs (change `num_boids = 100_000` to `10_000`)

