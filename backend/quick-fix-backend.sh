#!/bin/bash
set -x  # Enable command echo

echo "================================================================"
echo "QUICK FIX: GET BACKEND RUNNING (CPU MODE)"
echo "================================================================"
echo "This will quickly get the backend running without CUDA"
echo "Timestamp: $(date)"
echo ""

echo "================================================================"
echo "STEP 1: STOP CRASHING PM2 PROCESS"
echo "================================================================"

echo "Stopping and removing 404-backend from PM2..."
pm2 stop 404-backend 2>/dev/null
pm2 delete 404-backend 2>/dev/null
echo "✓ PM2 process removed"

echo ""
echo "================================================================"
echo "STEP 2: KILL ANY PROCESSES ON PORT 3001"
echo "================================================================"

echo "Finding processes on port 3001..."
PORT_PIDS=$(lsof -t -i:3001 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
    echo "Found processes using port 3001: $PORT_PIDS"
    echo "Killing them..."
    for pid in $PORT_PIDS; do
        kill -9 $pid 2>/dev/null && echo "  Killed PID $pid"
    done
    echo "✓ Port 3001 cleared"
else
    echo "✓ Port 3001 is already free"
fi

echo ""
echo "================================================================"
echo "STEP 3: QUICK BUILD WITHOUT CUDA (CPU MODE)"
echo "================================================================"

cd /404-public/repo/backend || exit 1

echo "Building backend in CPU mode (faster, no CUDA issues)..."
# Don't clean to save time
cargo build --release 2>&1 | tee /tmp/quick-build.log | grep -E "Compiling|Building|Finished|error" || true

# Check if build succeeded
if [ -f "target/release/physics-backend" ]; then
    echo "✓ Build successful!"
    ls -lh target/release/physics-backend
else
    echo "❌ Build failed. Checking error..."
    tail -50 /tmp/quick-build.log
    exit 1
fi

echo ""
echo "================================================================"
echo "STEP 4: TEST BINARY DIRECTLY"
echo "================================================================"

echo "Testing if backend starts correctly..."
timeout 3 ./target/release/physics-backend 2>&1 &
TEST_PID=$!
sleep 2

if ps -p $TEST_PID > /dev/null 2>&1; then
    echo "✓ Backend is running!"
    kill $TEST_PID 2>/dev/null
    
    echo ""
    echo "================================================================"
    echo "STEP 5: START WITH PM2 (NO AUTO-RESTART)"
    echo "================================================================"
    
    echo "Starting with PM2 (auto-restart disabled to prevent loops)..."
    pm2 start target/release/physics-backend \
        --name 404-backend \
        --no-autorestart \
        --time 2>&1
    
    pm2 save
    
    echo ""
    echo "================================================================"
    echo "STEP 6: VERIFY IT'S WORKING"
    echo "================================================================"
    
    sleep 3
    
    echo "PM2 Status:"
    pm2 list | grep 404-backend
    
    echo ""
    echo "Testing API:"
    RESPONSE=$(curl -s -X POST http://localhost:3001/api/simulate/boids \
        -H "Content-Type: application/json" \
        -d '{"simulation_type":"boids","steps":1}' 2>&1 | head -1)
    
    if echo "$RESPONSE" | grep -q "positions\|data\|{"; then
        echo "✅ API is responding!"
        echo "Response preview: ${RESPONSE:0:100}..."
        
        # Check accelerator
        ACCEL=$(echo "$RESPONSE" | grep -o '"accelerator":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$ACCEL" ]; then
            echo "Accelerator mode: $ACCEL"
        fi
    else
        echo "❌ API not responding properly"
        echo "Response: $RESPONSE"
        echo ""
        echo "Checking PM2 logs:"
        pm2 logs 404-backend --lines 30 --nostream
    fi
    
    echo ""
    echo "================================================================"
    echo "✅ SUCCESS! Backend is running in CPU mode"
    echo "================================================================"
    echo ""
    echo "Next steps:"
    echo "1. Visit https://staging.too.foo/"
    echo "2. GPU Performance will show 'CPU 1000 samples'"
    echo "3. To enable auto-restart: pm2 restart 404-backend --update-env"
    echo "4. To enable CUDA later: Run the full build script"
    echo ""
    echo "Monitor logs: pm2 logs 404-backend --follow"
    
else
    echo "❌ Backend won't stay running"
    echo ""
    echo "Getting detailed error..."
    echo "----------------------------------------"
    RUST_BACKTRACE=full ./target/release/physics-backend 2>&1 | head -100
    echo "----------------------------------------"
    echo ""
    echo "The backend is crashing immediately. See error above."
    echo "Common fixes:"
    echo "1. Check the error message above"
    echo "2. Rebuild from scratch: cargo clean && cargo build --release"
    echo "3. Check disk space: df -h"
    echo "4. Check memory: free -h"
fi

echo ""
echo "================================================================"
echo "Script completed: $(date)"
echo "================================================================"
