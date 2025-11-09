#!/bin/bash
set -x  # Enable command echo

echo "================================================================"
echo "BACKEND DIAGNOSTIC TEST SCRIPT"
echo "================================================================"
echo "Timestamp: $(date)"
echo ""

echo "================================================================"
echo "QUICK CHECKS"
echo "================================================================"

echo "1. Checking if backend binary exists..."
if [ -f "/404-public/repo/backend/target/release/physics-backend" ]; then
    echo "   ✓ Binary exists"
    ls -lh /404-public/repo/backend/target/release/physics-backend
else
    echo "   ❌ Binary NOT found"
    echo "   Run: /404-public/repo/backend/build-backend-verbose.sh"
    exit 1
fi

echo ""
echo "2. Checking PM2 status..."
pm2 list | grep 404-backend || echo "   ❌ Not in PM2"

echo ""
echo "3. Checking if port 3001 is open..."
nc -zv localhost 3001 2>&1 || echo "   ❌ Port 3001 not responding"

echo ""
echo "4. Testing API health..."
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n   Response Time: %{time_total}s\n" \
    http://localhost:3001/api/simulate/boids \
    -X POST -H "Content-Type: application/json" \
    -d '{"simulation_type":"boids","steps":1}' 2>&1 || echo "   ❌ API not responding"

echo ""
echo "5. Checking for CUDA acceleration..."
ACCEL=$(curl -s -X POST http://localhost:3001/api/simulate/boids \
    -H "Content-Type: application/json" \
    -d '{"simulation_type":"boids","steps":1}' 2>&1 | \
    grep -o '"accelerator":"[^"]*"' | cut -d'"' -f4)

if [ -n "$ACCEL" ]; then
    echo "   Accelerator: $ACCEL"
    if [ "$ACCEL" = "cuda" ]; then
        echo "   ✓ CUDA acceleration ACTIVE"
    else
        echo "   ⚠ Running in CPU mode"
    fi
else
    echo "   ❌ Could not determine accelerator"
fi

echo ""
echo "================================================================"
echo "PM2 LOGS (last 20 lines)"
echo "================================================================"
pm2 logs 404-backend --lines 20 --nostream 2>&1 || echo "No PM2 logs available"

echo ""
echo "================================================================"
echo "RECOMMENDATIONS"
echo "================================================================"

if ! pm2 list | grep -q "404-backend.*online"; then
    echo "Backend is NOT running. Try:"
    echo "  /404-public/repo/backend/start-backend-verbose.sh"
elif [ "$ACCEL" != "cuda" ]; then
    echo "Backend running but WITHOUT CUDA. To enable GPU:"
    echo "  1. /404-public/repo/backend/build-backend-verbose.sh --clean"
    echo "  2. /404-public/repo/backend/start-backend-verbose.sh"
else
    echo "✅ Everything looks good!"
    echo "Visit https://staging.too.foo/ to see GPU acceleration in action"
fi

echo ""
echo "================================================================"
