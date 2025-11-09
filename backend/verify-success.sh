#!/bin/bash

echo "================================================================"
echo "VERIFYING BACKEND SUCCESS"
echo "================================================================"
echo ""

echo "1. PM2 Status:"
pm2 list | grep 404-backend || echo "Backend not in PM2"

echo ""
echo "2. Testing API:"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/simulate/boids \
    -H "Content-Type: application/json" \
    -d '{"simulation_type":"boids","steps":1}' 2>/dev/null)

if echo "$RESPONSE" | grep -q "positions"; then
    echo "   ✅ API is working!"
    
    ACCELERATOR=$(echo "$RESPONSE" | grep -o '"accelerator":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$ACCELERATOR" ]; then
        echo "   Accelerator: $ACCELERATOR"
        if [ "$ACCELERATOR" = "cuda" ]; then
            echo "   ✅ GPU ACCELERATION IS ACTIVE!"
        else
            echo "   ⚠️ Running in CPU mode"
        fi
    fi
else
    echo "   ❌ API not responding"
fi

echo ""
echo "3. Visit https://staging.too.foo/"
echo "   - Check the GPU Performance section"
echo "   - Should show 'CUDA 1000 samples' if GPU is active"
echo "   - Or 'CPU 1000 samples' if running in CPU mode"
echo ""
echo "================================================================"
