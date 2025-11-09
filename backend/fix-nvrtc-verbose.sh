#!/bin/bash
set -x  # Enable command echo

echo "================================================================"
echo "NVRTC/CUDA BUILD FIX SCRIPT"
echo "================================================================"
echo "This script fixes common CUDA/NVRTC build issues"
echo "Timestamp: $(date)"
echo ""

echo "================================================================"
echo "STEP 1: INSTALLING MISSING DEPENDENCIES"
echo "================================================================"

echo "Checking for libclang-dev..."
if ! dpkg -l | grep -q "libclang-dev"; then
    echo "Installing libclang-dev and clang..."
    sudo apt update -y
    sudo apt install -y libclang-dev clang
    echo "✓ Installed libclang-dev"
else
    echo "✓ libclang-dev already installed"
fi

echo ""
echo "Checking for build-essential..."
if ! dpkg -l | grep -q "build-essential"; then
    echo "Installing build-essential..."
    sudo apt install -y build-essential
    echo "✓ Installed build-essential"
else
    echo "✓ build-essential already installed"
fi

echo ""
echo "================================================================"
echo "STEP 2: VERIFYING CUDA INSTALLATION"
echo "================================================================"

if [ -d "/usr/local/cuda-12.3" ]; then
    echo "✓ CUDA 12.3 directory found"
    echo "CUDA contents:"
    ls -la /usr/local/cuda-12.3/ | head -10
    
    if [ -f "/usr/local/cuda-12.3/bin/nvcc" ]; then
        echo "✓ nvcc compiler found"
        /usr/local/cuda-12.3/bin/nvcc --version 2>&1 | head -3
    else
        echo "❌ nvcc not found in CUDA directory"
        echo "CUDA installation might be incomplete"
    fi
elif [ -d "/usr/local/cuda" ]; then
    echo "⚠ Found /usr/local/cuda but not /usr/local/cuda-12.3"
    echo "Creating symlink..."
    sudo ln -sf /usr/local/cuda /usr/local/cuda-12.3
    echo "✓ Created symlink"
else
    echo "❌ CUDA not found at /usr/local/cuda or /usr/local/cuda-12.3"
    echo "Please install CUDA toolkit first"
fi

echo ""
echo "================================================================"
echo "STEP 3: FIXING HEADER PATHS"
echo "================================================================"

echo "Looking for stddef.h..."
STDDEF_PATHS=$(find /usr/lib/gcc /usr/include -name stddef.h 2>/dev/null | head -5)
if [ -n "$STDDEF_PATHS" ]; then
    echo "Found stddef.h at:"
    echo "$STDDEF_PATHS"
    
    # Get the first path's directory
    FIRST_STDDEF=$(echo "$STDDEF_PATHS" | head -1)
    INCLUDE_DIR=$(dirname "$FIRST_STDDEF")
    echo ""
    echo "Will use include directory: $INCLUDE_DIR"
    export BINDGEN_EXTRA_CLANG_ARGS="-I$INCLUDE_DIR"
else
    echo "❌ Could not find stddef.h"
    echo "Using default: -I/usr/lib/gcc/x86_64-linux-gnu/13/include"
    export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"
fi

echo ""
echo "================================================================"
echo "STEP 4: SETTING ALL ENVIRONMENT VARIABLES"
echo "================================================================"

export CUDA_PATH=/usr/local/cuda-12.3
export PATH=/usr/local/cuda-12.3/bin:$PATH
export LD_LIBRARY_PATH=/usr/local/cuda-12.3/lib64:$LD_LIBRARY_PATH
export RUST_BACKTRACE=full
export CARGO_BUILD_JOBS=4  # Limit parallel jobs to avoid memory issues

echo "Environment variables set:"
echo "  BINDGEN_EXTRA_CLANG_ARGS=$BINDGEN_EXTRA_CLANG_ARGS"
echo "  CUDA_PATH=$CUDA_PATH"
echo "  PATH=$PATH"
echo "  LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
echo "  RUST_BACKTRACE=$RUST_BACKTRACE"
echo "  CARGO_BUILD_JOBS=$CARGO_BUILD_JOBS"

echo ""
echo "================================================================"
echo "STEP 5: CLEANING BUILD CACHE"
echo "================================================================"

cd /404-public/repo/backend || exit 1

echo "Cleaning Cargo build cache..."
cargo clean -v
rm -rf ~/.cargo/registry/cache/
rm -rf ~/.cargo/git/db/

echo "✓ Build cache cleaned"

echo ""
echo "================================================================"
echo "STEP 6: ATTEMPTING INCREMENTAL BUILD"
echo "================================================================"

echo "First, building dependencies only..."
cargo build --release --features cuda-kernel -v 2>&1 | tee /tmp/deps-build.log | grep -E "Compiling|Building|error" &
BUILD_PID=$!

# Monitor build progress
COUNTER=0
while kill -0 $BUILD_PID 2>/dev/null; do
    sleep 5
    COUNTER=$((COUNTER + 5))
    echo "  ... building for ${COUNTER}s ..."
    
    if [ $COUNTER -gt 300 ]; then
        echo "⚠ Build taking too long, might be stuck at linking"
        echo "Killing build process..."
        kill -9 $BUILD_PID 2>/dev/null
        break
    fi
done

wait $BUILD_PID
BUILD_EXIT=$?

echo ""
if [ $BUILD_EXIT -eq 0 ]; then
    echo "✓ Build completed successfully!"
else
    echo "Build failed or was interrupted (exit code: $BUILD_EXIT)"
    echo ""
    echo "Last 50 lines of build log:"
    tail -50 /tmp/deps-build.log
    
    echo ""
    echo "================================================================"
    echo "FALLING BACK TO CPU BUILD"
    echo "================================================================"
    
    echo "Building without CUDA support..."
    cargo build --release -v
fi

echo ""
echo "================================================================"
echo "STEP 7: VERIFYING BUILD"
echo "================================================================"

if [ -f "target/release/physics-backend" ]; then
    echo "✓ Backend binary created successfully!"
    ls -lh target/release/physics-backend
    
    echo ""
    echo "Testing binary..."
    timeout 2 ./target/release/physics-backend 2>&1 | head -10
    
    echo ""
    echo "✅ BUILD FIXED!"
    echo ""
    echo "Now run: /404-public/repo/backend/start-backend-verbose.sh"
else
    echo "❌ Build still failing"
    echo ""
    echo "Manual steps to try:"
    echo "1. Check Rust version: rustup update"
    echo "2. Clear all caches: rm -rf target/ ~/.cargo/registry/"
    echo "3. Try CPU-only build: cargo build --release"
    echo "4. Check disk space: df -h"
    echo "5. Check memory: free -h"
fi

echo ""
echo "================================================================"
echo "Script completed: $(date)"
echo "================================================================"
