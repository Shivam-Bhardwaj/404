#!/bin/bash
set -x  # Enable command echo
set -e  # Exit on error

echo "================================================================"
echo "VERBOSE BACKEND BUILD SCRIPT"
echo "================================================================"
echo "Timestamp: $(date)"
echo "Current directory: $(pwd)"
echo "User: $(whoami)"
echo ""

echo "================================================================"
echo "STEP 1: CHECKING SYSTEM PREREQUISITES"
echo "================================================================"

echo "Checking Rust installation..."
which rustc && rustc --version || { echo "ERROR: Rust not found!"; exit 1; }
which cargo && cargo --version || { echo "ERROR: Cargo not found!"; exit 1; }

echo ""
echo "Checking CUDA installation..."
if [ -d "/usr/local/cuda-12.3" ]; then
    echo "✓ CUDA directory found: /usr/local/cuda-12.3"
    ls -la /usr/local/cuda-12.3/bin/nvcc 2>&1 || echo "WARNING: nvcc not found"
else
    echo "WARNING: CUDA directory not found at /usr/local/cuda-12.3"
fi

echo ""
echo "Checking libclang installation..."
dpkg -l | grep -E "libclang-dev|clang" | head -5 || echo "WARNING: libclang-dev not found"

echo ""
echo "Checking GCC headers..."
ls -la /usr/lib/gcc/x86_64-linux-gnu/13/include/stddef.h 2>&1 || echo "WARNING: GCC headers not found"

echo ""
echo "================================================================"
echo "STEP 2: SETTING ENVIRONMENT VARIABLES"
echo "================================================================"

export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"
export CUDA_PATH=/usr/local/cuda-12.3
export PATH=/usr/local/cuda-12.3/bin:$PATH
export RUST_BACKTRACE=1  # Enable full backtraces

echo "BINDGEN_EXTRA_CLANG_ARGS=$BINDGEN_EXTRA_CLANG_ARGS"
echo "CUDA_PATH=$CUDA_PATH"
echo "PATH=$PATH"
echo "RUST_BACKTRACE=$RUST_BACKTRACE"

echo ""
echo "================================================================"
echo "STEP 3: PREPARING BUILD DIRECTORY"
echo "================================================================"

cd /404-public/repo/backend || { echo "ERROR: Cannot cd to backend directory"; exit 1; }
echo "Working directory: $(pwd)"

echo ""
echo "Checking Cargo.toml..."
if [ -f "Cargo.toml" ]; then
    echo "✓ Cargo.toml found"
    grep -E "name|version|\[features\]|cuda" Cargo.toml | head -10
else
    echo "ERROR: Cargo.toml not found!"
    exit 1
fi

echo ""
echo "================================================================"
echo "STEP 4: CLEANING PREVIOUS BUILD (if requested)"
echo "================================================================"

if [ "$1" == "--clean" ]; then
    echo "Cleaning previous build artifacts..."
    cargo clean -v
    echo "✓ Clean complete"
else
    echo "Skipping clean (use --clean to force clean build)"
fi

echo ""
echo "================================================================"
echo "STEP 5: ATTEMPTING BUILD WITH CUDA SUPPORT"
echo "================================================================"

echo "Building with cuda-kernel feature..."
echo "Command: cargo build --release --features cuda-kernel -vv"
echo ""

# Try to build with timeout
timeout 300 cargo build --release --features cuda-kernel -vv 2>&1 | tee /tmp/cuda-build.log || {
    EXIT_CODE=$?
    echo ""
    echo "================================================================"
    echo "BUILD FAILED OR TIMED OUT (exit code: $EXIT_CODE)"
    echo "================================================================"
    
    if [ $EXIT_CODE -eq 124 ]; then
        echo "Build timed out after 5 minutes. The linker might be hanging."
        echo "Checking what was built..."
        ls -la target/release/ 2>&1 | grep -v "\.d$" | head -20
        
        echo ""
        echo "Last 50 lines of build log:"
        tail -50 /tmp/cuda-build.log
    else
        echo "Build failed with error. Last 100 lines of output:"
        tail -100 /tmp/cuda-build.log
    fi
    
    echo ""
    echo "================================================================"
    echo "FALLING BACK TO CPU-ONLY BUILD"
    echo "================================================================"
    
    echo "Building WITHOUT cuda-kernel feature..."
    cargo build --release -vv 2>&1 | tee /tmp/cpu-build.log || {
        echo "ERROR: CPU build also failed!"
        echo "Last 50 lines of CPU build log:"
        tail -50 /tmp/cpu-build.log
        exit 1
    }
}

echo ""
echo "================================================================"
echo "STEP 6: VERIFYING BUILD OUTPUT"
echo "================================================================"

if [ -f "target/release/physics-backend" ]; then
    echo "✓ Binary successfully built: target/release/physics-backend"
    ls -lh target/release/physics-backend
    echo ""
    echo "Binary info:"
    file target/release/physics-backend
    echo ""
    echo "Linked libraries:"
    ldd target/release/physics-backend 2>&1 | head -20
else
    echo "ERROR: Binary not found at target/release/physics-backend"
    echo ""
    echo "Contents of target/release/:"
    ls -la target/release/ | head -30
    exit 1
fi

echo ""
echo "================================================================"
echo "STEP 7: TESTING BACKEND EXECUTABLE"
echo "================================================================"

echo "Testing if backend starts..."
timeout 2 ./target/release/physics-backend 2>&1 | head -20 || true

echo ""
echo "================================================================"
echo "BUILD COMPLETE"
echo "================================================================"
echo "Timestamp: $(date)"
echo ""
echo "Next steps:"
echo "1. Run: /404-public/repo/backend/start-backend-verbose.sh"
echo "2. Check: pm2 status"
echo "3. Test: curl http://localhost:3001/api/simulate/boids"
echo "================================================================"
