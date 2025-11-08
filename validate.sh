#!/bin/bash

# Validation script for too.foo production setup
# Tests all components of the zero-downtime deployment system

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Test functions
test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

test_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

echo "=========================================="
echo "too.foo Production Environment Validation"
echo "=========================================="
echo ""

# 1. Check Docker installation
echo "1. Checking Docker installation..."
if command -v docker &> /dev/null; then
    test_pass "Docker is installed: $(docker --version)"
else
    test_fail "Docker is not installed"
fi

if docker compose version &> /dev/null; then
    test_pass "Docker Compose is available"
else
    test_fail "Docker Compose is not available"
fi

# 2. Check Docker network
echo ""
echo "2. Checking Docker networks..."
if docker network ls | grep -q "web"; then
    test_pass "Docker network 'web' exists"
else
    test_fail "Docker network 'web' does not exist"
fi

# 3. Check Traefik
echo ""
echo "3. Checking Traefik..."
if docker ps | grep -q "traefik"; then
    test_pass "Traefik container is running"
    if curl -sf http://localhost:8080/ping &> /dev/null; then
        test_pass "Traefik API is accessible"
    else
        test_warn "Traefik API is not accessible (may need configuration)"
    fi
else
    test_fail "Traefik container is not running"
fi

# 4. Check application containers
echo ""
echo "4. Checking application containers..."
cd /404-public/repo || exit 1

if docker ps | grep -q "404-app"; then
    test_pass "Application container(s) are running"
    
    # Test health endpoints
    APP_CONTAINER=$(docker ps --filter "name=404-app" --format "{{.Names}}" | head -1)
    if [ -n "$APP_CONTAINER" ]; then
        if docker exec "$APP_CONTAINER" node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" &> /dev/null; then
            test_pass "Health endpoint is responding"
        else
            test_fail "Health endpoint is not responding"
        fi
        
        if docker exec "$APP_CONTAINER" node -e "require('http').get('http://localhost:3000/api/ready', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" &> /dev/null; then
            test_pass "Readiness endpoint is responding"
        else
            test_fail "Readiness endpoint is not responding"
        fi
    fi
else
    test_fail "Application containers are not running"
fi

# 5. Check monitoring stack
echo ""
echo "5. Checking monitoring stack..."
if docker ps | grep -q "prometheus"; then
    test_pass "Prometheus is running"
else
    test_warn "Prometheus is not running"
fi

if docker ps | grep -q "grafana"; then
    test_pass "Grafana is running"
else
    test_warn "Grafana is not running"
fi

if docker ps | grep -q "loki"; then
    test_pass "Loki is running"
else
    test_warn "Loki is not running"
fi

if docker ps | grep -q "alertmanager"; then
    test_pass "AlertManager is running"
else
    test_warn "AlertManager is not running"
fi

# 6. Check backup system
echo ""
echo "6. Checking backup system..."
if [ -f "/404-system/backup/scripts/backup.sh" ]; then
    test_pass "Backup script exists"
    if [ -x "/404-system/backup/scripts/backup.sh" ]; then
        test_pass "Backup script is executable"
    else
        test_fail "Backup script is not executable"
    fi
else
    test_fail "Backup script does not exist"
fi

if [ -d "/404-system/backups" ]; then
    test_pass "Backup directory exists"
else
    test_warn "Backup directory does not exist"
fi

# 7. Check GitHub Actions workflows
echo ""
echo "7. Checking CI/CD configuration..."
if [ -f "/404-public/repo/.github/workflows/deploy.yml" ]; then
    test_pass "Deployment workflow exists"
else
    test_fail "Deployment workflow does not exist"
fi

if [ -f "/404-public/repo/.github/workflows/test.yml" ]; then
    test_pass "Test workflow exists"
else
    test_fail "Test workflow does not exist"
fi

# 8. Check Docker Compose files
echo ""
echo "8. Checking Docker Compose configurations..."
for file in docker-compose.yml docker-compose.prod.yml docker-compose.staging.yml; do
    if [ -f "/404-public/repo/$file" ]; then
        test_pass "$file exists"
        if docker compose -f "$file" config &> /dev/null; then
            test_pass "$file is valid"
        else
            test_fail "$file has configuration errors"
        fi
    else
        test_fail "$file does not exist"
    fi
done

# 9. Check health check endpoints in code
echo ""
echo "9. Checking health check implementation..."
if [ -f "/404-public/repo/app/api/health/route.ts" ]; then
    test_pass "Health check endpoint exists"
else
    test_fail "Health check endpoint does not exist"
fi

if [ -f "/404-public/repo/app/api/ready/route.ts" ]; then
    test_pass "Readiness check endpoint exists"
else
    test_fail "Readiness check endpoint does not exist"
fi

# 10. Check file permissions
echo ""
echo "10. Checking file permissions..."
if [ -r "/404-system/traefik/traefik.yml" ]; then
    test_pass "Traefik config is readable"
else
    test_fail "Traefik config is not readable"
fi

if [ -r "/404-system/monitoring/prometheus/prometheus.yml" ]; then
    test_pass "Prometheus config is readable"
else
    test_fail "Prometheus config is not readable"
fi

# Summary
echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo "Please fix the failed checks before deploying to production."
    exit 1
else
    echo -e "${GREEN}Failed: $FAILED${NC}"
    echo ""
    echo "All critical checks passed! The environment is ready for deployment."
    exit 0
fi

