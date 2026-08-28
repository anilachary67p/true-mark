# Azure Deployment Runbook

> Step-by-step Azure deployment for TrueMark.  
> **Full prerequisites, Auth0 setup, and checklists:** [Production Setup Guide](../deployment/PRODUCTION_SETUP_GUIDE.md)

## Status

| Item | Status |
|------|--------|
| Application containers | ✅ Dockerfiles in `infra/docker/` |
| Helm chart | ✅ `infra/helm/truemark/` |
| Azure Terraform | ❌ Not yet in repo — manual provisioning below |
| Auth0 / OIDC in app | ❌ Planned — use `AUTH_MODE=dev` + `JWT_SECRET` today |

## Choose a path

| Path | When to use | Guide section |
|------|-------------|---------------|
| **A — VM + Docker Compose** | Pilot, single tenant, fastest | [§6.3](../deployment/PRODUCTION_SETUP_GUIDE.md#63-option-a--deploy-on-azure-vm-step-by-step) |
| **B — AKS + managed services** | Production HA, multi-tenant SaaS | [§6.4](../deployment/PRODUCTION_SETUP_GUIDE.md#64-option-b--deploy-on-aks-step-by-step) |

## Recommended instance specifications

### Path A — VM + Docker Compose

Same workload as on-prem. Use these Azure VM SKUs:

| Tier | SKU | vCPU | RAM | Disks | Monthly est. |
|------|-----|------|-----|-------|--------------|
| Pilot | `Standard_D4s_v5` | 4 | 16 GB | 128 GB Premium SSD | ~$140–180 |
| **Production** | `Standard_D8s_v5` | 8 | 32 GB | 128 GB OS + 256 GB data (Premium SSD) | ~$280–350 |
| Enterprise | `Standard_D16s_v5` | 16 | 64 GB | 128 GB OS + 512 GB data (Premium SSD) | ~$560–700 |

```bash
# Production tier example
az vm create \
  --resource-group rg-truemark-prod \
  --name vm-truemark \
  --image Ubuntu2204 \
  --size Standard_D8s_v5 \
  --os-disk-size-gb 128 \
  --data-disk-sizes-gb 256 \
  --storage-sku Premium_LRS \
  --admin-username azureuser \
  --generate-ssh-keys
```

### Path B — AKS + managed services

| Tier | AKS worker nodes | PostgreSQL Flexible | Redis | Notes |
|------|------------------|---------------------|-------|-------|
| Pilot | 2× `Standard_D2s_v5` | `Burstable_B2s`, 64 GB | Basic C1 | Non-HA; dev/UAT only |
| **Production** | 3× `Standard_D4s_v5` | `Standard_D4ds_v4` GP, 128 GB, **Zone redundant HA** | Premium P1 | **Default recommendation** |
| Enterprise | 3–5× `Standard_D8s_v5` | `Standard_D8ds_v4` GP, 256 GB, Zone redundant HA | Premium P2 | + Front Door, autoscale |

**AKS cluster sizing (Production):**

```bash
az aks create \
  --resource-group rg-truemark-prod \
  --name aks-truemark \
  --node-count 3 \
  --node-vm-size Standard_D4s_v5 \
  --node-osdisk-size 128 \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 8
```

| Component | Production SKU | vCPU | RAM | Storage |
|-----------|----------------|------|-----|---------|
| PostgreSQL Flexible Server | `Standard_D4ds_v4` (GP, HA) | 4 | 16 GB | 128 GB (grow to 512 GB) |
| Azure Cache for Redis | Premium P1 | — | 6 GB | Persistence enabled |
| Blob Storage | Standard GRS | — | — | 500 GB initial |
| Application Gateway | WAF_v2 | — | — | 1–2 instances |

**Estimated monthly cost:** Pilot $400–600 · Production $1,000–1,500 · Enterprise $2,000–3,500 (East US).

## Prerequisites

1. Azure subscription with **Contributor** access
2. Azure CLI installed and logged in (`az login`)
3. Domain DNS manageable (Azure DNS or external)
4. Tools: `docker`, `kubectl`, `helm` (for AKS path)

## Path A — Quick (VM)

```bash
# Create VM (see Production Setup Guide for full commands)
az vm create --resource-group rg-truemark-prod --name vm-truemark \
  --image Ubuntu2204 --size Standard_D8s_v5 --admin-username azureuser --generate-ssh-keys

# SSH and run on-prem install
ssh azureuser@<vm-public-ip>
# Follow docs/on-prem/INSTALL.md
```

## Path B — Production (AKS)

### 1. Provision services

```bash
az group create --name rg-truemark-prod --location eastus

# See Production Setup Guide §6.4.1 for:
# - PostgreSQL Flexible Server
# - Azure Cache for Redis
# - Storage Account
# - Key Vault
# - Azure Container Registry
# - AKS cluster
```

### 2. Push images to ACR

```bash
az acr login --name <acr-name>
docker build -f infra/docker/Dockerfile.api -t <acr>.azurecr.io/truemark/api:latest .
docker push <acr>.azurecr.io/truemark/api:latest
# Repeat for admin-web and consumer-web
```

### 3. Create Kubernetes secrets

```bash
kubectl create namespace truemark

kubectl create secret generic truemark-db-credentials \
  --from-literal=DATABASE_URL='postgresql://...' -n truemark

kubectl create secret generic truemark-jwt-secret \
  --from-literal=JWT_SECRET='...' -n truemark

kubectl create secret generic truemark-redis-credentials \
  --from-literal=REDIS_URL='rediss://...' -n truemark
```

### 4. Deploy Helm

```bash
helm upgrade --install truemark infra/helm/truemark \
  -f values-azure-production.yaml \
  -n truemark
```

### 5. Migrate database

```bash
kubectl run prisma-migrate --rm -it --restart=Never \
  --image=<acr>.azurecr.io/truemark/api:latest -n truemark \
  --env-from=secret/truemark-db-credentials \
  --command -- sh -c "pnpm db:push && pnpm db:seed"
```

### 6. Smoke test

```bash
curl https://api.yourcompany.com/api/v1/health/ready
# Login to admin, create tenant, test verification
```

## Post-deploy

- Rotate seed passwords
- Configure verification DNS TXT records
- Enable Azure Monitor alerts
- Complete [Production Readiness](../PRODUCTION_READINESS.md) checklist

## Related docs

- [Production Setup Guide](../deployment/PRODUCTION_SETUP_GUIDE.md)
- [Azure Guide](../azure/AZURE.md)
- [Helm / Kubernetes](../helm/KUBERNETES.md)
