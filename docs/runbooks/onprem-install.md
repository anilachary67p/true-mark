# On-Premises Installation Runbook

> Full step-by-step on-prem install procedure.  
> **See also:** [On-Prem Install (summary)](../on-prem/INSTALL.md) · [Docker Guide](../docker/DOCKER.md)

## Prerequisites

| Requirement    | Version                         | Notes                             |
| -------------- | ------------------------------- | --------------------------------- |
| Docker         | ≥ 24                            | Docker Engine or Docker Desktop   |
| Docker Compose | ≥ 2.20                          | Plugin or standalone              |
| OS             | Linux (Ubuntu 22.04+ / RHEL 8+) | 64-bit x86_64 or ARM64            |
| CPU            | 4 cores minimum                 | 8+ recommended                    |
| RAM            | 16 GB minimum                   | 32 GB recommended                 |
| Disk           | 100 GB SSD minimum              | 500 GB for production with images |
| Network        | Outbound HTTPS (optional)       | Only if using cloud AI (hybrid)   |
| Domain         | Customer-managed DNS            | For verification domains          |

## Architecture

```
Customer Network
├── Reverse Proxy (nginx/Traefik) — TLS termination
│   ├── verify.customer.com → API (public verification)
│   └── admin.customer.internal → Admin Web
├── TrueMark API (NestJS)
├── TrueMark Admin Web (Next.js)
├── TrueMark Worker (BullMQ jobs)
├── PostgreSQL 16
├── Redis 7
├── MinIO (S3-compatible object storage)
└── Optional: Vault (secrets), Local AI model server
```

---

## Step 1: Prepare Server

### 1.1 System Requirements

```bash
# Verify resources
nproc          # ≥ 4
free -h        # ≥ 16 GB
df -h /        # ≥ 100 GB available
```

### 1.2 Install Docker

```bash
# Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Verify
docker --version
docker compose version
```

### 1.3 Create Directory Structure

```bash
sudo mkdir -p /opt/truemark/{data,config,backups,logs}
sudo chown -R $USER:$USER /opt/truemark
```

---

## Step 2: Download and Configure

### 2.1 Clone or Copy Release

```bash
cd /opt/truemark
git clone <repository-url> app
# OR: extract release tarball
cd app
```

### 2.2 Configure Environment

```bash
cp .env.example .env
```

Edit `/opt/truemark/app/.env`:

```bash
# ─── Core ───
NODE_ENV=production
DATABASE_URL=postgresql://truemark:CHANGE_ME@postgres:5432/truemark
REDIS_URL=redis://redis:6379

# ─── API ───
API_PORT=3001
API_HOST=0.0.0.0
CORS_ORIGINS=https://admin.customer.internal

# ─── Auth ───
AUTH_MODE=oidc
OIDC_ISSUER=https://idp.customer.internal/realms/truemark
OIDC_AUDIENCE=truemark-api
OIDC_CLIENT_ID=truemark-api
OIDC_CLIENT_SECRET=CHANGE_ME

# ─── Storage ───
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=CHANGE_ME
MINIO_SECRET_KEY=CHANGE_ME
MINIO_BUCKET=truemark
MINIO_USE_SSL=false

# ─── AI (optional) ───
AI_PROVIDER=mock
# AI_PROVIDER=local  # For on-prem AI model
# AI_ENDPOINT=http://ai-model:8080

# ─── URLs ───
ADMIN_WEB_URL=https://admin.customer.internal
CONSUMER_WEB_URL=https://verify.customer.com

# ─── Rate Limits ───
RATE_LIMIT_VERIFY_PER_MIN=60
RATE_LIMIT_AI_PER_MIN=10
```

**Security:** Generate strong passwords:

```bash
# Generate secrets
openssl rand -base64 32  # JWT_SECRET (if AUTH_MODE=dev)
openssl rand -base64 24  # DB password
openssl rand -base64 24  # MinIO keys
```

---

## Step 3: Start the Stack

