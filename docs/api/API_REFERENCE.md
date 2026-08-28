# API Reference

> NestJS REST API — modular monolith at `apps/api`.

## Base URLs

| Environment | Base URL |
|-------------|----------|
| Local dev | `http://localhost:3001/api/v1` |
| Production | `https://api.<your-domain>/api/v1` |

## Interactive documentation

When the API is running:

- **Swagger UI:** http://localhost:3001/api/docs
- **OpenAPI YAML:** [openapi.yaml](./openapi.yaml)

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Liveness |
| GET | `/health/ready` | Public | Readiness (DB, hybrid gateway) |

## Public verification (no auth)

| Method | Path | Rate limit | Description |
|--------|------|------------|-------------|
| POST | `/public/verify/qr` | 60/min | Verify by QR URL |
| POST | `/public/verify/code` | 60/min | Verify by manual code |
| POST | `/public/reports` | 10/min | Consumer suspicious-product report |
| POST | `/public/verify/ai/initiate` | 10/min | Start optional AI job |
| POST | `/public/verify/ai/:jobId/images` | 10/min | Upload capture image |
| POST | `/public/verify/ai/:jobId/process` | 10/min | Run AI analysis |
| GET | `/public/verify/ai/:jobId/status` | — | AI job status |

### Verify QR — example

```bash
curl -X POST http://localhost:3001/api/v1/public/verify/qr \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://verify.localhost/v/e2eFixedQrToken0001",
    "hostname": "verify.localhost"
  }'
```

### Response shape (verification)

```json
{
  "result": "VERIFIED",
  "message": "...",
  "riskLevel": "LOW",
  "verificationPublicId": "uuid",
  "aiAvailable": true,
  "aiMode": "AI_OPTIONAL",
  "product": {
    "name": "ABC Shampoo 500ml",
    "brand": "ABC Pharma",
    "manufacturer": "ABC Pharmaceuticals",
    "batch": "BATCH-2026-08",
    "serial": "SN-E2E-000001"
  }
}
```

Internal tenant IDs are **never** returned on public endpoints.

## Admin API (JWT required)

All admin routes require `Authorization: Bearer <accessToken>` unless marked public.

Prefix: `/admin/...`

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/auth/login` | Login (returns access + refresh token) |
| POST | `/admin/auth/refresh` | Rotate refresh token |
| POST | `/admin/auth/logout` | Revoke refresh token |
| GET | `/admin/auth/me` | Current user + roles |

### Tenant-scoped resources

Prefix: `/admin/tenants/:tenantId/`

| Area | Paths | Roles |
|------|-------|-------|
| Tenants | `/admin/tenants` | PLATFORM_ADMIN |
| Domains | `.../domains/*` | TENANT_ADMIN |
| Products | `.../products/*`, `.../batches/*` | PRODUCT_MANAGER |
| QR | `.../qr/*` | PRODUCT_MANAGER |
| QR customization | `.../qr-customization` | TENANT_ADMIN |
| Verification history | `.../verification-history` | ANALYST+ |
| AI config | `.../ai-config`, `.../reference-data` | TENANT_ADMIN |
| Fraud | `.../fraud/signals`, `summary`, `alerts`, `hotspots` | FRAUD_INVESTIGATOR |
| Investigations | `.../investigations` | FRAUD_INVESTIGATOR |
| Analytics | `.../analytics/dashboard`, `daily`, `rollup` | ANALYST |
| Audit | `.../audit` | TENANT_ADMIN, READ_ONLY |

## Headers

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <jwt>` for admin routes |
| `x-correlation-id` | Optional; echoed in logs and responses |

## Error responses

Validation errors return HTTP 400 with NestJS validation message array.

Auth failures return HTTP 401. Cross-tenant access returns HTTP 403.

## Modules (code map)

| Module | Path |
|--------|------|
| Auth | `apps/api/src/modules/auth/` |
| Tenant | `apps/api/src/modules/tenant/` |
| Domain | `apps/api/src/modules/domain/` |
| Product | `apps/api/src/modules/product/` |
| QR | `apps/api/src/modules/qr/` |
| Verification | `apps/api/src/modules/verification/` |
| AI | `apps/api/src/modules/ai-config/`, `ai-orchestration/` |
| Fraud | `apps/api/src/modules/fraud/` |
| Analytics | `apps/api/src/modules/analytics/` |
| Hybrid | `apps/api/src/modules/hybrid/` |

## Related docs

- [Authentication](./AUTHENTICATION.md)
- [Core Verification](../architecture/CORE_VERIFICATION.md)
- [Database](../database/DATABASE.md)
