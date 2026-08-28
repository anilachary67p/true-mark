# Admin Web

> Next.js 15 admin portal for tenant operators, product managers, and fraud investigators.

## Overview

| Property | Value |
|----------|-------|
| App path | `apps/admin-web` |
| Package | `@truemark/admin-web` |
| Default URL | http://localhost:3000 |
| Framework | Next.js App Router, React 19 |

## Pages

| Route | Purpose |
|-------|---------|
| `/login` | Email/password sign-in |
| `/dashboard` | Verification metrics summary |
| `/organizations` | Tenant CRUD (platform admin) |
| `/domains` | Company + verification domains |
| `/products` | Product hierarchy, batches, unit generation |
| `/qr-codes` | QR list, batch generate/export (PNG/ZIP) |
| `/qr-customization` | Colors, size, logo overlay config |
| `/verification-history` | Past verification events |
| `/ai-detection` | AI mode, quota, reference images |
| `/fraud-intelligence` | Risk score, signals, alerts |
| `/investigations` | Fraud case workflow |
| `/analytics` | Daily rollups dashboard |
| `/audit-log` | Admin action audit trail |
| `/settings` | Tenant settings *(stub)* |

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | API base URL (no `/api/v1` suffix) |

Build-time only (baked into client bundle):

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_VERIFY_HOSTNAME` | Hostname sent to public verify API (use `verify.localhost` for local seed) |

## Development

```bash
# From repo root
pnpm --filter @truemark/admin-web dev
```

Build for production:

```bash
NODE_ENV=production pnpm --filter @truemark/admin-web build
pnpm --filter @truemark/admin-web start
```

## Authentication

- Login via `POST /api/v1/admin/auth/login`
- JWT stored in `localStorage` as `truemark_token`
- Refresh token stored as `truemark_refresh_token`
- All tenant-scoped calls use paths like `/api/v1/admin/tenants/:tenantId/...`
- Tenant ID selected via `useTenantId()` hook (first tenant from `/admin/auth/me`)

Default seed credentials (after `pnpm db:seed`):

- `admin@truemark.local` / `Admin123!@#` (platform admin)
- `tenant-admin@abcpharma.com` / `Admin123!@#` (tenant admin)

## API client

All HTTP calls go through `apps/admin-web/src/lib/api.ts`.

## Related docs

- [API Reference](../api/API_REFERENCE.md)
- [Authentication](../api/AUTHENTICATION.md)
- [Tenant & Domain](../architecture/TENANT_DOMAIN.md)
