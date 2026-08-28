# Azure Deployment

> **Start here:** [Production Setup Guide](../deployment/PRODUCTION_SETUP_GUIDE.md) (§6 Azure)  
> **Runbook:** [Azure Deploy Runbook](../runbooks/azure-deploy.md)

## Recommended instance specifications

### Azure VM path (same as on-prem, on Azure)

| Tier | VM SKU | vCPU | RAM | Disk |
|------|--------|------|-----|------|
| Pilot | `Standard_D4s_v5` | 4 | 16 GB | 128 GB Premium SSD |
| **Production** | `Standard_D8s_v5` | 8 | 32 GB | 256 GB Premium SSD |
| Enterprise | `Standard_D16s_v5` | 16 | 64 GB | 512 GB Premium SSD |

### AKS + managed services path

| Tier | AKS nodes | PostgreSQL | Redis | Est. monthly |
|------|-----------|------------|-------|--------------|
| Pilot | 2× `Standard_D2s_v5` | Burstable B2s | Basic C1 | $400–600 |
| **Production** | 3× `Standard_D4s_v5` | Standard_D4ds_v4 GP HA | Premium P1 | $1,000–1,500 |
| Enterprise | 5× `Standard_D8s_v5` | Standard_D8ds_v4 GP HA | Premium P2 | $2,000–3,500 |

Full sizing tables, per-component RAM, and scaling rules: [Production Setup Guide §6.2](../deployment/PRODUCTION_SETUP_GUIDE.md#62-azure-resources-required).

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
