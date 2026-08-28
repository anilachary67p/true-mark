# Production Readiness Checklist

> Gate checklist for TrueMark platform production deployment.  
> All items must be verified before go-live. Status tracked per deployment.

**Deployment:** _________________  
**Version:** _________________  
**Date:** _________________  
**Sign-off:** _________________

---

## 1. Architecture & Design

| #   | Item                                              | Status | Evidence                  |
| --- | ------------------------------------------------- | ------ | ------------------------- |
| 1.1 | Architecture documentation complete               | ☐      | `docs/architecture/`      |
| 1.2 | Threat model reviewed and validated               | ☐      | `docs/THREAT_MODEL.md`    |
| 1.3 | Core vs AI boundary documented and enforced       | ☐      | `docs/architecture/AI.md` |
| 1.4 | Modular monolith module boundaries verified       | ☐      | Code review               |
| 1.5 | Deployment model documented (SaaS/on-prem/hybrid) | ☐      | Runbooks                  |
| 1.6 | Data flow diagrams current                        | ☐      | Architecture docs         |
| 1.7 | API boundaries documented (OpenAPI/Swagger)       | ☐      | `/api/docs` endpoint      |

---

## 2. Security

| #    | Item                                              | Status | Evidence                 |
| ---- | ------------------------------------------------- | ------ | ------------------------ |
| 2.1  | Tenant isolation verified by integration tests    | ☐      | Test suite results       |
| 2.2  | QR tokens ≥128-bit entropy                        | ☐      | CredentialService review |
| 2.3  | Credentials stored as Argon2 hashes               | ☐      | Schema + code review     |
| 2.4  | No internal IDs in public API responses           | ☐      | API response audit       |
| 2.5  | Rate limiting enabled on public endpoints         | ☐      | Config verification      |
| 2.6  | HTTPS enforced everywhere (TLS 1.2+)              | ☐      | SSL Labs scan            |
| 2.7  | HSTS configured on verification domains           | ☐      | Header check             |
| 2.8  | Admin auth via OIDC with MFA                      | ☐      | IdP configuration        |
| 2.9  | JWT secret rotation procedure documented          | ☐      | Runbook                  |
| 2.10 | RBAC least privilege enforced                     | ☐      | Role matrix review       |
| 2.11 | No secrets in source control                      | ☐      | gitleaks scan            |
| 2.12 | Secret provider configured (not env vars in prod) | ☐      | Infra config             |
| 2.13 | Domain DNS TXT verification working               | ☐      | Test domain              |
| 2.14 | CORS configured for allowed origins only          | ☐      | Config review            |
| 2.15 | Input validation on all endpoints                 | ☐      | DTO review               |
| 2.16 | Dependency vulnerability scan clean               | ☐      | npm audit / Snyk         |
| 2.17 | Container image scan clean                        | ☐      | Trivy/Snyk               |
| 2.18 | Penetration test completed (or scheduled)         | ☐      | Pentest report           |
| 2.19 | AI cannot override invalid core verification      | ☐      | Acceptance test 15       |
| 2.20 | Audit logging on all admin mutations              | ☐      | Audit log review         |

---

## 3. Core Verification

| #    | Item                                           | Status | Evidence             |
| ---- | ---------------------------------------------- | ------ | -------------------- |
| 3.1  | QR verification returns correct results        | ☐      | Acceptance tests 1-5 |
| 3.2  | Manual code verification works                 | ☐      | Acceptance test      |
| 3.3  | Domain validation enforced                     | ☐      | Acceptance test 3    |
| 3.4  | Revoked/blocked QRs rejected                   | ☐      | Acceptance tests     |
| 3.5  | Repeat verification detected (REVERIFIED)      | ☐      | Test case            |
| 3.6  | Verification events persisted (append-only)    | ☐      | DB constraint review |
| 3.7  | Core verification p95 < 200ms                  | ☐      | Load test results    |
| 3.8  | No AI/OCR on core path                         | ☐      | Acceptance test 15   |
| 3.9  | Consumer reporting works without auth          | ☐      | Test case            |
| 3.10 | Product snapshot captured at verification time | ☐      | Event inspection     |

---

## 4. Multi-Tenancy

| #   | Item                                         | Status | Evidence          |
| --- | -------------------------------------------- | ------ | ----------------- |
| 4.1 | Tenant onboarding flow complete              | ☐      | Demo tenant       |
| 4.2 | Domain registration and verification working | ☐      | Test domain       |
| 4.3 | Cross-tenant access returns 403              | ☐      | Integration tests |
| 4.4 | TenantGuard enforced on all admin endpoints  | ☐      | Code review       |
| 4.5 | Platform admin role properly scoped          | ☐      | Role test         |
| 4.6 | Tenant-specific domains not hardcoded        | ☐      | Config audit      |
| 4.7 | Tenant config stored in database             | ☐      | Schema review     |

