# TrueMark Code Review

> Review date: August 2026  
> Scope: full monorepo (`apps/`, `packages/`, `infra/`, `docs/`)  
> Focus: security, correctness, modularity, standards, documentation hygiene

---

## Executive summary

TrueMark is a well-structured modular monorepo (NestJS API, Next.js admin/consumer apps, Prisma DB, shared packages, Docker/Helm/Terraform). Core verification, tenant isolation, audit logging, and job processing follow sound patterns.

This review identified **4 critical/high security issues** and **several functional gaps**. Critical items were **remediated in code** during this review; remaining items are documented as backlog.

| Severity | Found | Fixed in review | Open |
| -------- | ----- | --------------- | ---- |
| Critical | 2     | 2               | 0    |
| High     | 4     | 3               | 1    |
| Medium   | 8     | 2               | 6    |
| Low      | 6     | 1               | 5    |

---

## Architecture assessment

### Strengths

- **Clear module boundaries** in `apps/api/src/modules/*` — each domain (auth, product, qr, verification, fraud, ai) has controller/service/module separation.
- **Tenant scoping** via `TenantGuard` and `tenantId` filters on Prisma queries reduces cross-tenant data leakage risk.
- **Provider abstraction** (`providers/`) for AI, storage, and secrets supports mock/local/minio implementations.
- **Async bulk jobs** via BullMQ for large unit generation; sync path for small batches.
- **Audit trail** on mutating operations through `AuditService`.
- **Documentation hub** at `docs/README.md` with categorized guides for web, API, deployment, and architecture.

### Areas for improvement

- **`@truemark/shared` underused** — Zod schemas and enums exist but API DTOs are mostly inline classes; consider aligning validation at API boundaries.
- **`AUTH_MODE=oidc` in config** is accepted but not implemented; document as future work or remove from schema until ready.
- **Web linting** — admin/consumer apps lack ESLint config; `pnpm lint` prompts interactively.
- **Hybrid boundary errors** — `HybridBoundaryService` throws plain `Error` instead of Nest HTTP exceptions (medium priority).

---

## Security findings

### Critical — fixed

| ID     | Issue                                                                                                      | Location                                    | Remediation                                       |
| ------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| SEC-01 | `ThrottlerModule` registered but **`ThrottlerGuard` not applied** — all `@Throttle` decorators were no-ops | `apps/api/src/app.module.ts`                | Registered `APP_GUARD` with `ThrottlerGuard`      |
| SEC-02 | **JWT fallback secret** allowed auth with a known default key                                              | `apps/api/src/modules/auth/jwt.strategy.ts` | Fail fast at bootstrap if `JWT_SECRET` is missing |

### High — fixed

| ID     | Issue                                                      | Location                         | Remediation                               |
| ------ | ---------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| SEC-03 | AI image upload **500 on missing file** (`file` undefined) | `ai-orchestration.controller.ts` | `BadRequestException` when buffer missing |
| SEC-04 | AI `process` / `status` endpoints **not rate-limited**     | `ai-orchestration.controller.ts` | Added `@Throttle` on both routes          |
| SEC-05 | Admin login page **pre-filled dev credentials**            | `admin-web/.../login/page.tsx`   | Empty default form values                 |

### High — open

| ID     | Issue                                                         | Recommendation                                                                                            |
| ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| SEC-06 | `AUTH_MODE=oidc` documented/validated but **not implemented** | Implement OIDC strategy or restrict config enum to `dev` until ready; update `docs/api/AUTHENTICATION.md` |

### Medium — security hygiene

| ID     | Issue                                                  | Recommendation                                        |
| ------ | ------------------------------------------------------ | ----------------------------------------------------- |
| SEC-07 | Refresh tokens stored in `localStorage` (XSS surface)  | Prefer `httpOnly` secure cookies for production admin |
| SEC-08 | No CSRF protection on cookie-based auth (if adopted)   | Add CSRF tokens with cookie sessions                  |
| SEC-09 | Public verification endpoints rely on rate limits only | Add CAPTCHA or progressive backoff under abuse        |
| SEC-10 | Secrets in `.env` without rotation docs                | Document rotation in `PRODUCTION_READINESS.md`        |

See also [`THREAT_MODEL.md`](./THREAT_MODEL.md) for STRIDE analysis.

---

## Functional bugs

### Fixed

| ID     | Issue                                                               | Location                   | Remediation                                              |
| ------ | ------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| BUG-01 | Sync unit generation (≤50 units) **skipped QR creation**            | `product.service.ts`       | Call `qrService.generateMissingForBatch` after sync path |
| BUG-02 | **JWT expiry mismatch** — service default `1h`, module default `8h` | `auth.module.ts`           | Aligned module default to `1h`                           |
| BUG-03 | Admin API client **no token refresh on 401**                        | `admin-web/src/lib/api.ts` | Refresh-and-retry once via `/admin/auth/refresh`         |

### Open

| ID     | Issue                                                               | Location                 | Recommendation                              |
| ------ | ------------------------------------------------------------------- | ------------------------ | ------------------------------------------- |
| BUG-04 | QR customization `version` always `1` in `getCustomizationConfig()` | `qr.service.ts`          | Return actual config version from DB        |
| BUG-05 | `RolesGuard` returns `false` when user missing (403 vs 401)         | `roles.guard.ts`         | Throw `UnauthorizedException` when `!user`  |
| BUG-06 | Consumer report UI not wired                                        | `consumer-web`           | Implement or mark stub in docs              |
| BUG-07 | Admin settings page is placeholder                                  | `admin-web/.../settings` | Implement tenant config UI or hide nav item |

