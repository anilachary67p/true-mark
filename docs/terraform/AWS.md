# Terraform — AWS

> AWS infrastructure as code at `infra/terraform/aws/main.tf`.

## Overview

Provisions a production-grade AWS environment for TrueMark SaaS or dedicated-tenant deployments.

## Resources created

| Resource | Purpose |
|----------|---------|
| VPC | 3 AZ public + private subnets |
| RDS PostgreSQL 16 | Multi-AZ, encrypted, automated backups |
| ElastiCache Redis | Session cache + BullMQ |
| S3 | Object storage for AI images, QR exports |
| EKS | Kubernetes cluster for API + web pods |
| Secrets Manager | DB credentials, JWT secret, AI keys |
| IAM roles | EKS node + pod service accounts |
| Security groups | Least-privilege network rules |

## Prerequisites

| Tool | Version |
|------|---------|
| Terraform | ≥ 1.7 |
| AWS CLI | ≥ 2.x |
| AWS account + deploy IAM role |

## State backend

Configured in `main.tf`:

```hcl
backend "s3" {
  bucket         = "truemark-terraform-state"
  key            = "aws/production/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "truemark-terraform-locks"
}
```

Create the S3 bucket and DynamoDB lock table **before** first `terraform init`.

## Quick start

```bash
cd infra/terraform/aws

# Create terraform.tfvars (see cloud-deploy runbook for full example)
cat > terraform.tfvars <<'EOF'
aws_region       = "us-east-1"
environment      = "production"
project_name     = "truemark"
db_instance_class = "db.r6g.large"
eks_cluster_version = "1.29"
EOF

terraform init
terraform plan -out=plan.tfplan
terraform apply plan.tfplan
```

## Key variables

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `us-east-1` | AWS region |
| `environment` | `production` | Environment tag |
| `vpc_cidr` | `10.0.0.0/16` | VPC CIDR |
| `db_instance_class` | `db.r6g.large` | RDS instance |
| `db_allocated_storage` | `100` | RDS storage GB |
| `redis_node_type` | `cache.r6g.large` | ElastiCache |
| `eks_cluster_version` | `1.29` | Kubernetes version |

See `main.tf` for the complete variable list.

## Outputs

After apply, use Terraform outputs for:

- RDS endpoint → `DATABASE_URL`
- Redis endpoint → `REDIS_URL`
- S3 bucket name → `STORAGE_PROVIDER=s3`
- EKS cluster name → `kubectl` context

## Post-Terraform steps

1. Configure `kubectl` for the EKS cluster
2. Deploy Helm chart — [Kubernetes Guide](../helm/KUBERNETES.md)
3. Run `prisma migrate deploy` via init job or CI
4. Configure Route53 + ACM for verification domains
5. Run smoke tests from [Cloud Deploy Runbook](../runbooks/cloud-deploy.md)

## Cost considerations

- RDS Multi-AZ and EKS control plane have fixed monthly costs
- Use `environment = "staging"` with smaller instance classes for non-prod
- Enable S3 lifecycle policies for AI image retention

## Related docs

- [Cloud Deploy Runbook](../runbooks/cloud-deploy.md) — full step-by-step
- [Helm / Kubernetes](../helm/KUBERNETES.md)
- [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md)
- [DR Runbook](../runbooks/DR.md) — RDS backup/restore
