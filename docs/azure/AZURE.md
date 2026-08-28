# Azure Deployment

> **Status: Planned** — Azure-specific Terraform and runbooks are not yet implemented in this repository.

## Current state

TrueMark today supports:

- **AWS** — full Terraform stub + Helm + cloud runbook
- **On-premises** — Docker Compose + nginx
- **Hybrid** — core on-prem + cloud AI gateway

Azure deployment would follow the same application architecture with Azure-native equivalents.

## Planned Azure resources

| AWS (current) | Azure (planned) |
|-------------|-----------------|
| EKS | AKS |
| RDS PostgreSQL | Azure Database for PostgreSQL Flexible Server |
| ElastiCache Redis | Azure Cache for Redis |
| S3 | Azure Blob Storage |
| Secrets Manager | Azure Key Vault |
| ALB + Ingress | Application Gateway or NGINX Ingress |
| Route53 | Azure DNS |
| ACM | Azure Key Vault certificates |

## Planned directory structure

```
infra/terraform/azure/     # Future: main.tf, variables, outputs
docs/runbooks/azure-deploy.md
```

## Deployment approach (when implemented)

1. Provision AKS + PostgreSQL + Redis + Blob Storage via Terraform
2. Store secrets in Key Vault; inject via AKS secrets / CSI driver
3. Deploy existing Helm chart with Azure-specific values overlay
4. Configure Azure Front Door or Application Gateway for TLS
5. Point customer verification domains via Azure DNS

## Hybrid on Azure

Customers may run:

- **Pattern A:** Core on-prem + Azure OpenAI / Vision API for AI
- **Pattern B:** AKS application + PostgreSQL on customer VNet

See [Hybrid Architecture](../architecture/HYBRID.md) for boundary rules.

## Workaround today

To run on Azure before native IaC exists:

1. Deploy using [On-Prem Docker stack](../docker/DOCKER.md) on Azure VMs, **or**
2. Deploy to AKS manually using [Helm chart](../../infra/helm/truemark/) with Azure-managed PostgreSQL and Redis connection strings

## Related docs

- [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md)
- [Terraform AWS](./AWS.md)
- [On-Prem Install](../on-prem/INSTALL.md)
