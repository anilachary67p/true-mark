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

## Recommended instance specifications

Size the host for **all services on one machine** (API, admin web, consumer web, PostgreSQL, Redis, MinIO, nginx). Add capacity if you enable the monitoring profile (Prometheus + Grafana) or run a local AI model.

### Sizing tiers

| Tier | Use case | vCPU | RAM | Disk (SSD) | Example hardware / VM |
|------|----------|------|-----|------------|------------------------|
| **Pilot** | Dev, UAT, single tenant, &lt;100k product units, &lt;10 verify/sec | 4 | 16 GB | 100 GB | Dell R650 (single socket), HPE DL360, or 1× cloud VM |
| **Production** *(recommended)* | 1–5 tenants, &lt;5M units, &lt;50 verify/sec, daily backups | 8 | 32 GB | 256 GB | 2-socket server or `Standard_D8s_v5` / `m6i.2xlarge` equivalent |
| **Enterprise** | Many tenants, &gt;5M units, &gt;50 verify/sec, AI images, HA pair | 16 | 64 GB | 512 GB–1 TB | Dedicated DB host optional; `Standard_D16s_v5` or bare-metal |

### Per-container resource guide (Docker Compose)

Approximate steady-state usage on the **Production** tier:

| Container | CPU | Memory | Notes |
|-----------|-----|--------|-------|
| `api` | 1–2 cores | 512 MB–1 GB | Scales with verify traffic and bulk QR jobs |
| `admin-web` | 0.25 core | 256 MB | Low; spikes during admin sessions |
| `consumer-web` | 0.25 core | 256 MB | Low; spikes during QR scan campaigns |
| `postgres` | 1–2 cores | 2–4 GB | Increase for large verification history |
| `redis` | 0.25 core | 256–512 MB | BullMQ queue; 256 MB cap in compose |
| `minio` | 0.5 core | 512 MB–1 GB | Grows with QR exports and AI images |
| `nginx` | 0.1 core | 64 MB | Reverse proxy only |
| **Headroom** | 2+ cores | 8+ GB | OS, Docker, backups, monitoring |

### Workload scaling rules

| Signal | Action |
|--------|--------|
| Verify latency &gt; 500 ms p95 | Add CPU to API container or move Postgres to dedicated host |
| Disk &gt; 70% full | Expand volume; enable MinIO lifecycle / retention policy |
| RAM pressure / OOM | Increase host RAM; raise Postgres `shared_buffers` cautiously |
| Bulk QR jobs queue &gt; 1 hour | Add Redis memory; consider separate worker host |
| AI enabled (`AI_PROVIDER` not `mock`) | +4 GB RAM minimum; +100 GB disk for image storage |

### High availability (on-prem)

For production HA without cloud:

| Pattern | Spec |
|---------|------|
| **Active / passive** | 2× Production-tier servers; keepalived + shared NFS/ SAN for Postgres backups; manual failover |
| **Split data plane** | App server (8 vCPU / 32 GB) + DB server (4 vCPU / 16 GB, 500 GB SSD) |
| **Minimum for HA pair** | 2× 8 vCPU / 32 GB / 256 GB SSD |

### OS & runtime

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| OS | Ubuntu 22.04 LTS / RHEL 8+ | Ubuntu 24.04 LTS |
| Docker Engine | ≥ 24 | Latest stable |
| Docker Compose | ≥ 2.20 | Plugin (`docker compose`) |
| Architecture | x86_64 or ARM64 | x86_64 (broader image support) |

## Minimum requirements (quick reference)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 256–500 GB SSD |
| OS | Ubuntu 22.04+ / RHEL 8+ | Ubuntu 24.04 LTS |
| Docker | ≥ 24 | Latest |
| Docker Compose | ≥ 2.20 | Plugin |

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
