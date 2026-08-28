# Multi-Tenant Roles, Product Catalog & Licensing

> Implementation reference for Super Admin / Tenant Admin separation, product hierarchy, deployment models, and license lifecycle.

## 1. User roles

### Super Admin (Product Owner)

Mapped to `PLATFORM_ADMIN` in the database.

- Manage all onboarded organizations/tenants
- View platform-wide statistics (tenants, categories, product types, variants, tags)
- Drill into any tenant’s catalog breakdown
- View license status, validity, expiry, and renewal information
- Enable/disable tenants and change deployment type
- Generate and renew licenses (signing keys under product owner control only)

**API:** `GET /api/v1/admin/platform/overview`  
**UI:** Organizations page — platform stat cards + per-tenant catalog drill-down

### Tenant Admin (Organization)

Mapped to `TENANT_ADMIN`.

- Manage only their own organization (tenant-scoped via `TenantGuard`)
- View organization dashboard and catalog statistics
- Create categories, product types, variants (with tags), batches, and units
- Cannot access other tenants or Super Admin endpoints

**API:** `GET /api/v1/admin/tenants/:tenantId/catalog-stats`  
**UI:** Products page, Settings, Dashboard

### Tenant isolation

- All catalog tables include `tenant_id` with foreign keys to `tenants`
- `TenantGuard` enforces JWT `tenantIds` on `:tenantId` routes
- `PLATFORM_ADMIN` bypasses tenant scope for cross-tenant operations

---

## 2. Deployment model

| Model | `DeploymentType` | Description |
|-------|------------------|-------------|
| Multi-tenant SaaS | `SAAS` | Product owner hosts shared infrastructure; each org is a separate tenant |
| Dedicated cloud | `DEDICATED_CLOUD` | Isolated stack (TrueMark or partner cloud) |
| Customer cloud | `CUSTOMER_CLOUD` | Deployed in customer cloud account |
| On-premises | `ON_PREM` | Full stack in customer datacenter |
| Hybrid | `HYBRID` | On-prem core + optional cloud AI |

Dedicated deployments use a single `license.truemark` at the application root. SaaS uses `licenses/{tenantId}.truemark` per tenant.

See [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md).

---

## 3. Commercial model

| Model | Enum | Description |
|-------|------|-------------|
| Full Product (X + N) | `FULL_PRODUCT` | License the complete product for a defined validity period |
| Managed Service (N) | `MANAGED_SERVICE` | Managed service with defined service/license validity |

Both models share the same validation, expiry warnings (30/15/7 days), 15-day grace period, and renewal flow.

---

## 4. License management

### Onboarding

When a Super Admin creates a tenant:

1. A unique **Ed25519-signed**, **AES-256-GCM encrypted backup** license is generated
2. License payload includes: organization, tenant ID, instance ID, deployment model, commercial model, issue/expiry dates, product owner contact
3. File written to application root (`licenses/{tenantId}.truemark` or `license.truemark`)
4. Encrypted backup stored in `tenant_licenses` table

### Validation lifecycle

| Phase | Behavior |
|-------|----------|
| Active | Normal operation |
| 30 / 15 / 7 days before expiry | Warning banner in admin UI |
| After expiry | 15-day grace period + renewal popup |
| After grace | **License Renewal Required** block screen |
| Renewed | Application restored |

- Daily validation via `LicenseSchedulerService` (startup + every 24h)
- `LicenseGuard` blocks protected API routes when `BLOCKED` or `MISSING`
- Only `PLATFORM_ADMIN` can generate/renew via platform license endpoints

**Env vars:** `LICENSE_SIGNING_PRIVATE_KEY` (product owner only), `LICENSE_SIGNING_PUBLIC_KEY`, `LICENSE_BACKUP_KEY`, `INSTALLATION_ID`, `LICENSE_DIR`, `PRODUCT_OWNER_EMAIL`, `PRODUCT_OWNER_PHONE`

---

## 5. Product structure

```
Category
 └── Product Type
        └── Individual Product / Variant
               └── Batch
                      └── Product Unit (QR / serial)
```

### Example

```
Category: Personal Care
├── Product Type: Shampoo A
│   ├── Shampoo A 100ml  (code: TM-…, tags: SH-A, SH-A-100)
│   └── Shampoo A 200ml  (tags: SH-A, SH-A-200)
└── Product Type: Shampoo B
    ├── Shampoo B 100ml
    └── Shampoo B 500ml
```

### Product codes & tags

- Each variant receives a **system-generated** `product_code` (format `TM-XXXXXXXX`, unique per tenant)
- Variants support **multiple tags** for search/filter (size, model, brand, batch, custom attributes)
- Filter variants: `GET /admin/tenants/:tenantId/variants?tag=SH-A`

---

## 6. Database tables

| Table | Purpose |
|-------|---------|
| `categories` | Top-level tenant catalog grouping |
| `product_types` | Product line under a category |
| `product_variants` | Individual SKU/variant with `product_code` |
| `tags` | Tenant-scoped tag dictionary |
| `product_variant_tags` | Many-to-many variant ↔ tag |
| `batches` | Manufacturing batch under a variant |
| `product_units` | Traceable unit with serial + QR |
| `tenant_licenses` | Encrypted license backup + metadata |

Full DDL: `packages/db/prisma/schema.prisma` — see [Database Guide](../database/DATABASE.md).

---

## 7. Key API endpoints

| Endpoint | Role | Description |
|----------|------|-------------|
| `POST /admin/tenants` | Platform Admin | Create tenant + issue license |
| `GET /admin/platform/overview` | Platform Admin | Platform-wide catalog stats |
| `GET /admin/tenants/:id/catalog-stats` | Platform/Tenant Admin | Tenant catalog breakdown |
| `POST /admin/tenants/:id/categories` | Tenant Admin+ | Create category |
| `POST /admin/tenants/:id/product-types` | Tenant Admin+ | Create product type |
| `POST /admin/tenants/:id/variants` | Tenant Admin+ | Create variant (auto product code) |
| `GET /admin/tenants/:id/variants?tag=` | Read roles | Filter by tag |
| `GET /admin/tenants/:id/license/status` | Tenant users | License status for UI banners |
| `POST /admin/platform/licenses/:id/renew` | Platform Admin | Renew license |

---

## Related docs

- [Authentication & Roles](../api/AUTHENTICATION.md)
- [Database Guide](../database/DATABASE.md)
- [Deployment Overview](../deployment/DEPLOYMENT_OVERVIEW.md)
- [Admin Web](../web/ADMIN_WEB.md)
