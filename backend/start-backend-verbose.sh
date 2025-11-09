#!/bin/bash
set -x  # Enable command echo

echo "================================================================"
echo "VERBOSE BACKEND START SCRIPT"
echo "================================================================"
echo "Timestamp: $(date)"
echo "Current directory: $(pwd)"
echo ""

echo "================================================================"
echo "STEP 1: CHECKING EXISTING PROCESSES"
echo "================================================================"

echo "Checking for existing physics-backend processes..."
ps aux | grep -E "physics-backend|cargo.*release" | grep -v grep || echo "No existing processes found"

echo ""
echo "Checking PM2 status..."
pm2 list 2>&1 || echo "WARNING: PM2 might not be running"

echo ""
echo "================================================================"
echo "STEP 2: CLEANING UP OLD PROCESSES"
echo "================================================================"

echo "Killing any existing physics-backend processes..."
pkill -f physics-backend 2>&1 && echo "✓ Killed existing processes" || echo "No processes to kill"

echo ""
echo "Deleting PM2 404-backend if exists..."
pm2 delete 404-backend 2>&1 || echo "No existing PM2 process to delete"

echo ""
echo "================================================================"
echo "STEP 3: SETTING ENVIRONMENT VARIABLES"
echo "================================================================"

export BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include"
export CUDA_PATH=/usr/local/cuda-12.3
export PATH=/usr/local/cuda-12.3/bin:$PATH
export RUST_BACKTRACE=1
export RUST_LOG=debug  # Enable debug logging

echo "BINDGEN_EXTRA_CLANG_ARGS=$BINDGEN_EXTRA_CLANG_ARGS"
echo "CUDA_PATH=$CUDA_PATH"
echo "PATH=$PATH"
echo "RUST_BACKTRACE=$RUST_BACKTRACE"
echo "RUST_LOG=$RUST_LOG"

echo ""
echo "================================================================"
echo "STEP 4: VERIFYING BACKEND BINARY"
echo "================================================================"

cd /404-public/repo/backend || { echo "ERROR: Cannot cd to backend directory"; exit 1; }

if [ -f "target/release/physics-backend" ]; then
    echo "✓ Backend binary found"
    ls -lh target/release/physics-backend
    echo ""
    echo "Binary was built: $(stat -c %y target/release/physics-backend)"
else
    echo "ERROR: Backend binary not found!"
    echo "Please run: /404-public/repo/backend/build-backend-verbose.sh"
    echo ""
    echo "Contents of target/release:"
    ls -la target/release/ 2>&1 | head -20
    exit 1
fi

echo ""
echo "================================================================"
echo "STEP 5: TESTING BACKEND DIRECTLY"
echo "================================================================"

echo "Testing if backend can start (5 second test)..."
timeout 5 ./target/release/physics-backend 2>&1 | head -30 &
BACKEND_PID=$!
sleep 2

echo ""
echo "Checking if test backend is running..."
if ps -p $BACKEND_PID > /dev/null 2>&1; then
    echo "✓ Backend started successfully in test mode"
    kill $BACKEND_PID 2>/dev/null
else
    echo "⚠ Backend exited during test - checking for errors above"
fi

echo ""
echo "================================================================"
echo "STEP 6: STARTING WITH PM2"
echo "================================================================"

echo "Starting backend with PM2..."
echo "Command: pm2 start target/release/physics-backend --name 404-backend --log-date-format 'YYYY-MM-DD HH:mm:ss'"

pm2 start target/release/physics-backend \
    --name 404-backend \
    --log-date-format 'YYYY-MM-DD HH:mm:ss' \
    --merge-logs \
    --time 2>&1

PM2_EXIT=$?
echo "PM2 start exit code: $PM2_EXIT"

if [ $PM2_EXIT -eq 0 ]; then
    echo "✓ PM2 start command succeeded"
else
    echo "ERROR: PM2 start failed with code $PM2_EXIT"
fi

echo ""
echo "Saving PM2 configuration..."
pm2 save 2>&1

echo ""
echo "================================================================"
echo "STEP 7: VERIFYING PM2 STATUS"
echo "================================================================"

sleep 2
echo "Current PM2 process list:"
pm2 list

echo ""
echo "PM2 info for 404-backend:"
pm2 info 404-backend 2>&1 || echo "Could not get PM2 info"

echo ""
echo "================================================================"
echo "STEP 8: CHECKING LOGS"
echo "================================================================"

echo "Last 30 lines of PM2 logs for 404-backend:"
pm2 logs 404-backend --lines 30 --nostream 2>&1 || echo "Could not get PM2 logs"

echo ""
echo "================================================================"
echo "STEP 9: TESTING API ENDPOINT"
echo "================================================================"

echo "Waiting 3 seconds for backend to fully start..."
sleep 3

echo ""
echo "Testing boids simulation endpoint..."
echo "Command: curl -X POST http://localhost:3001/api/simulate/boids -H 'Content-Type: application/json' -d '{\"simulation_type\":\"boids\",\"steps\":1}'"
echo ""

RESPONSE=$(curl -X POST http://localhost:3001/api/simulate/boids \
    -H "Content-Type: application/json" \
    -d '{"simulation_type":"boids","steps":1}' \
    -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}\n" \
    -s 2>&1) || {
    echo "ERROR: curl command failed"
    echo "Response: $RESPONSE"
}

echo "API Response:"
echo "$RESPONSE" | head -n -2  # Show response without status codes

echo ""
echo "Request metadata:"
echo "$RESPONSE" | tail -2  # Show status codes

echo ""
echo "Checking accelerator type..."
echo "$RESPONSE" | grep -o '"accelerator":"[^"]*"' || echo "No accelerator field found"

echo ""
echo "================================================================"
echo "STEP 10: NETWORK DIAGNOSTICS"
echo "================================================================"

echo "Checking if port 3001 is listening..."
netstat -tulpn 2>&1 | grep 3001 || lsof -i :3001 2>&1 || echo "Could not check port 3001"

echo ""
echo "================================================================"
echo "FINAL STATUS"
echo "================================================================"

pm2 status

echo ""
if pm2 list | grep -q "404-backend.*online"; then
    echo "✅ SUCCESS: Backend is running!"
    echo ""
    echo "Next steps:"
    echo "1. Visit: https://staging.too.foo/"
    echo "2. Check GPU Performance section"
    echo "3. Monitor logs: pm2 logs 404-backend --follow"
else
    echo "❌ ERROR: Backend is not running properly"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check logs: pm2 logs 404-backend --lines 100"
    echo "2. Check binary: ./target/release/physics-backend"
    echo "3. Rebuild: /404-public/repo/backend/build-backend-verbose.sh --clean"
fi

echo ""
echo "================================================================"
echo "Script completed: $(date)"
echo "================================================================"
