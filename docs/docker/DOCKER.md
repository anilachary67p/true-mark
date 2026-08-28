# Docker Guide

> Container images and Docker Compose stacks for TrueMark.

## Dockerfiles

| File | Image | Base |
|------|-------|------|
| `infra/docker/Dockerfile.api` | `truemark/api` | Node 22 Alpine |
| `infra/docker/Dockerfile.admin-web` | `truemark/admin-web` | Node 22 Alpine (standalone Next.js) |
| `infra/docker/Dockerfile.consumer-web` | `truemark/consumer-web` | Node 22 Alpine (standalone Next.js) |

Build example:

```bash
docker build -f infra/docker/Dockerfile.api -t truemark/api:latest .
```

## Local development stack

Start Postgres, Redis, and MinIO only:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

| Service | Credentials |
|---------|-------------|
| Postgres | user `truemark`, password `truemark_dev`, db `truemark` |
| Redis | no auth (local) |
| MinIO | `minioadmin` / `minioadmin` |

Connection string:

```bash
DATABASE_URL=postgresql://truemark:truemark_dev@localhost:5432/truemark?schema=public
REDIS_URL=redis://localhost:6379
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

## Full on-premises stack

Includes API, admin-web, consumer-web, Postgres, Redis, MinIO, nginx:

```bash
docker compose -f infra/docker/docker-compose.onprem.yml up -d
```

nginx routes:

| Path | Backend |
|------|---------|
| `/api/*` | API :3001 |
| `/verify` | Consumer web |
| `/` | Admin web |

See [On-Prem Install](../on-prem/INSTALL.md) for production hardening.

## Monitoring profile

```bash
docker compose -f infra/docker/docker-compose.onprem.yml --profile monitoring up -d
```

Uses `infra/docker/monitoring/prometheus.yml`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Port 5432 in use | Stop other Postgres or change compose port mapping |
| `P1000` auth failed | Match `DATABASE_URL` password to compose (`truemark_dev`) |
| API can't reach Redis | Ensure `REDIS_URL=redis://redis:6379` inside compose network |

## Related docs

- [On-Prem Install](../on-prem/INSTALL.md)
- [Infrastructure](../infrastructure/INFRASTRUCTURE.md)
- [Database](../database/DATABASE.md)
