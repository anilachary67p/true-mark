# Azure Deployment

> **Start here:** [Production Setup Guide](../deployment/PRODUCTION_SETUP_GUIDE.md) (§6 Azure)  
> **Runbook:** [Azure Deploy Runbook](../runbooks/azure-deploy.md)

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

See [Production Setup Guide](../deployment/PRODUCTION_SETUP_GUIDE.md) for full Azure steps:

1. **Simple:** VM + Docker Compose (same as on-prem)
2. **Production:** AKS + PostgreSQL Flexible + Redis + Blob + Key Vault + Helm

## Related docs

- [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md)
- [Terraform AWS](./AWS.md)
- [On-Prem Install](../on-prem/INSTALL.md)