### 3.1 Launch Services

```bash
cd /opt/truemark/app
docker compose -f infra/docker/docker-compose.onprem.yml up -d
```

### 3.2 Verify Services

```bash
docker compose -f infra/docker/docker-compose.onprem.yml ps
```

Expected output — all services `healthy`:

| Service   | Port            | Purpose         |
| --------- | --------------- | --------------- |
| postgres  | 5432 (internal) | Database        |
| redis     | 6379 (internal) | Cache + queue   |
| minio     | 9000 (internal) | Object storage  |
| api       | 3001 (internal) | NestJS API      |
| admin-web | 3000 (internal) | Admin portal    |
| worker    | —               | Background jobs |
| nginx     | 443, 80         | Reverse proxy   |

### 3.3 Check Health

```bash
curl -sf http://localhost:3001/health
curl -sf http://localhost:3001/health/ready
```

---

## Step 4: Initialize Database

### 4.1 Run Migrations

```bash
docker compose -f infra/docker/docker-compose.onprem.yml exec api \
  npx prisma migrate deploy
```

### 4.2 Seed Initial Data (Optional)

For first install with demo tenant:

```bash
docker compose -f infra/docker/docker-compose.onprem.yml exec api \
  npx prisma db seed
```

This creates:

- Platform admin user (credentials in seed output — change immediately)
- Demo tenant with sample product

---

## Step 5: Configure Reverse Proxy (TLS)

### 5.1 nginx Configuration

Create `/opt/truemark/config/nginx.conf`:

```nginx
upstream truemark_api {
    server api:3001;
}

upstream truemark_admin {
    server admin-web:3000;
}

# Verification domain (public-facing)
server {
    listen 443 ssl http2;
    server_name verify.customer.com;

    ssl_certificate     /etc/nginx/certs/verify.customer.com.crt;
    ssl_certificate_key /etc/nginx/certs/verify.customer.com.key;

    location / {
        proxy_pass http://truemark_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin portal (internal network only)
server {
    listen 443 ssl http2;
    server_name admin.customer.internal;

    ssl_certificate     /etc/nginx/certs/admin.customer.internal.crt;
    ssl_certificate_key /etc/nginx/certs/admin.customer.internal.key;

    location / {
        proxy_pass http://truemark_admin;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://truemark_api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 5.2 TLS Certificates

Use customer PKI or Let's Encrypt (if public verification domain):

```bash
# Customer PKI — place certs in /opt/truemark/config/certs/
# OR Let's Encrypt:
certbot certonly --nginx -d verify.customer.com
```

---

## Step 6: Tenant Onboarding

### 6.1 Login to Admin Portal

Navigate to `https://admin.customer.internal` and authenticate via OIDC.

### 6.2 Create Tenant

1. Navigate to Organizations → Create Tenant
2. Enter company name and profile
3. Add company domain: `https://www.customer.com`
4. Register verification domain: `verify.customer.com`
5. Complete DNS TXT verification challenge
6. Activate tenant

### 6.3 Configure Products

1. Create manufacturer, brand, product, variant
2. Create batch and generate product units
3. Generate QR codes
4. Test verification by scanning a QR

---

## Step 7: Backup Configuration

### 7.1 Automated Database Backup

Create `/opt/truemark/config/backup.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/truemark/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL
docker compose -f /opt/truemark/app/infra/docker/docker-compose.onprem.yml \
  exec -T postgres pg_dump -U truemark truemark | \
  gzip > "$BACKUP_DIR/db/truemark_${TIMESTAMP}.sql.gz"

# MinIO data
docker compose -f /opt/truemark/app/infra/docker/docker-compose.onprem.yml \
  exec -T minio mc mirror /data "$BACKUP_DIR/storage/${TIMESTAMP}/"

# Retention: keep 30 days
find "$BACKUP_DIR/db" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${TIMESTAMP}"
```

Schedule via cron:

