# Cloud Deployment Runbook

> Deploy TrueMark to AWS using Terraform and Helm.  
> **See also:** [Terraform AWS](../terraform/AWS.md) · [Helm / Kubernetes](../helm/KUBERNETES.md) · [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md)

## Prerequisites

| Requirement | Version | Notes                                        |
| ----------- | ------- | -------------------------------------------- |
| AWS CLI     | ≥ 2.x   | Configured with deploy role                  |
| Terraform   | ≥ 1.7   |                                              |
| kubectl     | ≥ 1.29  |                                              |
| Helm        | ≥ 3.14  |                                              |
| Docker      | ≥ 24    | For image build                              |
| pnpm        | ≥ 9     | For application build                        |
| Domain      | —       | Route53 hosted zone for verification domains |

## Architecture Overview

```
Route53 → CloudFront/WAF → ALB → EKS (TrueMark pods)
                                    ├── API (NestJS)
                                    ├── Admin Web (Next.js)
                                    └── Worker (BullMQ)
                RDS PostgreSQL (Multi-AZ)
                ElastiCache Redis (Cluster)
                S3 (Object Storage)
                Secrets Manager
                CloudWatch (Monitoring)
```

---

## Step 1: Infrastructure Provisioning

### 1.1 Configure Terraform Variables

```bash
cd infra/terraform/aws
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

```hcl
aws_region       = "us-east-1"
environment      = "production"
project_name     = "truemark"
vpc_cidr         = "10.0.0.0/16"

# RDS
db_instance_class    = "db.r6g.large"
db_allocated_storage = 100
db_name              = "truemark"
db_username          = "truemark_admin"

# ElastiCache
redis_node_type   = "cache.r6g.large"
redis_num_nodes   = 2

# EKS
eks_cluster_version = "1.29"
eks_node_instance_types = ["m6i.xlarge"]
eks_desired_capacity    = 3
eks_min_capacity        = 2
eks_max_capacity        = 6
```

### 1.2 Initialize and Apply Terraform

```bash
terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

This creates:

- VPC with public/private subnets across 3 AZs
- RDS PostgreSQL (Multi-AZ, encrypted)
- ElastiCache Redis cluster
- S3 bucket for object storage
- EKS cluster with managed node group
- Secrets Manager entries for DB credentials
- Security groups and IAM roles

### 1.3 Capture Outputs

```bash
terraform output -json > ../../deploy-outputs.json
```

Key outputs:

- `eks_cluster_name`
- `rds_endpoint`
- `redis_endpoint`
- `s3_bucket_name`
- `secrets_manager_arn`

---

## Step 2: Configure kubectl

```bash
aws eks update-kubeconfig \
  --region us-east-1 \
  --name $(terraform output -raw eks_cluster_name)
```

Verify:

```bash
kubectl get nodes
```

---

## Step 3: Build and Push Container Images

### 3.1 Create ECR Repositories

```bash
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

aws ecr create-repository --repository-name truemark/api --region $AWS_REGION
aws ecr create-repository --repository-name truemark/admin-web --region $AWS_REGION

aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com
```

### 3.2 Build Images

From repository root:

```bash
# API
docker build -f infra/docker/Dockerfile.api \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/truemark/api:$(git rev-parse --short HEAD) .

# Admin Web
docker build -f infra/docker/Dockerfile.admin-web \
  -t $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/truemark/admin-web:$(git rev-parse --short HEAD) .

docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/truemark/api:$(git rev-parse --short HEAD)
docker push $AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/truemark/admin-web:$(git rev-parse --short HEAD)
```

---

## Step 4: Deploy with Helm

### 4.1 Configure Values

```bash
cd infra/helm/truemark
cp values-production.yaml values-production.local.yaml
```

Edit `values-production.local.yaml`:

```yaml
global:
  environment: production
  imageTag: '<git-sha>'

api:
  replicaCount: 3
  resources:
    requests: { cpu: 500m, memory: 512Mi }
    limits: { cpu: 1000m, memory: 1Gi }
  env:
    DATABASE_URL: '' # Injected from secret
    REDIS_URL: '' # Injected from secret
    STORAGE_PROVIDER: s3
    AUTH_MODE: oidc
    AI_PROVIDER: openai

adminWeb:
  replicaCount: 2

worker:
  replicaCount: 2

ingress:
  enabled: true
  className: alb
  hosts:
    - host: api.truemark.example.com
      paths: [{ path: /, pathType: Prefix, service: api }]
    - host: admin.truemark.example.com
      paths: [{ path: /, pathType: Prefix, service: adminWeb }]

postgresql:
  enabled: false # Using RDS

redis:
  enabled: false # Using ElastiCache

externalDatabase:
  host: '<rds-endpoint>'
  port: 5432
  database: truemark
  existingSecret: truemark-db-credentials

externalRedis:
  host: '<redis-endpoint>'
  port: 6379

secrets:
  provider: aws-secrets-manager
  jwtSecretKey: truemark/production/jwt-secret
  aiApiKeySecret: truemark/production/ai-api-key
```

### 4.2 Create Kubernetes Secrets

```bash
# Database credentials from Secrets Manager
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id truemark/production/db-credentials \
  --query SecretString --output text)

kubectl create namespace truemark
kubectl create secret generic truemark-db-credentials \
  --namespace truemark \
  --from-literal=DATABASE_URL="$DB_SECRET"
```

