# On-Premises Installation

> Deploy TrueMark entirely within customer infrastructure. No cloud dependency required for core verification.

## Summary

| Property | Value |
|----------|-------|
| Stack file | `infra/docker/docker-compose.onprem.yml` |
| Reverse proxy | nginx (`infra/docker/nginx/onprem.conf`) |
| Database | PostgreSQL 16 (container) |
| Cache / jobs | Redis 7 |
| Object storage | MinIO |
| AI | Mock (default) or hybrid cloud gateway |

## Minimum requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 500 GB SSD |
| OS | Ubuntu 22.04+ / RHEL 8+ | |
| Docker | ≥ 24 | |
| Docker Compose | ≥ 2.20 | |

## Quick install

```bash
# 1. Clone release
cd /opt/truemark && git clone <repo> app && cd app

# 2. Configure environment
cp .env.example .env
# Edit: POSTGRES_PASSWORD, JWT_SECRET, domain hostnames

# 3. Start stack
docker compose -f infra/docker/docker-compose.onprem.yml up -d

# 4. Initialize database (first run)
docker compose -f infra/docker/docker-compose.onprem.yml exec api \
  sh -c "pnpm db:push && pnpm db:seed"
```

## Network layout

```
Internet / Corporate LAN
        │
   ┌────▼────┐
   │  nginx  │  TLS termination
   └────┬────┘
        ├── verify.customer.com  → consumer-web + API /public/*
        └── admin.customer.internal → admin-web + API /admin/*
```

## Environment variables (on-prem)

Key settings in `.env`:

```bash
DEPLOYMENT_RUNTIME=on_prem
STORAGE_PROVIDER=minio
AI_PROVIDER=mock
DATABASE_URL=postgresql://truemark:${POSTGRES_PASSWORD}@postgres:5432/truemark
REDIS_URL=redis://redis:6379
```

For hybrid AI (images to cloud):

```bash
HYBRID_MODE=CORE_ONPREM_AI_CLOUD
AI_GATEWAY_URL=https://ai-gateway.your-vendor.com
```

Tenant must opt in via profile metadata — see [Hybrid](../architecture/HYBRID.md).

## Backup schedule (recommended)

| Time | Component | Method |
|------|-----------|--------|
| 02:00 daily | PostgreSQL | `pg_dump` → `/opt/truemark/backups/db/` |
| 02:30 daily | MinIO | `mc mirror` → backups volume |
| 03:00 daily | Config | Copy `.env`, nginx.conf, certs |

Validate monthly with `pnpm dr-drill`.

## Upgrades

```bash
cd /opt/truemark/app
git pull   # or extract new release tarball
docker compose -f infra/docker/docker-compose.onprem.yml build
docker compose -f infra/docker/docker-compose.onprem.yml up -d
# Run migrations if schema changed
```

## Air-gapped deployments

- Set `AI_PROVIDER=mock` or deploy a local vision model server
- No outbound internet required for core verification
- Pre-load Docker images via private registry mirror

## Full procedure

For step-by-step install, hardening, monitoring, and troubleshooting, see the detailed [On-Prem Runbook](../runbooks/onprem-install.md).

## Related docs

- [Docker Guide](../docker/DOCKER.md)
- [Database](../database/DATABASE.md)
- [Hybrid Architecture](../architecture/HYBRID.md)
- [DR Runbook](../runbooks/DR.md)
