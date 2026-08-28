# TrueMark Production Setup Guide

> End-to-end checklist for deploying TrueMark **on-premises** or on **Microsoft Azure**.  
> Covers accounts to create, tools to install, infrastructure, authentication, DNS, and post-deploy configuration.

**Related docs**

| Topic | Document |
|-------|----------|
| On-prem quick start | [On-Prem Install](../on-prem/INSTALL.md) |
| On-prem step-by-step | [On-Prem Runbook](../runbooks/onprem-install.md) |
| Azure (planned IaC) | [Azure Guide](../azure/AZURE.md) |
| AWS (fully scripted) | [Terraform AWS](../terraform/AWS.md) · [Cloud Runbook](../runbooks/cloud-deploy.md) |
| Go-live checklist | [Production Readiness](../PRODUCTION_READINESS.md) |
| Auth reference | [Authentication](../api/AUTHENTICATION.md) |

---

## 1. Choose your deployment model

| Model | Best for | Complexity | TrueMark support today |
|-------|----------|------------|------------------------|
| **On-premises (Docker Compose)** | Customer datacenter, air-gapped, full data control | Low–medium | ✅ Full stack in repo |
| **Azure VMs + Docker Compose** | Azure without Kubernetes | Medium | ✅ Same as on-prem on Azure VMs |
| **Azure AKS + managed services** | Production Azure, scale, HA | High | ⚠️ Manual Helm deploy (no Azure Terraform yet) |
| **AWS EKS + Terraform** | SaaS / dedicated cloud on AWS | High | ✅ Terraform + Helm + runbook |

This guide focuses on **on-premises** and **Azure**. For AWS, use [Cloud Deploy Runbook](../runbooks/cloud-deploy.md).

---

## 2. Master checklist — everything you must create

Use this as your project plan. Check off each item before go-live.

### 2.1 Accounts & access

| # | Item | On-prem | Azure | Notes |
|---|------|---------|-------|-------|
| 1 | **Deployment owner** (person/team) | ✓ | ✓ | Runs install, upgrades, incidents |
| 2 | **DNS admin access** | ✓ | ✓ | For verification domains + admin URL |
| 3 | **TLS certificate authority** | ✓ | ✓ | PKI, Let's Encrypt, or Azure-managed certs |
| 4 | **Identity provider (IdP)** | ✓ | ✓ | Auth0, Azure AD, Keycloak, etc. *(see §4)* |
| 5 | **Azure subscription** | — | ✓ | Pay-as-you-go or Enterprise Agreement |
| 6 | **Azure AD / Entra ID** | Optional | ✓ | For Azure portal access + optional admin SSO |
| 7 | **Container registry** | Optional | ✓ | ACR, or private Harbor on-prem |
| 8 | **SMTP / email** (optional) | Optional | Optional | For alerts; not required for core verify |

### 2.2 Infrastructure components

| Component | Purpose | On-prem | Azure equivalent |
|-----------|---------|---------|------------------|
| **PostgreSQL 16** | System of record | Docker container | Azure Database for PostgreSQL Flexible Server |
| **Redis 7** | BullMQ jobs, caching | Docker container | Azure Cache for Redis |
| **Object storage** | QR exports, AI images | MinIO container | Azure Blob Storage |
| **API** | NestJS backend | Docker | AKS pod or VM container |
| **Admin Web** | Next.js admin portal | Docker | AKS pod or VM container |
| **Consumer Web** | Public verification UI | Docker | AKS pod or VM container |
| **Reverse proxy** | TLS, routing | nginx (included) | Application Gateway, Front Door, or nginx |
| **Secrets store** | Passwords, API keys | `.env` file / HashiCorp Vault | Azure Key Vault |

### 2.3 Application secrets to generate

Generate **before** first deploy (never use defaults in production):

```bash
# JWT signing secret (required for AUTH_MODE=dev)
openssl rand -base64 48

# Database password
openssl rand -base64 24

# MinIO access key (on-prem) — or use Azure Storage keys
openssl rand -hex 16   # access key
openssl rand -base64 32   # secret key
```

Store in a password manager or secrets vault. **Never commit to git.**

### 2.4 DNS records to plan

| Hostname | Purpose | Example |
|----------|---------|---------|
| `verify.yourcompany.com` | Consumer QR verification (public) | CNAME → load balancer |
| `admin.yourcompany.com` | Admin portal (internal or VPN) | CNAME → internal LB |
| `api.yourcompany.com` | API (if exposed separately) | Optional; often same LB as admin |

**Verification domain TXT record** — created per tenant in Admin → Domains after install (for domain ownership proof).

### 2.5 Optional services

