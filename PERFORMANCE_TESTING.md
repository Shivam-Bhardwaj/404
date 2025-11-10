# Performance Testing and Validation Guide

## Test Suite for 60 FPS Performance Validation

### 1. Frame Rate Monitoring

```typescript
// lib/performance/fps-monitor.ts
export class FPSMonitor {
  private frameCount = 0
  private lastTime = performance.now()
  private fpsHistory: number[] = []
  private frameTimeHistory: number[] = []
  
  update(): number {
    const now = performance.now()
    const frameTime = now - this.lastTime
    const fps = 1000 / frameTime
    
    this.frameCount++
    this.fpsHistory.push(fps)
    this.frameTimeHistory.push(frameTime)
    
    // Keep last 60 frames
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift()
      this.frameTimeHistory.shift()
    }
    
    this.lastTime = now
    return fps
  }
  
  getAverageFPS(): number {
    if (this.fpsHistory.length === 0) return 0
    return this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
  }
  
  getMinFPS(): number {
    return Math.min(...this.fpsHistory)
  }
  
  getMaxFrameTime(): number {
    return Math.max(...this.frameTimeHistory)
  }
  
  isStable(): boolean {
    if (this.fpsHistory.length < 30) return false
    const avg = this.getAverageFPS()
    const variance = this.fpsHistory.reduce((sum, fps) => {
      return sum + Math.pow(fps - avg, 2)
    }, 0) / this.fpsHistory.length
    const stdDev = Math.sqrt(variance)
    return stdDev < 5 // Less than 5 FPS standard deviation
  }
}
```

### 2. Performance Benchmarks

#### Test Scenarios

1. **Low Load (5,000 particles)**
   - Target: 60 FPS stable
   - Max frame time: < 16.67ms
   - GPU usage: < 30%

2. **Medium Load (20,000 particles)**
   - Target: 60 FPS stable
   - Max frame time: < 16.67ms
   - GPU usage: < 60%

3. **High Load (50,000 particles)**
   - Target: 60 FPS stable
   - Max frame time: < 16.67ms
   - GPU usage: < 90%

4. **Ultra Load (100,000 particles)**
   - Target: 60 FPS stable (may drop to 30 FPS on low-end devices)
   - Max frame time: < 33.33ms
   - GPU usage: < 95%

### 3. Device Testing Matrix

| Device Type | GPU | Expected Tier | Target FPS |
|------------|-----|---------------|------------|
| High-end Desktop | RTX 3080+ | Ultra | 60+ |
| Mid-range Desktop | GTX 1660+ | High | 60 |
| Low-end Desktop | Integrated | Medium | 30-60 |
| High-end Mobile | Adreno 660+ | Medium | 30-60 |
| Low-end Mobile | Mali-G52 | Low | 15-30 |

### 4. Network Latency Tests

- **Local (localhost)**: < 1ms latency
- **LAN**: < 10ms latency
- **WAN**: < 50ms latency
- **High Latency**: 100-200ms (should use prediction)

### 5. Validation Checklist

- [ ] Average FPS >= 60 for target tier
- [ ] Frame time consistency (jitter < 5ms)
- [ ] No visible stuttering
- [ ] Smooth interpolation between updates
- [ ] Automatic tier adjustment works
- [ ] WebSocket reconnection works
- [ ] Memory usage stable (< 500MB)
- [ ] CPU usage reasonable (< 50% single core)

### 6. Automated Testing Script

```bash
#!/bin/bash
# test-performance.sh

echo "Starting performance tests..."

# Test 1: Frame rate stability
echo "Test 1: Frame Rate Stability"
# Run for 60 seconds and check FPS
# Expected: Average >= 55 FPS, Min >= 45 FPS

# Test 2: Particle count scaling
echo "Test 2: Particle Count Scaling"
# Test with 5K, 20K, 50K, 100K particles
# Expected: Automatic tier adjustment

# Test 3: Network simulation
echo "Test 3: Network Latency"
# Simulate various latencies
# Expected: Prediction/interpolation adapts

# Test 4: Memory leak check
echo "Test 4: Memory Leak Check"
# Run for 5 minutes, check memory growth
# Expected: < 10% memory growth

echo "Tests complete!"
```

### 7. Performance Metrics to Log

- Frame time (ms)
- FPS (current, average, min, max)
- Particle count
- GPU usage (%)
- CPU usage (%)
- Memory usage (MB)
- Network latency (ms)
- WebSocket message rate (Hz)
- Interpolation usage (%)
- Prediction usage (%)

### 8. Success Criteria

✅ **Pass**: Average FPS >= 55, Min FPS >= 45, Stable performance
⚠️ **Warning**: Average FPS 45-55, Some stuttering
❌ **Fail**: Average FPS < 45, Constant stuttering

## Running Tests

1. Start backend: `cd backend && cargo run --release`
2. Open frontend in browser with DevTools Performance tab
3. Navigate to ecosystem phase
4. Monitor FPS and frame times
5. Check console for performance tier logs
6. Verify automatic quality scaling

