#!/bin/bash

echo "Building backend WITHOUT CUDA (CPU fallback mode)..."
echo "This will be faster but won't use GPU acceleration."

cd /404-public/repo/backend

# Kill any existing build processes
pkill -f "cargo build" || true

# Build without cuda-kernel feature for faster compilation
cargo build --release

if [ -f target/release/physics-backend ]; then
    echo "✓ Backend built successfully (CPU mode)"
    
    # Start with PM2
    pm2 delete 404-backend 2>/dev/null || true
    pm2 start target/release/physics-backend --name 404-backend
    pm2 save
    
    echo "Backend started successfully!"
    sleep 2
    
    # Test API
    echo "Testing backend API..."
    curl -X POST http://localhost:3001/api/simulate/boids \
      -H "Content-Type: application/json" \
      -d '{"simulation_type":"boids","steps":1}' 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
acc = data.get('accelerator', 'unknown')
print(f'Accelerator: {acc}')
if 'positions' in data:
    print(f'Simulation working! Generated {len(data[\"positions\"])} positions')
"
    
    echo ""
    echo "Backend is running in CPU mode. Visit https://staging.too.foo/"
    echo "GPU Performance section will show 'CPU 1000 samples'"
    echo ""
    echo "To enable CUDA later, run:"
    echo "  /404-public/repo/backend/build-cuda-incremental.sh"
else
    echo "ERROR: Build failed!"
fi
