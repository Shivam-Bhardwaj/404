#!/bin/bash
set -e

echo "Setting up environment for CUDA build..."
export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"
export CUDA_PATH=/usr/local/cuda-12.3
export PATH=/usr/local/cuda-12.3/bin:$PATH

echo "Environment variables set:"
echo "  BINDGEN_EXTRA_CLANG_ARGS=$BINDGEN_EXTRA_CLANG_ARGS"
echo "  CUDA_PATH=$CUDA_PATH"
echo "  PATH includes CUDA"

echo "Building backend with CUDA support..."
cd /404-public/repo/backend
cargo clean
cargo build --release --features cuda-kernel

echo "Build complete. Checking binary..."
if [ -f target/release/physics-backend ]; then
    echo "✓ Binary found at target/release/physics-backend"
    ls -lh target/release/physics-backend
else
    echo "✗ Binary not found!"
    echo "Checking build directory contents:"
    ls -la target/release/
fi
