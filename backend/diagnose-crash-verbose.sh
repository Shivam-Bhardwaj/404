#!/bin/bash
set -x  # Enable command echo

echo "================================================================"
echo "BACKEND CRASH DIAGNOSIS SCRIPT"
echo "================================================================"
echo "Timestamp: $(date)"
echo "The backend has crashed 15 times. Let's find out why."
echo ""

echo "================================================================"
echo "STEP 1: PM2 ERROR LOGS (last 100 lines)"
echo "================================================================"
pm2 logs 404-backend --lines 100 --err --nostream 2>&1 || echo "Could not get error logs"

echo ""
echo "================================================================"
echo "STEP 2: PM2 OUTPUT LOGS (last 50 lines)"
echo "================================================================"
pm2 logs 404-backend --lines 50 --out --nostream 2>&1 || echo "Could not get output logs"

echo ""
echo "================================================================"
echo "STEP 3: PM2 DETAILED INFO"
echo "================================================================"
pm2 describe 404-backend 2>&1 || echo "Could not get PM2 description"

echo ""
echo "================================================================"
echo "STEP 4: TESTING BINARY DIRECTLY (outside PM2)"
echo "================================================================"

cd /404-public/repo/backend || exit 1

if [ -f "target/release/physics-backend" ]; then
    echo "Binary found. Testing direct execution..."
    echo "This will show the ACTUAL error message:"
    echo "----------------------------------------"
    
    # Set environment variables
    export RUST_BACKTRACE=full
    export RUST_LOG=debug
    
    # Run for 5 seconds to capture startup errors
    timeout 5 ./target/release/physics-backend 2>&1 | tee /tmp/backend-direct-run.log
    EXIT_CODE=${PIPESTATUS[0]}
    
    echo "----------------------------------------"
    echo "Direct run exit code: $EXIT_CODE"
    
    if [ $EXIT_CODE -eq 124 ]; then
        echo "✓ Backend ran for 5 seconds without crashing (timeout exit)"
        echo "The backend works when run directly!"
    elif [ $EXIT_CODE -eq 0 ]; then
        echo "✓ Backend exited cleanly"
    else
        echo "❌ Backend crashed with exit code: $EXIT_CODE"
        echo ""
        echo "Analyzing crash..."
        
        # Check for common errors
        if grep -q "address already in use" /tmp/backend-direct-run.log; then
            echo "ERROR: Port 3001 is already in use!"
            echo "Checking what's using port 3001:"
            lsof -i :3001 2>&1 || netstat -tulpn 2>&1 | grep 3001
            echo ""
            echo "FIX: Kill the process using port 3001 or change the backend port"
        elif grep -q "error while loading shared libraries" /tmp/backend-direct-run.log; then
            echo "ERROR: Missing shared libraries!"
            echo "Checking library dependencies:"
            ldd target/release/physics-backend | grep "not found"
            echo ""
            echo "FIX: Install missing libraries or rebuild"
        elif grep -q "CUDA\|cuda\|GPU" /tmp/backend-direct-run.log; then
            echo "ERROR: CUDA/GPU initialization failed!"
            echo "FIX: Rebuild without CUDA or fix CUDA installation"
        elif grep -q "Permission denied" /tmp/backend-direct-run.log; then
            echo "ERROR: Permission issues!"
            echo "FIX: Check file permissions"
        else
            echo "Unknown error. Full output saved in /tmp/backend-direct-run.log"
        fi
    fi
else
    echo "❌ Binary not found at target/release/physics-backend"
    echo "Need to build first!"
fi

echo ""
echo "================================================================"
echo "STEP 5: CHECKING SYSTEM RESOURCES"
echo "================================================================"

echo "Memory usage:"
free -h

echo ""
echo "Disk space:"
df -h /404-public

echo ""
echo "CPU load:"
uptime

echo ""
echo "================================================================"
echo "STEP 6: CHECKING PORT AVAILABILITY"
echo "================================================================"

echo "Checking if port 3001 is in use:"
if lsof -i :3001 2>/dev/null; then
    echo "⚠ Port 3001 is in use by another process!"
    echo ""
    echo "To fix, either:"
    echo "1. Kill the process: sudo kill -9 <PID>"
    echo "2. Change backend port in the code"
else
    echo "✓ Port 3001 is available"
fi

echo ""
echo "================================================================"
echo "STEP 7: LIBRARY DEPENDENCIES"
echo "================================================================"

if [ -f "target/release/physics-backend" ]; then
    echo "Checking shared library dependencies:"
    ldd target/release/physics-backend 2>&1 | head -20
    
    echo ""
    echo "Checking for missing libraries:"
    MISSING_LIBS=$(ldd target/release/physics-backend 2>&1 | grep "not found")
    if [ -n "$MISSING_LIBS" ]; then
        echo "❌ MISSING LIBRARIES:"
        echo "$MISSING_LIBS"
        echo ""
        echo "FIX: Install missing libraries or rebuild without CUDA"
    else
        echo "✓ All libraries found"
    fi
fi

echo ""
echo "================================================================"
echo "STEP 8: TESTING WITH STRACE (system calls)"
echo "================================================================"

if command -v strace &> /dev/null; then
    echo "Running with strace to see system calls before crash..."
    timeout 2 strace -e trace=open,openat,bind,connect,execve ./target/release/physics-backend 2>&1 | head -50
else
    echo "strace not installed (install with: sudo apt install strace)"
fi

echo ""
echo "================================================================"
echo "DIAGNOSIS COMPLETE - RECOMMENDATIONS"
echo "================================================================"

# Analyze PM2 restart count
if pm2 list | grep -q "404-backend.*15.*errored"; then
    echo "❌ CRITICAL: Backend crashing immediately on startup (15 restarts)"
    echo ""
    echo "Most likely causes:"
    echo "1. Port 3001 already in use"
    echo "2. Missing CUDA libraries (if built with CUDA)"
    echo "3. Memory/resource limits"
    echo "4. Configuration error"
    echo ""
    echo "IMMEDIATE ACTIONS:"
    echo ""
    echo "1. Stop PM2 process to prevent restart loop:"
    echo "   pm2 stop 404-backend"
    echo "   pm2 delete 404-backend"
    echo ""
    echo "2. Test the binary directly:"
    echo "   cd /404-public/repo/backend"
    echo "   ./target/release/physics-backend"
    echo ""
    echo "3. If direct run works, restart with PM2:"
    echo "   pm2 start target/release/physics-backend --name 404-backend --no-autorestart"
    echo ""
    echo "4. If direct run fails, rebuild without CUDA:"
    echo "   cargo clean"
    echo "   cargo build --release  # No --features cuda-kernel"
    echo ""
    echo "5. Check the full error log above for specific error messages"
fi

echo ""
echo "================================================================"
echo "Full backend log saved to: /tmp/backend-direct-run.log"
echo "================================================================"