---

## 5. Data & Storage

| #    | Item                                              | Status | Evidence           |
| ---- | ------------------------------------------------- | ------ | ------------------ |
| 5.1  | PostgreSQL HA configured (Multi-AZ / replication) | ☐      | Infra config       |
| 5.2  | Database backups automated                        | ☐      | Backup schedule    |
| 5.3  | Backup restore tested successfully                | ☐      | DR drill report    |
| 5.4  | Object storage configured and accessible          | ☐      | Upload test        |
| 5.5  | Redis HA configured                               | ☐      | Infra config       |
| 5.6  | Database connection pooling configured            | ☐      | Prisma config      |
| 5.7  | Prisma migrations applied cleanly                 | ☐      | Migration log      |
| 5.8  | Data retention policy defined                     | ☐      | Policy document    |
| 5.9  | Verification history never deleted                | ☐      | Schema constraints |
| 5.10 | Encryption at rest enabled (DB + storage)         | ☐      | Cloud config       |

---

## 6. AI (If Enabled)

| #   | Item                                             | Status | Evidence              |
| --- | ------------------------------------------------ | ------ | --------------------- |
| 6.1 | AI provider configured and tested                | ☐      | Test job              |
| 6.2 | AI_DISABLED mode works (no AI exposed)           | ☐      | Acceptance test 15    |
| 6.3 | AI_NOT_CONFIGURED returned when provider missing | ☐      | Acceptance test 16    |
| 6.4 | AI confidence displayed separately from result   | ☐      | UI review             |
| 6.5 | AI jobs fully auditable                          | ☐      | Job record inspection |
| 6.6 | AI quota enforcement working                     | ☐      | Quota test            |
| 6.7 | Image quality gates functional                   | ☐      | Test with poor image  |
| 6.8 | AI rate limiting configured                      | ☐      | Config check          |
| 6.9 | Hybrid AI boundary respected (if applicable)     | ☐      | Data flow audit       |

---

## 7. Observability

| #   | Item                                                     | Status | Evidence           |
| --- | -------------------------------------------------------- | ------ | ------------------ |
| 7.1 | Structured JSON logging enabled                          | ☐      | Log sample         |
| 7.2 | Correlation IDs on all requests                          | ☐      | Log trace          |
| 7.3 | Health endpoints responding (`/health`, `/health/ready`) | ☐      | Curl test          |
| 7.4 | Metrics exported (Prometheus/CloudWatch)                 | ☐      | Dashboard          |
| 7.5 | Alerting configured for critical metrics                 | ☐      | Alert rules        |
| 7.6 | Dashboard for verification rate, latency, errors         | ☐      | Dashboard URL      |
| 7.7 | Log aggregation configured                               | ☐      | Log platform       |
| 7.8 | On-call rotation defined                                 | ☐      | PagerDuty/Opsgenie |

---

## 8. Performance & Reliability

| #   | Item                                               | Status | Evidence             |
| --- | -------------------------------------------------- | ------ | -------------------- |
| 8.1 | Core verification SLO defined (99.9% availability) | ☐      | SLO document         |
| 8.2 | Load test passed at 2x expected peak               | ☐      | Load test report     |
| 8.3 | API horizontal scaling verified                    | ☐      | Scale test           |
| 8.4 | BullMQ worker scaling verified                     | ☐      | Bulk job test        |
| 8.5 | Database query performance acceptable              | ☐      | Slow query log       |
| 8.6 | CDN configured for consumer verification pages     | ☐      | CDN config           |
| 8.7 | Graceful shutdown implemented                      | ☐      | Pod termination test |
| 8.8 | Circuit breakers for external dependencies         | ☐      | Code review          |

---

## 9. CI/CD & Deployment

| #   | Item                                                       | Status | Evidence        |
| --- | ---------------------------------------------------------- | ------ | --------------- |
| 9.1 | CI pipeline: lint, test, build, scan                       | ☐      | Pipeline config |
| 9.2 | Automated deployment to staging                            | ☐      | Deploy log      |
| 9.3 | Production deployment procedure documented                 | ☐      | Runbook         |
| 9.4 | Rollback procedure tested                                  | ☐      | Rollback drill  |
| 9.5 | Database migration strategy (blue-green / expand-contract) | ☐      | Migration docs  |
| 9.6 | Container images tagged with git SHA                       | ☐      | Registry check  |
| 9.7 | Environment-specific configuration validated               | ☐      | Config diff     |
| 9.8 | Smoke tests run post-deploy                                | ☐      | Smoke test log  |

