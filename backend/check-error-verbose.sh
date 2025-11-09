#!/bin/bash
set -x  # Enable command echo

echo "================================================================"
echo "CHECKING ACTUAL ERROR FROM SAVED LOG"
echo "================================================================"

echo "Checking direct run log for the actual error:"
echo "----------------------------------------"
cat /tmp/backend-direct-run.log 2>/dev/null || echo "Log file not found"
echo "----------------------------------------"

echo ""
echo "================================================================"
echo "CHECKING PM2 ERROR LOG"
echo "================================================================"
pm2 logs 404-backend --lines 20 --err --nostream 2>&1 | grep -v "PM2" | grep -v "=====" | head -20

echo ""
echo "================================================================"
echo "Now running quick fix to get backend working..."
echo "================================================================"