```bash
chmod +x /opt/truemark/config/backup.sh
crontab -e
# Add: 0 2 * * * /opt/truemark/config/backup.sh >> /opt/truemark/logs/backup.log 2>&1
```

---

## Step 8: Monitoring

### 8.1 Health Monitoring

```bash
# Simple cron-based health check
*/5 * * * * curl -sf http://localhost:3001/health || echo "API DOWN" | mail -s "TrueMark Alert" ops@customer.com
```

### 8.2 Log Access

```bash
# API logs
docker compose -f infra/docker/docker-compose.onprem.yml logs -f api

# Worker logs
docker compose -f infra/docker/docker-compose.onprem.yml logs -f worker

# All services
docker compose -f infra/docker/docker-compose.onprem.yml logs -f
```

### 8.3 Optional: Prometheus + Grafana

Uncomment the monitoring profile in `docker-compose.onprem.yml`:

```bash
docker compose -f infra/docker/docker-compose.onprem.yml --profile monitoring up -d
```

Access Grafana at `http://localhost:3003` (internal network only).

---

## Upgrades

### Application Upgrade

```bash
cd /opt/truemark/app
git pull  # or extract new release

# Backup first
/opt/truemark/config/backup.sh

# Rebuild and restart
docker compose -f infra/docker/docker-compose.onprem.yml build
docker compose -f infra/docker/docker-compose.onprem.yml up -d

# Run migrations
docker compose -f infra/docker/docker-compose.onprem.yml exec api \
  npx prisma migrate deploy
```

### Rollback

```bash
git checkout <previous-tag>
docker compose -f infra/docker/docker-compose.onprem.yml build
docker compose -f infra/docker/docker-compose.onprem.yml up -d
# Restore DB from backup if migration was applied
```

---

## Hybrid AI Setup (Optional)

To use cloud AI while keeping core on-prem:

1. Configure outbound HTTPS to AI gateway
2. Set in `.env`:
   ```bash
   AI_PROVIDER=openai
   AI_API_KEY=<key>  # Or use Vault
   ```
3. Configure hybrid boundary in tenant settings
4. See [Hybrid Architecture](../architecture/HYBRID.md)

For fully local AI:

1. Deploy local model server (e.g., Ollama with vision model)
2. Set `AI_PROVIDER=local` and `AI_ENDPOINT=http://ai-model:8080`
3. No outbound network required

---

## Troubleshooting

| Symptom               | Diagnosis                       | Fix                                          |
| --------------------- | ------------------------------- | -------------------------------------------- |
| API won't start       | `docker logs truemark-api-1`    | Check DATABASE_URL, env vars                 |
| DB connection refused | `docker compose ps postgres`    | Wait for postgres healthy; check credentials |
| MinIO upload fails    | `docker logs truemark-minio-1`  | Check MINIO_ACCESS_KEY/SECRET_KEY            |
| OIDC login fails      | Check IdP logs                  | Verify OIDC_ISSUER, client ID, callback URL  |
| QR verification fails | Check domain config             | Ensure verification domain is ACTIVE         |
| Worker not processing | `docker logs truemark-worker-1` | Check Redis connectivity                     |
| Disk full             | `df -h`                         | Clean old backups, MinIO lifecycle policy    |

---

## Security Hardening

- [ ] Change all default passwords before production use
- [ ] Restrict admin portal to internal network/VPN
- [ ] Enable TLS on all endpoints
- [ ] Configure firewall: only ports 443 (public) and 443 (admin, internal)
- [ ] Disable AUTH_MODE=dev in production
- [ ] Enable OIDC with MFA via customer IdP
- [ ] Schedule regular backups and test restores
- [ ] Apply OS security patches monthly
- [ ] Review audit logs weekly

---

## Related Documents

- [Cloud Deploy Runbook](./cloud-deploy.md)
- [Disaster Recovery Runbook](./DR.md)
- [Hybrid Architecture](../architecture/HYBRID.md)
- [Production Readiness](../PRODUCTION_READINESS.md)
