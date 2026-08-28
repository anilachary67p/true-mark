# TrueMark

Enterprise product authentication and anti-counterfeit platform. Consumers verify physical products via QR scan or manual code — **no login required**. Optional AI-based physical validation is strictly separate from core verification.

## Features

- **Multi-tenant SaaS** — isolated tenants, domains, products, and configuration
- **Core verification** — fast QR + manual code authentication (no AI required)
- **QR system** — generation, customization, logo overlay, ZIP bulk export, lifecycle
- **Fraud intelligence** — signals, alerts, investigations
- **Optional AI** — post-verification image analysis with quotas and hybrid boundaries
- **Flexible deployment** — SaaS (AWS), on-premises, hybrid

## Architecture

Modular monolith:

| App          | Stack   | Port |
| ------------ | ------- | ---- |
| API          | NestJS  | 3001 |
| Admin Web    | Next.js | 3000 |
| Consumer Web | Next.js | 3002 |

Shared packages: `@truemark/db` (Prisma), `@truemark/shared`, `@truemark/config`.

```
apps/
├── api/              NestJS API
├── admin-web/        Admin portal
├── consumer-web/     Public verification UI
└── e2e/              Playwright tests
packages/
├── db/               PostgreSQL schema + seed
├── shared/           Enums, schemas, E2E fixtures
└── config/           Validated environment schema
infra/
├── docker/           Compose + Dockerfiles
├── helm/truemark/    Kubernetes chart
└── terraform/aws/    AWS infrastructure
```

Full documentation: **[docs/README.md](docs/README.md)**

---

## Prerequisites

| Tool       | Version                                  |
| ---------- | ---------------------------------------- |
| Node.js    | ≥ 20                                     |
| pnpm       | ≥ 9                                      |
| PostgreSQL | 16                                       |
| Redis      | 7                                        |
| Docker     | ≥ 24 _(optional, recommended for infra)_ |

---

## Quick Start (Local Development)

### 1. Install dependencies

```bash
git clone <repository-url> true-mark
cd true-mark
pnpm install
```

### 2. Start infrastructure

**Option A — Docker Compose (recommended):**

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts Postgres (`truemark` / `truemark_dev`), Redis, and MinIO.

**Option B — Manual containers:**

```bash
docker run -d --name truemark-postgres \
  -e POSTGRES_USER=truemark \
  -e POSTGRES_PASSWORD=truemark_dev \
  -e POSTGRES_DB=truemark \
  -p 5432:5432 postgres:16-alpine

docker run -d --name truemark-redis -p 6379:6379 redis:7-alpine
```

### 3. Configure environment

```bash
cp .env.example .env
```

Minimum required variables:

```bash
DATABASE_URL=postgresql://truemark:truemark_dev@localhost:5432/truemark?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-jwt-secret-minimum-32-characters-long
AUTH_MODE=dev
STORAGE_PROVIDER=local
AI_PROVIDER=mock
```

> **Important:** Do not set `NODE_ENV` in `.env` — it breaks Next.js builds when sourced. Use `NODE_ENV=production` only for `next build`.

### 4. Initialize database

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

### 5. Start development servers

**All apps (Turbo):**

```bash
pnpm dev
```

**Or individually:**

```bash
# Terminal 1 — API
pnpm --filter @truemark/api dev

# Terminal 2 — Admin
pnpm --filter @truemark/admin-web dev

# Terminal 3 — Consumer (set verify hostname for seed domain)
NEXT_PUBLIC_VERIFY_HOSTNAME=verify.localhost \
NEXT_PUBLIC_API_URL=http://localhost:3001 \
pnpm --filter @truemark/consumer-web dev
```

### 6. Access services

| Service         | URL                                       |
| --------------- | ----------------------------------------- |
| Admin Web       | http://localhost:3000                     |
| Consumer Verify | http://localhost:3002/verify              |
| API             | http://localhost:3001                     |
| API Health      | http://localhost:3001/api/v1/health       |
| API Ready       | http://localhost:3001/api/v1/health/ready |
| Swagger UI      | http://localhost:3001/api/docs            |

### 7. Login (admin)

After seeding:

| User                         | Password      | Role           |
| ---------------------------- | ------------- | -------------- |
| `admin@truemark.local`       | `Admin123!@#` | Platform admin |
| `tenant-admin@abcpharma.com` | `Admin123!@#` | Tenant admin   |

### 8. Test verification

**API (QR):**

```bash
curl -X POST http://localhost:3001/api/v1/public/verify/qr \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://verify.localhost/v/e2eFixedQrToken0001",
    "hostname": "verify.localhost"
  }'
```