### 4.3 Install Helm Chart

```bash
helm upgrade --install truemark . \
  --namespace truemark \
  --values values-production.local.yaml \
  --wait --timeout 10m
```

Verify:

```bash
kubectl get pods -n truemark
kubectl get ingress -n truemark
```

---

## Step 5: Database Migration

Run as a Kubernetes Job:

```bash
kubectl run truemark-migrate \
  --namespace truemark \
  --image=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/truemark/api:$(git rev-parse --short HEAD) \
  --restart=Never \
  --env-from=secret/truemark-db-credentials \
  --command -- npx prisma migrate deploy

kubectl logs truemark-migrate -n truemark
kubectl delete pod truemark-migrate -n truemark
```

Seed (staging only):

```bash
kubectl run truemark-seed \
  --namespace truemark \
  --image=$AWS_ACCOUNT.dkr.ecr.$AWS_REGION.amazonaws.com/truemark/api:$(git rev-parse --short HEAD) \
  --restart=Never \
  --env-from=secret/truemark-db-credentials \
  --command -- npx prisma db seed
```

---

## Step 6: DNS and TLS

### 6.1 Configure Route53

Point domains to ALB ingress:

```bash
ALB_HOST=$(kubectl get ingress truemark -n truemark -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# api.truemark.example.com → ALB
# admin.truemark.example.com → ALB
# *.verify.truemark.example.com → ALB (wildcard for tenant verification domains)
```

### 6.2 TLS Certificates

Use AWS Certificate Manager:

```bash
aws acm request-certificate \
  --domain-name "*.truemark.example.com" \
  --subject-alternative-names "truemark.example.com" \
  --validation-method DNS
```

Attach certificate to ALB via ingress annotation.

---

## Step 7: Smoke Tests

```bash
# Health check
curl -sf https://api.truemark.example.com/health
curl -sf https://api.truemark.example.com/health/ready

# Admin login (OIDC)
open https://admin.truemark.example.com

# Verification endpoint (should return UNABLE_TO_VERIFY for invalid token)
curl -X POST https://api.truemark.example.com/public/verify/qr \
  -H "Content-Type: application/json" \
  -d '{"url": "https://verify.demo.truemark.example.com/v/invalid", "hostname": "verify.demo.truemark.example.com"}'
```

---

## Step 8: Monitoring Setup

### CloudWatch Dashboards

Create dashboards for:

- API request rate and latency (p50, p95, p99)
- Verification result distribution
- Error rate (5xx)
- Database connections and CPU
- Redis memory and connections
- BullMQ queue depth
- Pod CPU/memory utilization

### Alerting

| Alert              | Condition              | Severity |
| ------------------ | ---------------------- | -------- |
| API down           | Health check fails 3x  | Critical |
| High error rate    | 5xx > 1% for 5 min     | Critical |
| High latency       | p95 > 500ms for 10 min | Warning  |
| DB connections     | > 80% pool             | Warning  |
| Redis memory       | > 80%                  | Warning  |
| Queue backlog      | > 1000 jobs for 15 min | Warning  |
| Certificate expiry | < 30 days              | Warning  |

---

## Rollback Procedure

### Application Rollback

```bash
# Rollback to previous Helm release
helm rollback truemark -n truemark

# Or deploy specific version
helm upgrade truemark . \
  --namespace truemark \
  --values values-production.local.yaml \
  --set api.image.tag=<previous-sha> \
  --set adminWeb.image.tag=<previous-sha>
```

### Database Rollback

Database migrations should be backward-compatible (expand-contract pattern). If rollback required:

1. Restore from latest RDS snapshot
2. See [DR Runbook](./DR.md) for full restore procedure

---

## Scaling

### Manual Scale

```bash
kubectl scale deployment truemark-api --replicas=5 -n truemark
kubectl scale deployment truemark-worker --replicas=3 -n truemark
```

### Auto-Scaling (HPA)

Configured in Helm values:

```yaml
api:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilization: 70
```

---

## Maintenance Windows

| Task                | Frequency   | Procedure              |
| ------------------- | ----------- | ---------------------- |
| Security patches    | Monthly     | Rolling pod restart    |
| Dependency updates  | Bi-weekly   | CI/CD pipeline         |
| DB maintenance      | AWS-managed | RDS maintenance window |
| Certificate renewal | Auto (ACM)  | Monitor expiry alerts  |
| Backup verification | Monthly     | DR drill               |

---

## Troubleshooting

| Symptom                  | Check                            | Fix                              |
| ------------------------ | -------------------------------- | -------------------------------- |
| Pods CrashLoopBackOff    | `kubectl logs <pod> -n truemark` | Check env vars, DB connectivity  |
| 502 from ALB             | Pod readiness probe              | Check `/health/ready`            |
| Slow verification        | DB slow query log                | Add indexes, scale RDS           |
| Redis connection refused | Security group rules             | Allow EKS → ElastiCache          |
| OIDC login fails         | IdP configuration                | Verify OIDC_ISSUER, callback URL |
| Migrations fail          | Migration logs                   | Fix schema conflict, retry       |

---

## Related Documents

- [On-Prem Install Runbook](./onprem-install.md)
- [Disaster Recovery Runbook](./DR.md)
- [System Architecture](../architecture/SYSTEM.md)
- [Production Readiness](../PRODUCTION_READINESS.md)
