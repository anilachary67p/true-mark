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