**Consumer UI:** Open http://localhost:3002/verify and enter manual code `TM-E2E0-FIXD-0001`.

---

## Project scripts

| Command            | Description                                                |
| ------------------ | ---------------------------------------------------------- |
| `pnpm dev`         | Start all apps in dev mode                                 |
| `pnpm build`       | Build all packages and apps                                |
| `pnpm test`        | Run API unit tests                                         |
| `pnpm test:e2e`    | Playwright acceptance tests _(requires running API + web)_ |
| `pnpm load-test`   | Core verification load test (p95 gate)                     |
| `pnpm dr-drill`    | Backup → restore → integrity check                         |
| `pnpm db:generate` | Generate Prisma client                                     |
| `pnpm db:push`     | Push schema to database (dev)                              |
| `pnpm db:migrate`  | Run migrations (production)                                |
| `pnpm db:seed`     | Seed demo + E2E fixture data                               |
| `pnpm format`      | Prettier format                                            |

**Build frontends for production:**

```bash
NODE_ENV=production NEXT_PUBLIC_VERIFY_HOSTNAME=verify.localhost \
  NEXT_PUBLIC_API_URL=http://localhost:3001 \
  pnpm --filter @truemark/admin-web build

NODE_ENV=production NEXT_PUBLIC_VERIFY_HOSTNAME=verify.localhost \
  NEXT_PUBLIC_API_URL=http://localhost:3001 \
  pnpm --filter @truemark/consumer-web build
```

---

## Documentation

| Category                 | Entry point                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| **All docs**             | [docs/README.md](docs/README.md)                                                 |
| **Admin Web**            | [docs/web/ADMIN_WEB.md](docs/web/ADMIN_WEB.md)                                   |
| **Consumer Web**         | [docs/web/CONSUMER_WEB.md](docs/web/CONSUMER_WEB.md)                             |
| **API**                  | [docs/api/API_REFERENCE.md](docs/api/API_REFERENCE.md)                           |
| **Database**             | [docs/database/DATABASE.md](docs/database/DATABASE.md)                           |
| **Production setup**     | [docs/deployment/PRODUCTION_SETUP_GUIDE.md](docs/deployment/PRODUCTION_SETUP_GUIDE.md) |
| **Deployment**           | [docs/deployment/DEPLOYMENT_OVERVIEW.md](docs/deployment/DEPLOYMENT_OVERVIEW.md) |
| **Docker**               | [docs/docker/DOCKER.md](docs/docker/DOCKER.md)                                   |
| **Kubernetes / Helm**    | [docs/helm/KUBERNETES.md](docs/helm/KUBERNETES.md)                               |
| **Terraform (AWS)**      | [docs/terraform/AWS.md](docs/terraform/AWS.md)                                   |
| **Azure**                | [docs/deployment/PRODUCTION_SETUP_GUIDE.md](docs/deployment/PRODUCTION_SETUP_GUIDE.md) · [docs/runbooks/azure-deploy.md](docs/runbooks/azure-deploy.md) |
| **On-premises**          | [docs/on-prem/INSTALL.md](docs/on-prem/INSTALL.md)                               |
| **Architecture**         | [docs/architecture/SYSTEM.md](docs/architecture/SYSTEM.md)                       |
| **Security**             | [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md)                                     |
| **Production readiness** | [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md)                     |

---

## Deployment quick links

| Target            | Guide                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **On-prem / Azure** | [Production Setup Guide](docs/deployment/PRODUCTION_SETUP_GUIDE.md)                           |
| AWS cloud         | [docs/terraform/AWS.md](docs/terraform/AWS.md) · [Cloud runbook](docs/runbooks/cloud-deploy.md) |
| On-premises       | [docs/on-prem/INSTALL.md](docs/on-prem/INSTALL.md)                                              |
| Kubernetes        | [docs/helm/KUBERNETES.md](docs/helm/KUBERNETES.md)                                              |
| Hybrid            | [docs/architecture/HYBRID.md](docs/architecture/HYBRID.md)                                      |
| Disaster recovery | [docs/runbooks/DR.md](docs/runbooks/DR.md)                                                      |

---

## Core principles

1. Consumer verification requires **no login**
2. Core verification is **fast** and **does not require AI**
3. AI is **optional** and **never overrides** invalid credentials
4. **Tenant isolation** is mandatory and server-side enforced
5. Verification history is **append-only** and auditable
6. Production URLs and tenant domains are **never hardcoded**

---

## Implementation status

Phases 0–15 complete. See [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) for the latest quality and security review.

---

## License

Proprietary — All rights reserved.
