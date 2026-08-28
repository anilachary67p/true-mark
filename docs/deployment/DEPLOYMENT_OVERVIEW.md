# Deployment Overview

> How TrueMark is deployed across SaaS, dedicated cloud, on-premises, and hybrid models.

## Deployment models

| Model             | `DeploymentType`  | Typical use                           |
| ----------------- | ----------------- | ------------------------------------- |
| Multi-tenant SaaS | `SAAS`            | TrueMark-hosted shared platform       |
| Dedicated cloud   | `DEDICATED_CLOUD` | Single tenant in TrueMark AWS account |
| Customer cloud    | `CUSTOMER_CLOUD`  | Tenant's own AWS/Azure account        |
| On-premises       | `ON_PREM`         | Full stack in customer datacenter     |
| Hybrid            | `HYBRID`          | Core on-prem + cloud AI (Pattern A)   |

## Component matrix

| Component      | SaaS (AWS)       | On-prem            | Hybrid                               |
| -------------- | ---------------- | ------------------ | ------------------------------------ |
| API            | EKS pods         | Docker             | On-prem Docker                       |
| Admin Web      | EKS / CDN        | Docker + nginx     | On-prem                              |
| Consumer Web   | EKS / CDN        | Docker + nginx     | On-prem                              |
| PostgreSQL     | RDS Multi-AZ     | Docker Postgres    | On-prem                              |
| Redis          | ElastiCache      | Docker Redis       | On-prem                              |
| Object storage | S3               | MinIO              | On-prem (+ cloud AI images optional) |
| AI provider    | OpenAI / gateway | Mock / local model | Cloud gateway                        |
| Secrets        | Secrets Manager  | `.env` / Vault     | Mixed                                |

## Deployment guides

| Target           | Quick start                                     | Detailed runbook                                 |
| ---------------- | ----------------------------------------------- | ------------------------------------------------ |
| **AWS**          | [Terraform AWS](./terraform/AWS.md)             | [Cloud Deploy](../runbooks/cloud-deploy.md)      |
| **On-premises**  | [On-Prem Install](./on-prem/INSTALL.md)         | [On-Prem Runbook](../runbooks/onprem-install.md) |
| **Kubernetes**   | [Helm](./helm/KUBERNETES.md)                    | [Cloud Deploy](../runbooks/cloud-deploy.md)      |
| **Docker (dev)** | [Docker](./docker/DOCKER.md)                    | —                                                |
| **Azure**        | [Azure](./azure/AZURE.md)                       | _(planned)_                                      |
| **Hybrid**       | [Hybrid Architecture](./architecture/HYBRID.md) | [DR](../runbooks/DR.md)                          |

## Release process (recommended)

1. `pnpm build` + `pnpm test` + `pnpm test:e2e` (CI)
2. Build and push container images (tag with git SHA)
3. Apply DB migrations (`prisma migrate deploy`)
4. Deploy Helm release or Compose stack
5. Smoke test: `/health/ready`, login, E2E verify fixture
6. Monitor dashboards and error rates

## Environment configuration

All services read from validated env schema in `packages/config`. See root `.env.example` for local development template.

**Never commit** `.env` files with real secrets.

## Related docs

- [Infrastructure](./infrastructure/INFRASTRUCTURE.md)
- [Production Readiness](../PRODUCTION_READINESS.md)
- [Code Review](../CODE_REVIEW.md)
