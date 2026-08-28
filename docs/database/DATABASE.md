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
| Platform | `tenants`, `tenant_profiles`, `users`, `user_tenant_roles`, `refresh_tokens` |
| Domains | `company_domains`, `verification_domains` |
| Products | `manufacturers`, `brands`, `products`, `product_variants`, `batches`, `product_units`, `serials` |
| Credentials | `verification_credentials`, `qr_codes`, `qr_lifecycle_events` |
| Verification | `verification_events`, `fraud_signals` |
| AI | `ai_configs`, `ai_jobs`, `ai_images`, `ai_visual_results`, `ai_ocr_results` |
| Operations | `audit_logs`, `investigations`, `analytics_daily`, `bulk_jobs`, `consumer_reports` |

## Seed data

`packages/db/prisma/seed.ts` creates:

- Platform admin: `admin@truemark.local`
- Demo tenant: **ABC Pharmaceuticals**
- Verification domain: `verify.localhost`
- Sample product batch with 3 units + E2E fixture

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

## Backup & restore

- **Cloud:** RDS automated backups — see [DR Runbook](../runbooks/DR.md)
- **On-prem:** `pg_dump` schedule — see [On-Prem Install](../on-prem/INSTALL.md)
- **Local drill:** `pnpm dr-drill` (requires `DATABASE_URL`)

## Integrity rules

- Verification events are **append-only** (no delete in application code)
- Tenant isolation enforced at application layer + foreign keys
- Credentials stored as Argon2 hashes; QR tokens in `qr_codes` table

## Related docs

- [Infrastructure](../infrastructure/INFRASTRUCTURE.md)
- [On-Prem Install](../on-prem/INSTALL.md)
- [DR Runbook](../runbooks/DR.md)
