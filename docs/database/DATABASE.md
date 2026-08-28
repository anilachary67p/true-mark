# Database Guide

> PostgreSQL 16 with Prisma ORM — schema at `packages/db/prisma/schema.prisma`.

## Overview

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 16 |
| ORM | Prisma 6 |
| Package | `@truemark/db` |
| Migrations | `packages/db/prisma/migrations/` (or `db push` for dev) |

## Connection

Set in root `.env`:

```bash
DATABASE_URL=postgresql://truemark:truemark_dev@localhost:5432/truemark?schema=public
```

**Note:** Password must match your Postgres instance. Docker Compose (`infra/docker/docker-compose.yml`) uses `truemark_dev`.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to DB (development) |
| `pnpm db:migrate` | Create/apply migrations (production) |
| `pnpm db:seed` | Idempotent demo seed |

Run from repository root.

## Schema domains

| Domain | Key tables |
|--------|------------|
| Platform | `tenants`, `tenant_profiles`, `tenant_licenses`, `users`, `user_tenant_roles`, `refresh_tokens` |
| Domains | `company_domains`, `verification_domains` |
| Product catalog | `categories`, `product_types`, `product_variants`, `tags`, `product_variant_tags` |
| Traceability | `batches`, `product_units`, `serials` |
| Credentials | `verification_credentials`, `qr_codes`, `qr_lifecycle_events` |
| Verification | `verification_events`, `fraud_signals` |
| AI | `ai_configs`, `ai_jobs`, `ai_images`, `ai_visual_results`, `ai_ocr_results` |
| Operations | `audit_logs`, `investigations`, `analytics_daily`, `bulk_jobs`, `consumer_reports` |

## Product catalog DDL (conceptual)

```sql
-- Category → Product Type → Variant hierarchy (all tenant-scoped)

CREATE TABLE categories (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, name)
);

CREATE TABLE product_types (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, category_id, name)
);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_type_id UUID NOT NULL REFERENCES product_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  product_code TEXT NOT NULL,  -- system-generated, unique per tenant
  status TEXT NOT NULL DEFAULT 'DRAFT',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, product_code)
);

CREATE TABLE tags (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE product_variant_tags (
  product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_variant_id, tag_id)
);

CREATE TABLE tenant_licenses (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  license_id TEXT NOT NULL UNIQUE,
  organization_name TEXT NOT NULL,
  deployment_model TEXT NOT NULL,
  commercial_model TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  product_owner_email TEXT NOT NULL,
  product_owner_phone TEXT,
  license_file TEXT NOT NULL,
  encrypted_backup TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL
);
```

Authoritative definitions: `packages/db/prisma/schema.prisma`.

## Seed data

`packages/db/prisma/seed.ts` creates:

- Platform admin (Super Admin): `admin@truemark.local`
- Demo tenant: **PureGlow Personal Care**
- Category **Personal Care** → Product type **Shampoo A** → variants with tags (`SH-A`, `SH-A-100`, etc.)
- Signed tenant license
- Verification domain: `verify.localhost`
- Sample batch with 3 units + E2E fixture

Password for all seed users: `Admin123!@#`

### E2E fixture (deterministic)

| Field | Value |
|-------|-------|
| Manual code | `TM-E2E0-FIXD-0001` |
| QR token | `e2eFixedQrToken0001` |

## Migrations strategy

| Environment | Approach |
|-------------|----------|
| Local dev | `pnpm db:push` (fast iteration) |
| Staging/Prod | `pnpm db:migrate` with reviewed migration files |
| On-prem | Run migrate in API container init or CI job before deploy |

**Breaking change (catalog refactor):** `manufacturers`, `brands`, and `products` tables were replaced by `categories`, `product_types`, and tagged `product_variants`. Run `pnpm db:push` and `pnpm db:seed` on existing dev databases.

## Backup & restore

- **Cloud:** RDS automated backups — see [DR Runbook](../runbooks/DR.md)
- **On-prem:** `pg_dump` schedule — see [On-Prem Install](../on-prem/INSTALL.md)
- **Local drill:** `pnpm dr-drill` (requires `DATABASE_URL`)

## Integrity rules

- Verification events are **append-only** (no delete in application code)
- Tenant isolation enforced at application layer + foreign keys
- `product_code` is unique per tenant and assigned at variant creation
- Credentials stored as Argon2 hashes; QR tokens in `qr_codes` table
- License files are signed; encrypted backup stored in `tenant_licenses`

## Related docs

- [Multi-Tenant Roles & Licensing](../architecture/MULTI_TENANT_ROLES_LICENSING.md)
- [Infrastructure](../infrastructure/INFRASTRUCTURE.md)
- [On-Prem Install](../on-prem/INSTALL.md)
- [DR Runbook](../runbooks/DR.md)
