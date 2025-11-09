#!/bin/bash
set -e

echo "=== Fixing NVRTC Build Error ==="
echo ""

# Step 1: Install required dependencies
echo "Step 1: Installing libclang-dev and clang..."
sudo apt update
sudo apt install -y libclang-dev clang

# Step 2: Set environment variables
echo ""
echo "Step 2: Setting environment variables..."
export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"
export CUDA_PATH=/usr/local/cuda-12.3
export PATH=/usr/local/cuda-12.3/bin:$PATH

# Make environment variables persistent for current session
echo "Environment variables set:"
echo "  BINDGEN_EXTRA_CLANG_ARGS=$BINDGEN_EXTRA_CLANG_ARGS"
echo "  CUDA_PATH=$CUDA_PATH"
echo "  PATH includes: $CUDA_PATH/bin"

# Step 3: Clean and rebuild backend with CUDA support
echo ""
echo "Step 3: Cleaning and rebuilding backend with cuda-kernel feature..."
cd /404-public/repo/backend
cargo clean
cargo build --release --features cuda-kernel

# Step 4: Restart backend service
echo ""
echo "Step 4: Restarting backend service..."
pm2 restart 404-backend
pm2 save

# Step 5: Verify CUDA acceleration
echo ""
echo "Step 5: Verifying CUDA acceleration..."
sleep 2  # Give backend time to start
curl -X POST http://localhost:3001/api/simulate/boids \
  -H "Content-Type: application/json" \
  -d '{"simulation_type":"boids","steps":1}' 2>/dev/null | grep -o '"accelerator":"[^"]*"' || echo "Warning: Could not verify accelerator status"

echo ""
echo "=== Done ==="
echo "Check https://staging.too.foo/ - GPU Performance section should show 'CUDA 1000 samples'"