| Service | When needed |
|---------|-------------|
| **Auth0** (or Azure AD B2C) | Enterprise SSO + MFA for admin users |
| **OpenAI / Azure OpenAI** | Live AI product image validation |
| **Prometheus + Grafana** | Metrics (`docker compose --profile monitoring`) |
| **WAF** | Public verification abuse protection |
| **SIEM / log aggregation** | Compliance, fraud investigation |

---

## 3. Tools to install

### 3.1 On-premises server

| Tool | Minimum version | Purpose |
|------|-----------------|---------|
| **Linux OS** | Ubuntu 22.04+ / RHEL 8+ | Host OS |
| **Docker Engine** | ≥ 24 | Run all services |
| **Docker Compose** | ≥ 2.20 | Orchestrate stack |
| **git** | any recent | Clone release |
| **openssl** | any | Generate secrets |
| **curl / wget** | any | Health checks |

Optional:

| Tool | Purpose |
|------|---------|
| `certbot` | Let's Encrypt TLS (if public verify domain) |
| `jq` | Parse JSON in scripts |
| HashiCorp **Vault** | Enterprise secret management |
| **Harbor** / private registry | Air-gapped image mirror |

### 3.2 Azure deployment (operator workstation)

| Tool | Minimum version | Purpose |
|------|-----------------|---------|
| **Azure CLI** (`az`) | ≥ 2.50 | Create/manage Azure resources |
| **Terraform** | ≥ 1.7 | *(future)* Azure IaC — not in repo yet |
| **kubectl** | ≥ 1.29 | Manage AKS (if using Kubernetes) |
| **Helm** | ≥ 3.14 | Deploy `infra/helm/truemark/` chart |
| **Docker** | ≥ 24 | Build/push images to ACR |
| **pnpm** | ≥ 9 | Build apps (if building from source) |
| **Node.js** | ≥ 20 | Same |

Install Azure CLI:

```bash
# macOS
brew install azure-cli

# Linux
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
```

---

## 4. Authentication — Auth0 and identity setup

### 4.1 Current implementation (what works today)

> **Important:** The API currently uses **email/password login + JWT** (`AUTH_MODE=dev`).  
> `AUTH_MODE=oidc` is defined in config but **not yet implemented** in code.  
> Admin Web uses a built-in login form, not an Auth0 redirect.

**Production today (supported path):**

1. Set `AUTH_MODE=dev`
2. Set a strong `JWT_SECRET` (≥ 32 characters)
3. Create admin users in the database (or change seed passwords immediately after `db:seed`)
4. Enforce MFA and SSO at the **network layer** (VPN, IP allowlist) until OIDC is wired

**Default seed users** (change passwords immediately in production):

| Email | Role | Default password |
|-------|------|------------------|
| `admin@truemark.local` | Platform Admin | `Admin123!@#` |
| `tenant-admin@abcpharma.com` | Tenant Admin | `Admin123!@#` |

### 4.2 Auth0 setup (recommended for enterprise — prepare now)

When OIDC support is added, configure Auth0 as follows. You can create these resources now so they are ready.

#### Step 1 — Create Auth0 tenant

