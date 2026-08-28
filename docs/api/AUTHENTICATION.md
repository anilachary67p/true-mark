# Authentication & Authorization

## Modes

| `AUTH_MODE` | Use case |
|-------------|----------|
| `dev` | Local development — email/password + JWT (`JWT_SECRET` required) |
| `oidc` | Production SaaS — OIDC issuer validation *(configure `OIDC_*` env vars)* |

## JWT access tokens

- Signed with `JWT_SECRET` (dev) or OIDC issuer keys
- Default expiry: **1 hour** (`JWT_EXPIRES_IN`)
- Payload: `sub` (user id), `email`, `roles[]`, `tenantIds[]`

## Refresh tokens

- Issued on login alongside access token
- Stored server-side in `refresh_tokens` table (SHA-256 hash)
- Default expiry: **7 days** (`JWT_REFRESH_EXPIRES_IN`)
- Rotated on each `POST /admin/auth/refresh` call
- Revoked on `POST /admin/auth/logout`

## Login rate limiting

`POST /admin/auth/login` is limited to **10 requests/minute** per IP.

## Roles

| Role | Scope |
|------|-------|
| `PLATFORM_ADMIN` | All tenants, create tenants |
| `TENANT_ADMIN` | Single tenant configuration |
| `MANUFACTURER_ADMIN` | Manufacturer scope |
| `PRODUCT_MANAGER` | Products, QR, batches |
| `FRAUD_INVESTIGATOR` | Fraud, investigations |
| `ANALYST` | Read analytics, verification history |
| `READ_ONLY` | Read-only tenant access |

## Tenant isolation

- `TenantGuard` enforces `:tenantId` path parameter matches JWT `tenantIds` (or platform admin)
- Never trust client-supplied tenant headers on admin or AI routes
- AI initiate derives tenant from verification event public ID

## Public endpoints

These require **no** authentication:

- `/health`, `/health/ready`
- `/public/verify/*`
- `/public/reports`
- `/admin/auth/login`, `/refresh`, `/logout`

## Related docs

- [API Reference](./API_REFERENCE.md)
- [Threat Model](../THREAT_MODEL.md)
- [Admin Web](../web/ADMIN_WEB.md)
