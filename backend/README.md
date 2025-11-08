# Physics Backend - Test-Driven Development Setup

## Project Structure

```
/404-development/backend/
├── Cargo.toml          # Rust project configuration
├── src/
│   ├── main.rs        # API server entry point
│   ├── cuda.rs        # CUDA context and device management
│   ├── physics/
│   │   ├── mod.rs     # Physics module exports
│   │   ├── sph.rs     # SPH particle physics (stub)
│   │   ├── boids.rs   # Boids algorithm (stub)
│   │   ├── grayscott.rs # Gray-Scott reaction-diffusion (stub)
│   │   └── sdf.rs     # Signed Distance Fields (stub)
│   └── tests.rs       # Integration tests
└── target/            # Build artifacts
```

## Dependencies

- **rustacuda**: CUDA bindings for Rust
- **tokio**: Async runtime
- **axum**: HTTP server framework
- **serde**: Serialization
- **anyhow**: Error handling
- **tracing**: Logging

## Test Framework

### Unit Tests
Each physics module has unit tests that should **FAIL initially** (TDD):
- `test_sph_initialization()` - SPH simulation setup
- `test_sph_step()` - SPH simulation step
- `test_boids_initialization()` - Boids simulation setup
- `test_boids_step()` - Boids simulation step
- `test_grayscott_initialization()` - Gray-Scott setup
- `test_grayscott_step()` - Gray-Scott step
- `test_sdf_initialization()` - SDF renderer setup
- `test_sdf_render()` - SDF rendering

### Integration Tests
Performance and memory tests:
- `test_sph_performance()` - 60 FPS performance target
- `test_boids_performance()` - 10k boids at 60 FPS
- `test_memory_leak_detection()` - Memory leak prevention
- `test_concurrent_simulations()` - Multiple simulations

## Current Status

✅ **Completed:**
- Rust CUDA bindings setup (rustacuda)
- Backend project structure
- TDD test framework
- Failing tests written (as expected)

⏳ **Next Steps:**
1. Implement SPH particle physics
2. Implement Boids algorithm
3. Implement Gray-Scott reaction-diffusion
4. Implement Signed Distance Fields
5. Make all tests pass

## Running Tests

```bash
cd /404-development/backend
source $HOME/.cargo/env
cargo test              # Run all tests
cargo test --release    # Run optimized tests
cargo test -- --nocapture  # Show output
```

## API Endpoints (Planned)

- `GET /health` - Health check
- `POST /api/simulate` - Run physics simulation
  - Request: `{ simulation_type: "sph", parameters: {...} }`
  - Response: `{ success: true, data: {...} }`

## Performance Targets

- **SPH**: 60 FPS (16ms per frame)
- **Boids**: 10,000 agents at 60 FPS
- **Gray-Scott**: 512x512 grid at 60 FPS
- **Memory**: No leaks after 100 create/destroy cycles

