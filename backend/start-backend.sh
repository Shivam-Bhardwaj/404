#!/bin/bash

# Kill any existing physics-backend processes
pkill -f physics-backend || true

# Set environment variables
export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"
export CUDA_PATH=/usr/local/cuda-12.3
export PATH=/usr/local/cuda-12.3/bin:$PATH

cd /404-public/repo/backend

echo "Building backend with CUDA support..."
cargo build --release --features cuda-kernel

if [ -f target/release/physics-backend ]; then
    echo "Starting backend with PM2..."
    pm2 delete 404-backend 2>/dev/null || true
    pm2 start target/release/physics-backend --name 404-backend
    pm2 save
    echo "Backend started successfully!"
    sleep 2
    echo "Testing CUDA acceleration..."
    curl -X POST http://localhost:3001/api/simulate/boids \
      -H "Content-Type: application/json" \
      -d '{"simulation_type":"boids","steps":1}' 2>/dev/null | grep -o '"accelerator":"[^"]*"' || echo "Could not verify accelerator"
else
    echo "ERROR: Binary not found after build!"
    echo "Try running manually:"
    echo "  cd /404-public/repo/backend"
    echo "  export BINDGEN_EXTRA_CLANG_ARGS=\"-I/usr/lib/gcc/x86_64-linux-gnu/13/include\""
    echo "  export CUDA_PATH=/usr/local/cuda-12.3"
    echo "  export PATH=/usr/local/cuda-12.3/bin:\$PATH"
    echo "  cargo build --release --features cuda-kernel"
fi
