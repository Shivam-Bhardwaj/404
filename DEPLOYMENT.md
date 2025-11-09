# Deployment Guide for too.foo

> **Heads-up:** Vercel hosting has been retired for this project. All deployments (staging + production) run on the self-hosted Docker/Traefik stack described below.

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

## GitHub Actions Setup

Configure these secrets in GitHub repository settings:

### Required Secrets:
- `STAGING_HOST`: Staging server hostname/IP
- `STAGING_USER`: SSH username for staging
- `STAGING_SSH_KEY`: SSH private key for staging
- `PRODUCTION_HOST`: Production server hostname/IP
- `PRODUCTION_USER`: SSH username for production
- `PRODUCTION_SSH_KEY`: SSH private key for production
- `SLACK_WEBHOOK_URL`: (Optional) Slack webhook for notifications

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
