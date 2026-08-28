# TrueMark Documentation

> Central index for all TrueMark platform documentation.  
> Requirements source of truth: [`project.md`](../project.md) (product specification).

## Quick links

| I want to… | Start here |
|------------|------------|
| Run locally | [README — Quick Start](../README.md#quick-start-local-development) |
| Call the API | [API Reference](./api/API_REFERENCE.md) · [OpenAPI](./api/openapi.yaml) · Swagger `http://localhost:3001/api/docs` |
| Work on Admin UI | [Admin Web](./web/ADMIN_WEB.md) |
| Work on Consumer UI | [Consumer Web](./web/CONSUMER_WEB.md) |
| Understand the database | [Database Guide](./database/DATABASE.md) |
| Deploy to AWS | [Terraform (AWS)](./terraform/AWS.md) · [Cloud Runbook](./runbooks/cloud-deploy.md) |
| Deploy on-premises | [Production Setup Guide](./deployment/PRODUCTION_SETUP_GUIDE.md) · [On-Prem Install](./on-prem/INSTALL.md) |
| Deploy to Azure | [Production Setup Guide](./deployment/PRODUCTION_SETUP_GUIDE.md) · [Azure Runbook](./runbooks/azure-deploy.md) |
| Use Docker / Compose | [Docker Guide](./docker/DOCKER.md) |
| Use Kubernetes / Helm | [Helm / Kubernetes](./helm/KUBERNETES.md) |
| Understand architecture | [System Architecture](./architecture/SYSTEM.md) |
| Go live checklist | [Production Readiness](./PRODUCTION_READINESS.md) · [Code Review](./CODE_REVIEW.md) |
| Disaster recovery | [DR Runbook](./runbooks/DR.md) |

---

## Documentation map

### Web applications

| Document | Description |
|----------|-------------|
| [Admin Web](./web/ADMIN_WEB.md) | Next.js admin portal — pages, auth, env vars |
| [Consumer Web](./web/CONSUMER_WEB.md) | Public verification UI — QR scan, manual code, AI capture |

### API

| Document | Description |
|----------|-------------|
| [API Reference](./api/API_REFERENCE.md) | Endpoints, auth, rate limits, error shapes |
| [Authentication](./api/AUTHENTICATION.md) | JWT, refresh tokens, roles, tenant scope |
| [OpenAPI spec](./api/openapi.yaml) | Machine-readable API summary |

### Database

| Document | Description |
|----------|-------------|
| [Database Guide](./database/DATABASE.md) | Prisma schema, migrations, seed, backup |

### Deployment & infrastructure

| Document | Description |
|----------|-------------|
| [**Production Setup Guide**](./deployment/PRODUCTION_SETUP_GUIDE.md) | **Start here** — on-prem, Azure, Auth0, full checklists |
| [Deployment Overview](./deployment/DEPLOYMENT_OVERVIEW.md) | SaaS, on-prem, hybrid deployment models |
| [Infrastructure Overview](./infrastructure/INFRASTRUCTURE.md) | Components, ports, dependencies |
| [Docker](./docker/DOCKER.md) | Local dev compose, Dockerfiles, on-prem stack |
| [Helm / Kubernetes](./helm/KUBERNETES.md) | Chart structure, values, ingress |
| [Terraform — AWS](./terraform/AWS.md) | VPC, RDS, Redis, S3, EKS |
| [Azure](./azure/AZURE.md) | Planned Azure deployment *(not yet implemented)* |
| [On-Prem Install](./on-prem/INSTALL.md) | Customer datacenter installation summary |

### Architecture

| Document | Description |
|----------|-------------|
| [System](./architecture/SYSTEM.md) | Platform overview, modules, data flow |
| [Tenant & Domain](./architecture/TENANT_DOMAIN.md) | Multi-tenancy, DNS verification |
| [Core Verification](./architecture/CORE_VERIFICATION.md) | QR/manual verify (no AI) |
| [AI Boundary](./architecture/AI.md) | Optional AI layer, quotas, providers |
| [Hybrid](./architecture/HYBRID.md) | Core on-prem + cloud AI patterns |

### Operations & security

| Document | Description |
|----------|-------------|
| [Cloud Deploy Runbook](./runbooks/cloud-deploy.md) | Step-by-step AWS deployment |
| [On-Prem Runbook](./runbooks/onprem-install.md) | Full on-prem install procedure |
| [Disaster Recovery](./runbooks/DR.md) | Backup, restore, RTO/RPO |
| [Threat Model](./THREAT_MODEL.md) | STRIDE-style security analysis |
| [Production Readiness](./PRODUCTION_READINESS.md) | Go-live checklist |

### Project status *(engineering)*

| Document | Description |
|----------|-------------|
| [Code Review](./CODE_REVIEW.md) | Security, quality, and standards review |

---

## Repository layout

```
true-mark/
├── apps/
│   ├── api/              NestJS API (modular monolith)
│   ├── admin-web/        Next.js admin portal
│   ├── consumer-web/     Next.js consumer verification
│   └── e2e/              Playwright acceptance tests
├── packages/
│   ├── db/               Prisma schema + seed
│   ├── shared/           Enums, Zod schemas, constants
│   └── config/           Environment validation
├── infra/
│   ├── docker/           Dockerfiles + Compose
│   ├── helm/truemark/    Kubernetes Helm chart
│   └── terraform/aws/    AWS infrastructure
├── docs/                 ← You are here
└── scripts/              Load test, DR drill
```

---

## Environment variables

See [README — Configure Environment](../README.md#3-configure-environment) and `packages/config/src/index.ts` for the full validated schema.

**Important:** Do not set `NODE_ENV` in `.env` for local development — it breaks Next.js production builds when sourced. Use `NODE_ENV=production` only when running `next build`.
