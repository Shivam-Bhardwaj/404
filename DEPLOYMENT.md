# Deployment Guide for too.foo

> **Scope:** This document covers the self-hosted staging environment (`staging.too.foo`). The production domain (`too.foo`) is now running on a separate Vercel project and is managed outside of this repository.

## Initial Setup

### 1. Start Traefik
```bash
cd /404-system/traefik
docker compose up -d
```

### 2. Start Monitoring Stack
```bash
cd /404-system/monitoring
docker compose up -d
```

### 3. Deploy Production Application
```bash
cd /404-public/repo
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Deploy Staging Application
```bash
cd /404-public/repo
docker compose -f docker-compose.staging.yml up -d --build
```

## Environment Variables

Create `.env` files as needed:

### Traefik
```bash
# /404-system/traefik/.env
LETSENCRYPT_EMAIL=admin@too.foo
TRAEFIK_AUTH_USERS=admin:$apr1$...
```

### Monitoring
```bash
# /404-system/monitoring/.env
GRAFANA_ADMIN_PASSWORD=your-secure-password
ALERT_EMAIL=alerts@too.foo
SMTP_HOST=smtp.example.com:587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SLACK_API_URL=https://hooks.slack.com/services/...
```

### Backup
```bash
# /404-system/backup/.env
BACKUP_S3_BUCKET=your-s3-bucket-name
BACKUP_NOTIFICATION_EMAIL=admin@too.foo
```

## DNS Configuration

Ensure DNS records point to this server:
- `too.foo` → Server IP
- `staging.too.foo` → Server IP
- `monitor.too.foo` → Server IP

## Backup Setup

Enable automated backups:
```bash
sudo cp /404-system/backup/backup.service /etc/systemd/system/
sudo cp /404-system/backup/backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable backup.timer
sudo systemctl start backup.timer
```

## Manual Deployment

Deployments are done manually on the server. GitHub is used only for version control and issue tracking.

To deploy changes:
```bash
# SSH to the server
ssh user@staging.too.foo

# Navigate to repo and pull latest
cd /404-public/repo
git pull origin staging  # or main for production

# Rebuild and restart
docker compose -f docker-compose.staging.yml up -d --build
```

## Zero-Downtime Deployment

The blue-green deployment strategy is configured in `docker-compose.yml`. The GitHub Actions workflow automatically handles switching between blue and green containers.

Manual deployment:
```bash
cd /404-public/repo
# Deploy to inactive container (green)
docker compose up -d --build app-green
# Wait for health check
docker inspect --format='{{.State.Health.Status}}' 404-app-green
# Switch traffic (update Traefik config)
# Stop old container
docker compose stop app-blue
```