---

## Modularity & standards

### API (NestJS)

| Check               | Status | Notes                                           |
| ------------------- | ------ | ----------------------------------------------- |
| Module per domain   | ✅     | 15+ feature modules                             |
| Guards & decorators | ✅     | JWT, roles, tenant                              |
| DTO validation      | ⚠️     | Class-validator used; shared Zod schemas unused |
| Error handling      | ⚠️     | Some services throw raw `Error`                 |
| Unit tests          | ✅     | 70+ tests across 15 suites                      |
| OpenAPI             | ✅     | Swagger + `docs/api/openapi.yaml`               |

### Web (Next.js)

| Check                     | Status | Notes                                        |
| ------------------------- | ------ | -------------------------------------------- |
| App router structure      | ✅     | Clear page-per-feature                       |
| API client centralization | ✅     | `lib/api.ts`                                 |
| Auth persistence          | ✅     | localStorage + refresh retry                 |
| ESLint / Prettier         | ⚠️     | Prettier at root; ESLint missing on web apps |
| Shared package usage      | ⚠️     | Declared but rarely imported                 |

### Database (Prisma)

| Check                | Status | Notes                          |
| -------------------- | ------ | ------------------------------ |
| Multi-tenant indexes | ✅     | `tenantId` on scoped tables    |
| Migrations workflow  | ✅     | `db:push` / migrate documented |
| Seed data            | ✅     | Dev admin + E2E fixtures       |

### Infrastructure

| Check                     | Status | Notes                                                     |
| ------------------------- | ------ | --------------------------------------------------------- |
| Docker multi-stage builds | ✅     | API, admin, consumer                                      |
| Helm chart                | ✅     | Deployments, services, ingress                            |
| Terraform AWS             | ✅     | VPC, RDS, Redis, S3, EKS skeleton                         |
| Azure                     | 📋     | Planned only (`docs/azure/AZURE.md`)                      |
| Monitoring                | ⚠️     | Prometheus config present; no app metrics export verified |

---

## Performance & optimization

| Area                  | Assessment                                                                 |
| --------------------- | -------------------------------------------------------------------------- |
| Verification hot path | DB lookups indexed; no N+1 in core verify flow                             |
| Bulk generation       | Async queue for >50 units — appropriate                                    |
| QR PNG generation     | `sharp` for logo overlay — efficient                                       |
| Admin list endpoints  | Pagination present on history/fraud; audit list may need limits at scale   |
| Redis / BullMQ        | Required for async jobs; graceful degradation not documented if Redis down |

**Recommendations:** Add query limits on audit log API; export Prometheus metrics from NestJS; load-test verify endpoint (`scripts/load-test-verify.mjs` exists).

---

## Documentation review

### Kept (canonical)

| Category        | Files                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Hub             | `docs/README.md`                                                           |
| Web             | `docs/web/ADMIN_WEB.md`, `CONSUMER_WEB.md`                                 |
| API             | `docs/api/API_REFERENCE.md`, `AUTHENTICATION.md`, `openapi.yaml`           |
| Database        | `docs/database/DATABASE.md`                                                |
| Deployment      | `docs/deployment/`, `docker/`, `helm/`, `terraform/`, `on-prem/`, `azure/` |
| Architecture    | `docs/architecture/*.md`                                                   |
| Operations      | `docs/runbooks/*`, `THREAT_MODEL.md`, `PRODUCTION_READINESS.md`            |
| **This review** | `CODE_REVIEW.md`                                                           |

### Removed (redundant)

| File                                  | Reason                                                 |
| ------------------------------------- | ------------------------------------------------------ |
| `docs/PHASE2_COMPLETION.md`           | Obsolete session artifact                              |
| `docs/FINAL_IMPLEMENTATION_REPORT.md` | Duplicated completion summary                          |
| `docs/IMPLEMENTATION_PLAN.md`         | Historical build plan; superseded by architecture docs |
| `docs/IMPLEMENTATION_STATUS.md`       | Phase tracker; platform complete (phases 0–15)         |

---

## Remediation checklist (production)

Before production deploy, complete:

- [ ] Set strong `JWT_SECRET` (≥32 chars) and rotate policy
- [ ] Confirm `ThrottlerGuard` limits match expected traffic (`verify`, `ai`, `default` buckets)
- [ ] Remove or implement `AUTH_MODE=oidc`
- [ ] Move admin tokens to `httpOnly` cookies (or accept XSS risk with CSP hardening)
- [ ] Run `pnpm --filter @truemark/api test` and E2E suite green in CI
- [ ] Penetration test public verify + auth endpoints
- [ ] Enable DB backups and test DR runbook (`docs/runbooks/DR.md`)
- [ ] Add ESLint config to web apps for CI lint gate

---

## Test validation

After remediations, run:

```bash
pnpm --filter @truemark/api test
NODE_ENV=production pnpm --filter @truemark/admin-web build
```

---

## Related documents

- [Threat Model](./THREAT_MODEL.md)
- [Production Readiness](./PRODUCTION_READINESS.md)
- [System Architecture](./architecture/SYSTEM.md)
