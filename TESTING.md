# Testing and Validation Guide

## Pre-Deployment Validation

Run the validation script to check all components:

```bash
cd /404-public/repo
./validate.sh
```

This script checks:
- Docker installation and configuration
- Docker networks
- Traefik reverse proxy
- Application containers and health checks
- Monitoring stack (Prometheus, Grafana, Loki, AlertManager)
- Backup system
- CI/CD workflows
- Configuration files

## Manual Testing

### 1. Test Health Endpoints Locally

```bash
# Build and run container locally
cd /404-public/repo
docker build -t 404-test .
docker run -d -p 3000:3000 --name 404-test 404-test

# Wait for container to start
sleep 10

# Test health endpoint
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready

# Cleanup
docker stop 404-test
docker rm 404-test
```

### 2. Test Zero-Downtime Deployment

```bash
cd /404-public/repo

# Start blue container
docker compose up -d app-blue

# Wait for health check
docker inspect --format='{{.State.Health.Status}}' 404-app-blue

# Start green container
docker compose up -d app-green

# Wait for health check
docker inspect --format='{{.State.Health.Status}}' 404-app-green

# Test both containers respond
curl http://localhost:3000/api/health  # Should work for both

# Switch traffic (manual Traefik update)
# Stop blue
docker compose stop app-blue

# Verify green still responds
curl http://localhost:3000/api/health
```

### 3. Test Monitoring Stack

```bash
# Check Prometheus metrics
curl http://localhost:9090/metrics

# Check Grafana (after setup)
curl http://localhost:3000/api/health

# Check Loki logs
curl http://localhost:3100/ready

# Check AlertManager
curl http://localhost:9093/-/healthy
```

### 4. Test Backup System

```bash
# Run backup manually
/404-system/backup/scripts/backup.sh

# Verify backup files created
ls -lh /404-system/backups/daily/

# Test restore (dry run)
# Review restore script
cat /404-system/backup/scripts/restore.sh
```

### 5. Test Staging Environment

```bash
cd /404-public/repo

# Deploy to staging
docker compose -f docker-compose.staging.yml up -d --build

# Test staging endpoint (after DNS setup)
curl https://staging.too.foo/api/health
```

## Post-Deployment Checks

After deployment, verify:

1. **Production Site**: https://too.foo
   - Site loads correctly
   - SSL certificate is valid
   - Health endpoint responds: https://too.foo/api/health

2. **Staging Site**: https://staging.too.foo
   - Site loads correctly
   - SSL certificate is valid
   - Health endpoint responds: https://staging.too.foo/api/health

3. **Monitoring Dashboard**: https://monitor.too.foo/grafana
   - Grafana login works
   - Prometheus datasource configured
   - Loki datasource configured
   - Dashboards load correctly

4. **Alerts**
   - Test alert firing
   - Verify email notifications
   - Verify Slack notifications (if configured)

5. **Backups**
   - Verify daily backup runs
   - Check backup logs
   - Test restore process

## Performance Testing

```bash
# Load test with Apache Bench
ab -n 1000 -c 10 https://too.foo/

# Monitor during load test
docker stats

# Check Prometheus metrics during load
curl http://localhost:9090/api/v1/query?query=rate(http_requests_total[1m])
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs 404-app-blue
docker logs 404-app-green

# Check health status
docker inspect --format='{{json .State.Health}}' 404-app-blue | jq
```

### Health checks failing
```bash
# Test health endpoint directly
docker exec 404-app-blue curl http://localhost:3000/api/health

# Check application logs
docker logs 404-app-blue --tail 100
```

### Traefik not routing
```bash
# Check Traefik logs
docker logs traefik --tail 100

# Check Traefik dashboard
# Access http://monitor.too.foo (if configured)

# Verify labels
docker inspect 404-app-blue | jq '.[0].Config.Labels'
```

### Monitoring not working
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check Grafana logs
docker logs grafana --tail 100

# Verify datasources
curl http://admin:password@localhost:3000/api/datasources
```