1. Sign up at [auth0.com](https://auth0.com) (or use existing org tenant)
2. Choose region close to your users (US, EU, AU)
3. Note your **tenant domain**: `your-company.us.auth0.com`

#### Step 2 — Create API (Resource Server)

Represents the TrueMark API.

| Setting | Value |
|---------|-------|
| **Name** | TrueMark API |
| **Identifier (Audience)** | `https://api.yourcompany.com` or `truemark-api` |
| **Signing Algorithm** | RS256 |
| **RBAC** | Enable if using Auth0 roles |
| **Permissions** | Optional: `read:products`, `write:products`, etc. |

Env mapping (future):

```bash
OIDC_ISSUER=https://your-company.us.auth0.com/
OIDC_AUDIENCE=https://api.yourcompany.com
```

#### Step 3 — Create Admin Web application

| Setting | Value |
|---------|-------|
| **Application type** | Single Page Application (SPA) |
| **Name** | TrueMark Admin |
| **Allowed Callback URLs** | `https://admin.yourcompany.com/callback` |
| **Allowed Logout URLs** | `https://admin.yourcompany.com` |
| **Allowed Web Origins** | `https://admin.yourcompany.com` |
| **Grant types** | Authorization Code + Refresh Token |

Note **Client ID** (no secret needed for SPA).

#### Step 4 — Create Machine-to-Machine app (optional)

For server-side API-to-Auth0 calls or management API automation.

| Setting | Value |
|---------|-------|
| **Application type** | Machine to Machine |
| **Authorize** | Auth0 Management API (if provisioning users) |

Store **Client ID** and **Client Secret** in Key Vault / `.env`:

```bash
OIDC_CLIENT_ID=<m2m-client-id>
OIDC_CLIENT_SECRET=<m2m-client-secret>
```

#### Step 5 — Configure roles & claims

Map TrueMark roles to JWT claims (Auth0 **Actions** or **Rules**):

```javascript
// Auth0 Action — Post Login
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://truemark.app';
  const roles = event.authorization?.roles || [];
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
  api.accessToken.setCustomClaim(`${namespace}/tenant_ids`, event.user.app_metadata.tenant_ids || []);
};
```

TrueMark roles to assign in Auth0:

| Role | Description |
|------|-------------|
| `PLATFORM_ADMIN` | All tenants |
| `TENANT_ADMIN` | One tenant configuration |
| `PRODUCT_MANAGER` | Products, batches, QR |
| `FRAUD_INVESTIGATOR` | Fraud cases |
| `ANALYST` | Read-only analytics |
| `READ_ONLY` | Read-only tenant access |

#### Step 6 — Enable MFA

Auth0 Dashboard → **Security** → **Multi-factor Auth**:

- Enable **OTP** (authenticator app) for all admin users
- Optionally require MFA for every login

#### Step 7 — User provisioning

Choose one:

| Method | Use when |
|--------|----------|
| **Auth0 Database** | Small teams, manual user create |
| **Enterprise connection (SAML/OIDC)** | Customer already has Azure AD / Okta |
| **SCIM provisioning** | Large org, automated user lifecycle |

Link enterprise IdP: Auth0 → **Authentication** → **Enterprise** → Azure AD / Okta / Google Workspace.

#### Step 8 — API environment (when OIDC is implemented)

```bash
AUTH_MODE=oidc
OIDC_ISSUER=https://your-company.us.auth0.com/
OIDC_AUDIENCE=https://api.yourcompany.com
OIDC_CLIENT_ID=<api-or-m2m-client-id>
OIDC_CLIENT_SECRET=<client-secret>
```

Until OIDC is implemented, keep `AUTH_MODE=dev` and use strong `JWT_SECRET`.

### 4.3 Azure AD / Entra ID (alternative to Auth0)

If you prefer Microsoft identity:

| Auth0 concept | Azure equivalent |
|---------------|------------------|
| Tenant | Microsoft Entra ID tenant |
| API audience | App Registration → **Expose an API** → Application ID URI |
| SPA app | App Registration → **Single-page application** redirect URIs |
| M2M | App Registration → **Certificates & secrets** + API permissions |

Use **Entra ID B2C** only if external partners need admin access without corporate accounts.

---

## 5. On-premises deployment — full procedure

### 5.1 Hardware & network

#### Recommended instance specifications

| Tier | Use case | vCPU | RAM | Disk (SSD) | Network |
|------|----------|------|-----|------------|---------|
| **Pilot** | UAT, single tenant, &lt;100k units | 4 | 16 GB | 100 GB | 1 Gbps |
| **Production** | 1–5 tenants, &lt;5M units, daily backups | 8 | 32 GB | 256 GB | 1 Gbps |
| **Enterprise** | High verify volume, AI, HA | 16 | 64 GB | 512 GB–1 TB | 10 Gbps or bonded 1 Gbps |

**Production tier is the default recommendation** for any customer-facing deployment.

Per-service allocation on a single host (Production tier):

| Service | CPU | RAM | Storage growth |
|---------|-----|-----|----------------|
| API + BullMQ | 1–2 cores | 512 MB–1 GB | Minimal |
| Admin + Consumer web | 0.5 core | 512 MB | Minimal |
| PostgreSQL 16 | 1–2 cores | 2–4 GB | ~1–5 GB/month per 1M verifications (estimate) |
| Redis 7 | 0.25 core | 256–512 MB | Ephemeral |
| MinIO | 0.5 core | 512 MB–1 GB | QR exports + AI images |
| nginx + OS headroom | 2+ cores | 8+ GB | Logs, backups |

#### Scaling triggers

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU sustained &gt; 70% | 15 min | Upgrade to next tier or split DB to second host |
| Disk &gt; 70% | — | Expand volume; archive old QR exports |
| Verify p95 &gt; 500 ms | — | Add CPU; index tuning; dedicated Postgres |
| Bulk job backlog | &gt; 1 h | Increase Redis memory; add worker capacity |

#### HA on-prem (optional)

| Layout | Each node |
|--------|-----------|
| Active / passive pair | 8 vCPU, 32 GB RAM, 256 GB SSD |
| App + DB split | App: 8 vCPU / 32 GB — DB: 4 vCPU / 16 GB / 500 GB SSD |

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 16 GB | 32 GB |
| Disk | 100 GB SSD | 256–500 GB SSD |
| Network | 1 Gbps LAN | Redundant NICs |

Firewall rules:

| Direction | Port | Service |
|-----------|------|---------|
| Inbound | 443 (or 8080 dev) | nginx → admin + verify |
| Inbound | — | Block direct Postgres/Redis/MinIO from internet |
| Outbound | 443 | Optional: hybrid AI gateway, package updates |

### 5.2 Install steps

```bash
# 1. Prepare host
sudo mkdir -p /opt/truemark/{data,config,backups,logs}
cd /opt/truemark
git clone <your-repo-url> app && cd app

# 2. Configure environment
cp .env.example .env
# Edit .env — see section 5.3

# 3. Start stack
docker compose -f infra/docker/docker-compose.onprem.yml up -d --build

# 4. Initialize database (first run only)
docker compose -f infra/docker/docker-compose.onprem.yml exec api \
  sh -c "cd /app && pnpm db:push && pnpm db:seed"

# 5. Verify health
curl http://localhost:8080/health
curl http://localhost:8080/health/ready
```

### 5.3 Production `.env` (on-prem)

```bash
NODE_ENV=production
DEPLOYMENT_RUNTIME=on_prem

# Database
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql://truemark:<password>@postgres:5432/truemark

# Redis
REDIS_URL=redis://redis:6379

# Auth (current supported mode)
AUTH_MODE=dev
JWT_SECRET=<openssl-rand-base64-48>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Storage
STORAGE_PROVIDER=minio
MINIO_ACCESS_KEY=<generated>
MINIO_SECRET_KEY=<generated>
MINIO_BUCKET=truemark

# URLs (used in QR links and CORS)
ADMIN_WEB_URL=https://admin.yourcompany.internal
CONSUMER_WEB_URL=https://verify.yourcompany.com
NEXT_PUBLIC_API_URL=https://verify.yourcompany.com
CORS_ORIGINS=https://admin.yourcompany.internal,https://verify.yourcompany.com

# AI (optional)
AI_PROVIDER=mock
# AI_PROVIDER=openai
# AI_API_KEY=sk-...

# Rate limits
RATE_LIMIT_VERIFY_PER_MIN=60
RATE_LIMIT_AI_PER_MIN=10
```

### 5.4 TLS termination

The included nginx listens on port 80. For production:

1. Place TLS certs on the host or use a corporate load balancer in front
2. Terminate TLS at F5 / HAProxy / customer nginx
3. Or extend `infra/docker/nginx/onprem.conf` with `listen 443 ssl` blocks

### 5.5 Backups (required)

Schedule daily:

| What | How |
|------|-----|
| PostgreSQL | `pg_dump` → `/opt/truemark/backups/db/` |
| MinIO | `mc mirror` or volume snapshot |
| Config | Copy `.env`, certs, nginx config |

See [DR Runbook](../runbooks/DR.md) and `scripts/dr-drill-local.sh`.

### 5.6 Monitoring (optional)

```bash
docker compose -f infra/docker/docker-compose.onprem.yml --profile monitoring up -d
# Prometheus :9090, Grafana :3003
```

---

## 6. Azure deployment — full procedure

> **Note:** `infra/terraform/azure/` does **not exist yet**. Azure deployment is manual today using either **VMs + Docker Compose** (simplest) or **AKS + Helm** (production scale).

### 6.1 Azure subscription setup

1. **Create or use a subscription**
   - Azure Portal → Subscriptions → Add
   - Note **Subscription ID**

2. **Create resource groups**

   ```bash
   az group create --name rg-truemark-prod --location eastus
   az group create --name rg-truemark-network --location eastus
   ```

3. **Create a service principal for automation** (CI/CD / Terraform later)

   ```bash
   az ad sp create-for-rbac \
     --name sp-truemark-deploy \
     --role Contributor \
     --scopes /subscriptions/<SUBSCRIPTION_ID>
   ```

   Save `appId`, `password`, `tenant` for pipeline secrets.

### 6.2 Azure resources required

#### Recommended instance specifications (summary)

| Path | Tier | Azure VM / SKU | vCPU | RAM | Disk | Est. monthly cost (USD) |
|------|------|----------------|------|-----|------|-------------------------|
| **A — VM + Compose** | Pilot | `Standard_D4s_v5` | 4 | 16 GB | 128 GB Premium SSD | ~$140–180 |
| **A — VM + Compose** | Production | `Standard_D8s_v5` | 8 | 32 GB | 256 GB Premium SSD | ~$280–350 |
| **A — VM + Compose** | Enterprise | `Standard_D16s_v5` | 16 | 64 GB | 512 GB Premium SSD | ~$560–700 |
| **B — AKS + managed** | Pilot | 2× `Standard_D2s_v5` nodes + Burstable Postgres | — | — | — | ~$400–600 |
| **B — AKS + managed** | Production | 3× `Standard_D4s_v5` + GP Postgres HA + Redis P1 | — | — | — | ~$1,000–1,500 |
| **B — AKS + managed** | Enterprise | 3× `Standard_D8s_v5` + GP Postgres HA + Redis P2 + Front Door | — | — | — | ~$2,000–3,500 |

*Costs are approximate for **East US**; use the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/).*

