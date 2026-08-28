# Helm / Kubernetes

> Deploy TrueMark to Kubernetes using the Helm chart at `infra/helm/truemark/`.

## Chart structure

```
infra/helm/truemark/
├── Chart.yaml
├── values.yaml
└── templates/
    ├── _helpers.tpl
    ├── api-deployment.yaml
    ├── api-service.yaml
    ├── admin-web-deployment.yaml
    ├── admin-web-service.yaml
    └── ingress.yaml
```

## Prerequisites

- Kubernetes 1.29+
- Helm 3.14+
- Ingress controller (nginx recommended)
- External PostgreSQL and Redis (or in-cluster operators)

## Install

```bash
# Build and push images first
docker build -f infra/docker/Dockerfile.api -t <registry>/truemark/api:<tag> .
docker build -f infra/docker/Dockerfile.admin-web -t <registry>/truemark/admin-web:<tag> .
docker push <registry>/truemark/api:<tag>
docker push <registry>/truemark/admin-web:<tag>

# Install chart
helm upgrade --install truemark infra/helm/truemark \
  --namespace truemark --create-namespace \
  -f infra/helm/truemark/values.yaml \
  --set api.image.tag=<tag> \
  --set adminWeb.image.tag=<tag>
```

## Key values (`values.yaml`)

| Key | Description |
|-----|-------------|
| `api.replicaCount` | API pod count |
| `api.image.repository` | API image registry path |
| `api.env.DATABASE_URL` | Postgres connection (use K8s secret) |
| `api.env.REDIS_URL` | Redis connection |
| `adminWeb.env.NEXT_PUBLIC_API_URL` | Public API URL for browser |
| `ingress.enabled` | Enable ingress resource |
| `ingress.hosts` | Hostname + path routing |

## Ingress routing

Default values route:

| Path | Service |
|------|---------|
| `/` | admin-web |
| `/api` | api |

Adjust `ingress.hosts` for your domains.

## Secrets

Do not put secrets in `values.yaml` in git. Use:

```bash
kubectl create secret generic truemark-secrets \
  --namespace truemark \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=JWT_SECRET='...'
```

Reference via `envFrom` in deployment templates (extend chart as needed).

## Lint chart

```bash
helm lint infra/helm/truemark
```

## Related docs

- [Cloud Deploy Runbook](../runbooks/cloud-deploy.md)
- [Terraform AWS](../terraform/AWS.md)
- [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md)
