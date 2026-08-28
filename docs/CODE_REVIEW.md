# TrueMark Code Review

> Review date: August 2026 (updated — full codebase + docs pass)  
> Scope: full monorepo (`apps/`, `packages/`, `infra/`, `docs/`)  
> Focus: security, correctness, modularity, standards, documentation hygiene

---

## Executive summary

TrueMark is a well-structured modular monorepo (NestJS API, Next.js admin/consumer apps, Prisma DB, shared packages, Docker/Helm/Terraform). Core verification, tenant isolation, audit logging, and job processing follow sound patterns.

**Validation run (latest pass):**

| Check | Result |
|-------|--------|
| API unit tests | ✅ 70/70 (15 suites) |
| API build | ✅ Pass |
| Admin web build | ✅ Pass (15 routes) |
| Consumer web build | ✅ Pass |
| Monorepo `pnpm lint` | ❌ Fails — web apps lack ESLint config |
| E2E in CI | Configured (Playwright + load test + DR drill) |

Earlier critical fixes (ThrottlerGuard, JWT secret, sync QR, token refresh) are in place. This pass found **new infra/doc drift** (health probe paths, OIDC defaults, rate-limit env vars) plus test and UI gaps.

| Severity | Found (total) | Fixed earlier | Open |
| -------- | ------------- | ------------- | ---- |
| Critical | 3             | 2             | 1    |
| High     | 8             | 3             | 5    |
| Medium   | 14            | 2             | 12   |
| Low      | 9             | 1             | 8    |

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
| SEC-06 | `AUTH_MODE=oidc` documented/validated but **not implemented** | Implement OIDC strategy or change Helm/runbook defaults to `AUTH_MODE=dev` until ready                    |
| SEC-11 | **Health probe paths wrong in infra** — API serves `/api/v1/health` but Helm/compose/nginx use `/health` | Fix `infra/helm/truemark/values.yaml`, `docker-compose.onprem.yml`, `nginx/onprem.conf`, `prometheus.yml` |
| SEC-12 | **`RATE_LIMIT_*` env vars never read** — limits hardcoded in `app.module.ts` | Wire config into `ThrottlerModule.forRoot()` or remove from env schema/docs                               |
| SEC-13 | **CI lint gate fails** — admin/consumer web apps prompt for ESLint setup | Add `.eslintrc` to web apps so `.github/workflows/ci.yml` lint step passes                              |
| SEC-14 | **Logout endpoint unthrottled** | Add `@Throttle` to `POST /admin/auth/logout`                                                            |

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
| BUG-08 | Fraud hotspots API unused in admin UI                               | `fraud-intelligence/page.tsx` | Wire `api.getFraudHotspots()` or remove API |
| BUG-09 | Readiness check omits Redis despite docs claiming DB+Redis          | `health.controller.ts`     | Add Redis ping to `/health/ready` or fix docs |
| BUG-10 | `TenantId` decorator falls back to first JWT tenant if unset        | `current-user.decorator.ts` | Require explicit tenant or throw |

---

## Feature completeness

### Admin pages (15 routes)

| Route | Status | Notes |
|-------|--------|-------|
| `/login`, `/dashboard`, `/organizations`, `/domains` | ✅ Complete | |
| `/products`, `/qr-codes`, `/qr-customization` | ✅ Complete | Full product hierarchy + QR export |
| `/verification-history`, `/audit-log`, `/analytics` | ✅ Complete | |
| `/ai-detection` | ✅ Complete | AI mode, quota, reference images |
| `/fraud-intelligence` | ⚠️ Partial | Summary/signals/alerts — no hotspots UI |
| `/investigations` | ⚠️ Partial | Create/list/status only |
| `/settings` | ❌ Stub | Placeholder text only |

**Admin gaps:** No tenant switcher (except `?tenantId=` on domains); no role-based nav hiding.

### Consumer web (2 routes)

| Route | Status | Notes |
|-------|--------|-------|
| `/`, `/verify` | ✅ Complete | QR + manual code + AI capture panel |
| Consumer report | ❌ Missing | `POST /public/reports` API exists; no UI |

### API module test coverage

| Module | Has `.spec.ts`? |
|--------|-----------------|
| auth, domain, audit, product, credential, qr, verification, fraud (evaluator), ai-config, ai-orchestration (visual-ai), hybrid, tenant guard | ✅ Partial or full |
| tenant, qr-customization, investigation, consumer-report, analytics, health, jobs (bulk processor, scheduler) | ❌ No tests |
| All controllers | ❌ No integration tests |

**Total:** 15 suites, 70 tests — all passing. No controller-level or E2E API integration tests beyond Playwright smoke.

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

### Doc vs code mismatches (open)

| Topic | Docs say | Code does | Affected files |
|-------|----------|-----------|----------------|
| Health paths | `/health`, `/health/ready` | `/api/v1/health`, `/api/v1/health/ready` | `helm/values.yaml`, `docker-compose.onprem.yml`, `nginx/onprem.conf`, `DR.md`, `onprem-install.md`, `API_REFERENCE.md` |
| AUTH_MODE | `oidc` for production | Only `dev` JWT/password works | `helm/values.yaml`, `onprem-install.md`, `AUTHENTICATION.md` |
| Rate limits | `RATE_LIMIT_*` env configurable | Hardcoded in `app.module.ts` | `packages/config`, compose, Helm |
| Readiness | DB + Redis | DB + hybrid gateway only | `SYSTEM.md`, `health.controller.ts` |
| Azure Terraform | Referenced in guides | Not in repo — manual Azure only | `docs/azure/AZURE.md` (correctly marked planned) |

**Correct references:** `README.md`, `PRODUCTION_SETUP_GUIDE.md` (partial), `Dockerfile.api`, E2E tests use `/api/v1/health/ready`.

### Documentation inventory (26 files)

All hub links in `docs/README.md` resolve. Canonical docs are well-organized by category (web, API, deployment, architecture, runbooks). `project.md` remains the product spec source of truth (4,700+ lines).

## Remediation checklist (production)

Before production deploy, complete:

- [ ] Set strong `JWT_SECRET` (≥32 chars) and rotate policy
- [ ] Fix health probe paths in Helm, Docker Compose, nginx, Prometheus → `/api/v1/health`
- [ ] Wire `RATE_LIMIT_*` env vars or remove from config/docs
- [ ] Add ESLint config to web apps for CI lint gate
- [ ] Remove or implement `AUTH_MODE=oidc`

---

## Test validation

After remediations, run:

```bash
pnpm --filter @truemark/api test          # 70/70
NODE_ENV=production pnpm --filter @truemark/admin-web build
NODE_ENV=production pnpm --filter @truemark/consumer-web build
# pnpm lint  # fails on web apps until ESLint configured
```

---

## Related documents

- [Threat Model](./THREAT_MODEL.md)
- [Production Readiness](./PRODUCTION_READINESS.md)
- [Production Setup Guide](./deployment/PRODUCTION_SETUP_GUIDE.md)
- [System Architecture](./architecture/SYSTEM.md)
