# Infrastructure Overview

> Platform components, networking, and dependencies.

## Architecture diagram

```
                    ┌─────────────────────────────────────┐
                    │           Load Balancer / nginx      │
                    └──────────┬──────────────┬───────────┘
                               │              │
                    ┌──────────▼──┐    ┌──────▼──────────┐
                    │  Admin Web    │    │  Consumer Web   │
                    │  (Next.js)    │    │  (Next.js)      │
                    └──────┬────────┘    └──────┬──────────┘
                           │                      │
                           └──────────┬───────────┘
                                      │
                           ┌──────────▼──────────┐
                           │   TrueMark API       │
                           │   (NestJS)           │
                           └──┬────┬────┬────┬────┘
                              │    │    │    │
              ┌───────────────┘    │    │    └──────────────┐
              │                    │    │                   │
     ┌────────▼────────┐  ┌───────▼────▼───┐    ┌─────────▼────────┐
     │  PostgreSQL 16  │  │  Redis 7       │    │  Object Storage  │
     │  (Prisma)       │  │  (BullMQ)      │    │  S3 / MinIO      │
     └─────────────────┘  └────────────────┘    └──────────────────┘
```

## Service ports (local dev)

| Service | Port | Protocol |
|---------|------|----------|
| Admin Web | 3000 | HTTP |
| API | 3001 | HTTP |
| Consumer Web | 3002 | HTTP |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| MinIO API | 9000 | HTTP |
| MinIO Console | 9001 | HTTP |

## Infrastructure artifacts

| Artifact | Path | Purpose |
|----------|------|---------|
| Dev Compose | `infra/docker/docker-compose.yml` | Postgres + Redis + MinIO |
| On-prem Compose | `infra/docker/docker-compose.onprem.yml` | Full production-like stack |
| Dockerfiles | `infra/docker/Dockerfile.*` | API, admin-web, consumer-web images |
| nginx config | `infra/docker/nginx/onprem.conf` | On-prem reverse proxy |
| Helm chart | `infra/helm/truemark/` | Kubernetes deployment |
| Terraform AWS | `infra/terraform/aws/main.tf` | Cloud infrastructure |
| Prometheus stub | `infra/docker/monitoring/prometheus.yml` | Metrics scrape config |

## Background jobs

BullMQ runs **inside the API process** (`apps/api/src/jobs/`):

- Bulk unit generation
- Analytics daily rollup (02:00 UTC scheduler)

No separate worker container is required for MVP.

## Object storage providers

Configured via `STORAGE_PROVIDER`:

| Value | Use case |
|-------|----------|
| `local` | Dev — files on disk |
| `minio` | On-prem S3-compatible |
| `s3` | AWS production |

## AI providers

Configured via `AI_PROVIDER`:

| Value | Use case |
|-------|----------|
| `mock` | Dev/test — deterministic results |
| `openai` | Production vision (requires `AI_API_KEY`) |
| Gateway | Hybrid — `HYBRID_MODE` + `AI_GATEWAY_URL` |

## Monitoring

- Health: `GET /api/v1/health`, `GET /api/v1/health/ready`
- Structured JSON logging with correlation IDs
- Prometheus config stub for on-prem monitoring profile

## Related docs

- [Docker](./docker/DOCKER.md)
- [Helm / Kubernetes](./helm/KUBERNETES.md)
- [Terraform AWS](./terraform/AWS.md)
- [System Architecture](../architecture/SYSTEM.md)