#### Option A — Simple (VM + Docker Compose)

Best for pilots and single-tenant dedicated deployments. Same sizing as [on-prem](../on-prem/INSTALL.md#recommended-instance-specifications).

| Tier | Azure VM SKU | vCPU | RAM | OS disk | Data disk | When to use |
|------|--------------|------|-----|---------|-----------|-------------|
| Pilot | `Standard_D4s_v5` | 4 | 16 GB | 128 GB Premium SSD | — | UAT, demos |
| **Production** | `Standard_D8s_v5` | 8 | 32 GB | 128 GB Premium SSD | 256 GB Premium SSD | **Default recommendation** |
| Enterprise | `Standard_D16s_v5` | 16 | 64 GB | 128 GB Premium SSD | 512 GB Premium SSD | High volume + AI |

Additional Azure resources (all tiers):

| Resource | Azure service | Recommended SKU |
|----------|---------------|-----------------|
| Compute | Linux VM | See table above |
| Disk | Managed disks | Premium SSD (production); Standard SSD (pilot only) |
| Network | VNet + NSG | `/16` VNet; NSG allow 443 inbound |
| Public IP | Static Standard SKU | For verify domain |
| DNS | Azure DNS zone | Per domain |
| TLS | Key Vault cert or App Gateway | Production: App Gateway WAF_v2 |
| Backup | Azure Backup | Daily VM snapshot; 30-day retention |

**No managed DB required** — Postgres, Redis, and MinIO run in Compose on the VM (same as on-prem).

#### Option B — Production (AKS + managed services)

Best for HA, scale, and separation of concerns.

| Component | Pilot | Production *(recommended)* | Enterprise |
|-----------|-------|--------------------------|------------|
| **AKS nodes** | 2× `Standard_D2s_v5` (2 vCPU, 8 GB each) | 3× `Standard_D4s_v5` (4 vCPU, 16 GB each) | 3–5× `Standard_D8s_v5` (8 vCPU, 32 GB each) |
| **AKS system pool** | Default | 2× `Standard_D2s_v5` (dedicated system node pool) | 3× `Standard_D2s_v5` |
| **PostgreSQL Flexible** | `Burstable_B2s` (2 vCPU, 4 GB), 64 GB | `Standard_D4ds_v4` GP HA, 128 GB | `Standard_D8ds_v4` GP HA, 256–512 GB |
| **Azure Cache for Redis** | Basic C1 (1 GB) | Premium P1 (6 GB, persistence) | Premium P2 (12 GB) or P3 |
| **Blob Storage** | Standard LRS, 100 GB | Standard GRS, 500 GB | Standard GRS + lifecycle, 1 TB+ |
| **ACR** | Basic | Standard | Premium (geo-replication) |
| **Application Gateway** | — | WAF_v2, 1 instance | WAF_v2, autoscale 2–10 |
| **Front Door** (optional) | — | Standard | Premium + WAF |
| **Key Vault** | Standard | Standard + purge protection | Premium HSM keys |
| **Log Analytics** | 5 GB/month ingest | 20 GB/month | 50+ GB/month |

**Pod resource requests** (Helm defaults — adjust per tier):

| Workload | Production request | Enterprise request |
|----------|-------------------|-------------------|
| API (×2 replicas) | 250m CPU, 256 Mi RAM | 500m CPU, 512 Mi RAM |
| Admin web (×2) | 100m CPU, 128 Mi RAM | 200m CPU, 256 Mi RAM |
| Worker (×1) | 250m CPU, 256 Mi RAM | 500m CPU, 512 Mi RAM |

Enable **Horizontal Pod Autoscaler** on API for verify traffic spikes (target CPU 70%, max 10 replicas).

| Resource | Azure service | Purpose |
|----------|---------------|---------|
| **AKS** | Azure Kubernetes Service | Run API, admin, consumer pods |
| **PostgreSQL** | Azure Database for PostgreSQL Flexible Server | v16, HA enabled |
| **Redis** | Azure Cache for Redis | Premium tier for persistence |
| **Storage** | Storage Account (Blob) | QR exports, AI images |
| **Key Vault** | Azure Key Vault | JWT secret, DB URL, AI keys |
| **ACR** | Azure Container Registry | Private Docker images |
| **Ingress** | Application Gateway or NGINX Ingress | TLS termination |
| **Front Door** (optional) | Azure Front Door + WAF | Global CDN, DDoS |
| **Monitor** | Azure Monitor + Log Analytics | Logs, alerts |
| **DNS** | Azure DNS | Verification domains |
| **OpenAI** (optional) | Azure OpenAI | `AI_PROVIDER=azure` |

#### Estimated monthly cost (Option B, rough)

| Tier | Service breakdown | Approx. total (USD/mo) |
|------|-------------------|------------------------|
| **Pilot** | 2× D2s_v5 nodes, Burstable Postgres, Basic Redis, LRS storage | $400–600 |
| **Production** | 3× D4s_v5 nodes, GP Postgres HA, Redis P1, GRS storage, App Gateway | $1,000–1,500 |
| **Enterprise** | 5× D8s_v5 nodes, D8 Postgres HA, Redis P2, Front Door Premium | $2,000–3,500 |

| Service (Production tier) | Approx. cost (USD) |
|---------|-------------------|
| AKS control plane | ~$75 |
| 3× worker nodes (D4s_v5) | ~$400 |
| PostgreSQL Flexible (GP, HA) | ~$200–400 |
| Redis Premium P1 | ~$250 |
| Blob Storage + egress | ~$20–100 |
| Application Gateway WAF_v2 | ~$150–250 |
| Key Vault, Monitor | ~$50 |
| **Total** | **~$1,000–1,500/mo** (varies by region) |

Use [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/) for your region.

### 6.3 Option A — Deploy on Azure VM (step-by-step)

```bash
# 1. Create VNet + VM
az network vnet create -g rg-truemark-prod -n vnet-truemark --address-prefix 10.1.0.0/16 \
  --subnet-name subnet-compute --subnet-prefix 10.1.1.0/24

az vm create \
  --resource-group rg-truemark-prod \
  --name vm-truemark \
  --image Ubuntu2204 \
  --size Standard_D8s_v5 \
  --admin-username azureuser \
  --generate-ssh-keys \
  --vnet-name vnet-truemark \
  --subnet subnet-compute \
  --public-ip-address-dns-name truemark-verify

# 2. SSH to VM and follow on-prem steps (§5.2)
ssh azureuser@truemark-verify.eastus.cloudapp.azure.com
```

Open NSG port 443 (and 22 for SSH during setup only).

Point `verify.yourcompany.com` CNAME to the VM public DNS or Front Door.

### 6.4 Option B — Deploy on AKS (step-by-step)

#### 6.4.1 Create managed services

```bash
# PostgreSQL Flexible Server
az postgres flexible-server create \
  --resource-group rg-truemark-prod \
  --name psql-truemark \
  --location eastus \
  --admin-user truemark_admin \
  --admin-password "<STRONG_PASSWORD>" \
  --sku-name Standard_D4ds_v4 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 16 \
  --high-availability ZoneRedundant

# Redis
az redis create \
  --resource-group rg-truemark-prod \
  --name redis-truemark \
  --location eastus \
  --sku Premium \
  --vm-size P1

# Storage account
az storage account create \
  --name sttruemarkprod \
  --resource-group rg-truemark-prod \
  --location eastus \
  --sku Standard_GRS

# Key Vault
az keyvault create \
  --name kv-truemark-prod \
  --resource-group rg-truemark-prod \
  --location eastus

# Container Registry
az acr create \
  --resource-group rg-truemark-prod \
  --name acrtruemark \
  --sku Standard
```

#### 6.4.2 Create AKS cluster

```bash
az aks create \
  --resource-group rg-truemark-prod \
  --name aks-truemark \
  --node-count 3 \
  --node-vm-size Standard_D4s_v5 \
  --attach-acr acrtruemark \
  --enable-managed-identity \
  --network-plugin azure

az aks get-credentials --resource-group rg-truemark-prod --name aks-truemark
```

#### 6.4.3 Build and push images

```bash
cd /path/to/true-mark
az acr login --name acrtruemark

docker build -f infra/docker/Dockerfile.api -t acrtruemark.azurecr.io/truemark/api:latest .
docker build -f infra/docker/Dockerfile.admin-web -t acrtruemark.azurecr.io/truemark/admin-web:latest .
docker build -f infra/docker/Dockerfile.consumer-web -t acrtruemark.azurecr.io/truemark/consumer-web:latest .

docker push acrtruemark.azurecr.io/truemark/api:latest
docker push acrtruemark.azurecr.io/truemark/admin-web:latest
docker push acrtruemark.azurecr.io/truemark/consumer-web:latest
```

#### 6.4.4 Store secrets in Key Vault

```bash
# Database connection string
az keyvault secret set --vault-name kv-truemark-prod \
  --name DATABASE_URL \
  --value "postgresql://truemark_admin:<password>@psql-truemark.postgres.database.azure.com:5432/truemark?sslmode=require"

az keyvault secret set --vault-name kv-truemark-prod \
  --name JWT-SECRET --value "<openssl-rand-base64-48>"

az keyvault secret set --vault-name kv-truemark-prod \
  --name REDIS-URL --value "rediss://:<key>@redis-truemark.redis.cache.windows.net:6380"
```

Use [Secrets Store CSI driver](https://learn.microsoft.com/azure/aks/csi-secrets-store-driver) to mount Key Vault secrets into pods.

#### 6.4.5 Deploy Helm chart

Create `values-azure-production.yaml`:

```yaml
global:
  environment: production

api:
  image:
    repository: acrtruemark.azurecr.io/truemark/api
    tag: latest
  env:
    AUTH_MODE: dev
    STORAGE_PROVIDER: s3   # wire to Azure Blob via S3-compatible API or extend provider
    AI_PROVIDER: mock

adminWeb:
  image:
    repository: acrtruemark.azurecr.io/truemark/admin-web
  env:
    NEXT_PUBLIC_API_URL: "https://api.yourcompany.com"

ingress:
  className: nginx
  hosts:
    - host: api.yourcompany.com
      paths: [{ path: /, pathType: Prefix, service: api }]
    - host: admin.yourcompany.com
      paths: [{ path: /, pathType: Prefix, service: adminWeb }]

postgresql:
  enabled: false
externalDatabase:
  host: psql-truemark.postgres.database.azure.com
  existingSecret: truemark-db-credentials

redis:
  enabled: false
externalRedis:
  host: redis-truemark.redis.cache.windows.net
  existingSecret: truemark-redis-credentials
```

```bash
# Install ingress controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# Deploy TrueMark
helm upgrade --install truemark infra/helm/truemark \
  -f infra/helm/truemark/values.yaml \
  -f values-azure-production.yaml \
  -n truemark --create-namespace
```

#### 6.4.6 Run database migrations

```bash
kubectl run prisma-migrate --rm -it --restart=Never \
  --image=acrtruemark.azurecr.io/truemark/api:latest \
  --env="DATABASE_URL=..." \
  --command -- sh -c "pnpm db:push && pnpm db:seed"
```

Change seed passwords immediately after first seed in production.

### 6.5 Azure OpenAI (optional AI)

If using AI image validation on Azure:

1. Apply for **Azure OpenAI** access in your subscription
2. Create resource → deploy `gpt-4o` or vision-capable model
3. Store key in Key Vault

```bash
AI_PROVIDER=azure
AI_API_KEY=<azure-openai-key>
AI_MODEL=gpt-4o
# Endpoint often: https://<resource>.openai.azure.com/
```

> Verify `AI_PROVIDER=azure` wiring in `apps/api/src/providers/ai/` matches your deployment endpoint.

### 6.6 Future: Azure Terraform

When `infra/terraform/azure/` is added, it will provision the resources in §6.2 automatically. Until then, use Azure CLI steps above or ARM/Bicep templates you maintain separately.

Planned layout:

```
infra/terraform/azure/
├── main.tf
├── variables.tf
├── outputs.tf
└── modules/
    ├── aks/
    ├── postgresql/
    ├── redis/
    └── storage/
```

**Prerequisites for Terraform (when available):**

| Prerequisite | Action |
|--------------|--------|
| Azure subscription | Active with Contributor role |
| Remote state storage | Storage account + container for `.tfstate` |
| Service principal | `ARM_CLIENT_ID`, `ARM_CLIENT_SECRET`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID` |
| Terraform | ≥ 1.7 installed locally or in CI |

---

## 7. Post-deploy application configuration

After infrastructure is running, configure TrueMark through the Admin portal.

### 7.1 First login

1. Open `ADMIN_WEB_URL` (e.g. `https://admin.yourcompany.internal`)
2. Login with platform admin (change password if using seed data)
3. Confirm API health: `GET /api/v1/health/ready`

### 7.2 Create or configure tenant

| Step | Admin UI | Notes |
|------|----------|-------|
| 1 | **Organizations** → Create tenant | Company name, legal name, country |
| 2 | **Domains** → Add company domain | e.g. `https://www.yourcompany.com` |
| 3 | **Domains** → Add verification domain | e.g. `verify.yourcompany.com` |
| 4 | Complete DNS TXT challenge | Copy record from UI → add in DNS provider |
| 5 | Activate domain | Status → ACTIVE |

### 7.3 Product & QR setup

| Step | Action |
|------|--------|
| 1 | Create **Manufacturer** → **Brand** → **Product** → **Variant** |
| 2 | Create **Batch** with batch code |
| 3 | **Generate units** (sync ≤50, async via queue for larger) |
| 4 | **Generate QR codes** for batch |
| 5 | Download PNG or ZIP export |
| 6 | Print QR codes on product labels |

### 7.4 Test verification

```bash
# Manual code test
curl -X POST https://verify.yourcompany.com/api/v1/public/verify/manual \
  -H "Content-Type: application/json" \
  -H "Host: verify.yourcompany.com" \
  -d '{"code":"TM-XXXX-XXXX-0001","hostname":"verify.yourcompany.com"}'
```

Or scan a printed QR with a phone → should open consumer verify page.

### 7.5 Create production admin users

Until Auth0/OIDC is wired:

```sql
-- Connect to Postgres
-- Users are created via seed or Admin UI (when user management UI exists)
-- For now: update seed passwords or insert users with argon2 password hashes
```

**Action:** Rotate off seed credentials before any real data is loaded.

---

## 8. Environment variable reference

Full schema: `packages/config/src/index.ts`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis for BullMQ |
| `JWT_SECRET` | Yes (dev mode) | — | ≥32 chars; API signing key |
| `AUTH_MODE` | No | `dev` | `dev` or `oidc` *(oidc not implemented)* |
| `STORAGE_PROVIDER` | No | `local` | `local`, `minio`, `s3` |
| `AI_PROVIDER` | No | `mock` | `mock`, `openai`, `azure` |
| `DEPLOYMENT_RUNTIME` | No | `cloud` | `cloud` or `on_prem` |
| `ADMIN_WEB_URL` | No | localhost:3000 | Used in emails/QR metadata |
| `CONSUMER_WEB_URL` | No | localhost:3002 | Consumer base URL |
| `CORS_ORIGINS` | No | localhost | Comma-separated admin/consumer origins |
| `NEXT_PUBLIC_API_URL` | Yes (web) | — | API URL baked into Next.js build |

---

## 9. Production sign-off

Before accepting traffic from real consumers, complete [Production Readiness](../PRODUCTION_READINESS.md):

- [ ] All default passwords rotated
- [ ] `JWT_SECRET` is unique and stored in vault
- [ ] TLS enabled on all public endpoints
- [ ] Backups tested (restore drill)
- [ ] Rate limiting verified (`ThrottlerGuard` active)
- [ ] Tenant isolation tested
- [ ] Verification E2E test on production domain
- [ ] Monitoring and alerting configured
- [ ] Incident contacts documented

---

## 10. Quick reference — what to create where

### On-premises

```
□ Linux server (4+ cores, 16+ GB RAM)
□ Docker + Docker Compose
□ .env with strong secrets
□ DNS: verify + admin hostnames
□ TLS certificates
□ (Optional) Auth0 tenant + apps
□ (Optional) Vault for secrets
□ Backup cron job
□ docker compose up → db:push → db:seed
□ Change seed passwords → configure tenant → test verify
```

### Azure

```
□ Azure subscription
□ Resource group(s)
□ Choose: VM path OR AKS path
□ PostgreSQL + Redis + Blob + Key Vault + ACR (AKS path)
□ VM with Docker (simple path)
□ Build & push container images
□ Helm deploy or docker compose
□ Azure DNS records
□ TLS (App Gateway / Front Door / cert on VM)
□ (Optional) Auth0 or Entra ID for admin SSO
□ (Optional) Azure OpenAI for AI
□ Key Vault secrets → pod env
□ Migrations + seed → change passwords → tenant setup → test verify
```

---

## 11. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| API won't start | Missing `JWT_SECRET` | Set in `.env` or Key Vault |
| `db:push` auth failed | Wrong `DATABASE_URL` | Match Postgres password |
| Admin can't login | Wrong credentials / expired JWT | Reset user password in DB |
| Verify returns domain error | Host header mismatch | DNS + verification domain config |
| QR links wrong URL | `CONSUMER_WEB_URL` incorrect | Update env, rebuild if needed |
| Bulk job stuck | Redis down | Check Redis connectivity |
| CORS errors | `CORS_ORIGINS` missing admin URL | Add origin, restart API |

---

## 12. Related documents

- [On-Prem Runbook](../runbooks/onprem-install.md) — detailed install with hardening
- [Azure Guide](../azure/AZURE.md) — Azure resource mapping
- [Docker Guide](../docker/DOCKER.md) — Compose files and Dockerfiles
- [Helm / Kubernetes](../helm/KUBERNETES.md) — Chart values reference
- [Hybrid Architecture](../architecture/HYBRID.md) — On-prem core + cloud AI
- [Code Review](../CODE_REVIEW.md) — Known gaps (OIDC, etc.)