---

## 10. Disaster Recovery

| #    | Item                                                    | Status | Evidence              |
| ---- | ------------------------------------------------------- | ------ | --------------------- |
| 10.1 | RPO defined and achievable (target: 1 hour)             | ☐      | DR doc                |
| 10.2 | RTO defined and tested (target: 4 hours)                | ☐      | DR drill              |
| 10.3 | Database backup/restore tested                          | ☐      | Restore log           |
| 10.4 | Object storage backup configured                        | ☐      | Backup config         |
| 10.5 | Configuration backup (Helm values, Terraform state)     | ☐      | Backup location       |
| 10.6 | DR runbook published and reviewed                       | ☐      | `docs/runbooks/DR.md` |
| 10.7 | Tenant/domain/QR relationships consistent after restore | ☐      | Integrity check       |

---

## 11. Documentation & Operations

| #     | Item                                | Status | Evidence                          |
| ----- | ----------------------------------- | ------ | --------------------------------- |
| 11.1  | README with setup instructions      | ☐      | `README.md`                       |
| 11.2  | Cloud deployment runbook            | ☐      | `docs/runbooks/cloud-deploy.md`   |
| 11.3  | On-prem install runbook             | ☐      | `docs/runbooks/onprem-install.md` |
| 11.4  | DR runbook                          | ☐      | `docs/runbooks/DR.md`             |
| 11.5  | API documentation (Swagger/OpenAPI) | ☐      | `/api/docs`                       |
| 11.6  | Admin user guide                    | ☐      | Documentation                     |
| 11.7  | Troubleshooting guide               | ☐      | Runbook section                   |
| 11.8  | Secret rotation procedure           | ☐      | Runbook section                   |
| 11.9  | Tenant onboarding guide             | ☐      | Documentation                     |
| 11.10 | Incident response procedure         | ☐      | Runbook section                   |

---

## 12. Compliance & Privacy

| #    | Item                                          | Status | Evidence          |
| ---- | --------------------------------------------- | ------ | ----------------- |
| 12.1 | Privacy policy for consumer verification      | ☐      | Legal review      |
| 12.2 | Geolocation consent mechanism (if collecting) | ☐      | UI review         |
| 12.3 | Data processing agreement template            | ☐      | Legal doc         |
| 12.4 | GDPR data subject request procedure           | ☐      | Policy doc        |
| 12.5 | Data residency requirements met               | ☐      | Deployment config |
| 12.6 | Audit log retention policy defined            | ☐      | Policy doc        |
| 12.7 | Consumer data minimization verified           | ☐      | Data audit        |

---

## 13. Critical Acceptance Tests

All tests from `project.md` critical acceptance section:

| #     | Test                                     | Status |
| ----- | ---------------------------------------- | ------ |
| 13.1  | Valid QR on approved domain → VERIFIED   | ☐      |
| 13.2  | Invalid QR → appropriate failure result  | ☐      |
| 13.3  | Domain not registered → UNABLE_TO_VERIFY | ☐      |
| 13.4  | Revoked QR → REVOKED_QR                  | ☐      |
| 13.5  | Manual code verification works           | ☐      |
| 13.6  | Repeat scan → REVERIFIED                 | ☐      |
| 13.7  | Cross-tenant access blocked              | ☐      |
| 13.8  | QR customization applied correctly       | ☐      |
| 13.9  | Bulk QR generation completes             | ☐      |
| 13.10 | AI disabled → no AI on scan              | ☐      |
| 13.11 | AI not configured → AI_NOT_CONFIGURED    | ☐      |
| 13.12 | Consumer report without login            | ☐      |
| 13.13 | Fraud signals on high-frequency scan     | ☐      |
| 13.14 | Audit log on admin actions               | ☐      |
| 13.15 | Verification history preserved           | ☐      |

---

## Sign-Off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Engineering Lead |      |      |           |
| Security Lead    |      |      |           |
| DevOps Lead      |      |      |           |
| Product Owner    |      |      |           |

**Production deployment approved:** ☐ Yes ☐ No

**Conditions / blockers:**

---

---

---

## Related Documents

- [Threat Model](./THREAT_MODEL.md)
- [Cloud Deploy Runbook](./runbooks/cloud-deploy.md)
- [On-Prem Install Runbook](./runbooks/onprem-install.md)
- [Disaster Recovery Runbook](./runbooks/DR.md)
