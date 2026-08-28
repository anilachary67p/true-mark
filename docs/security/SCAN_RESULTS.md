# Security Scan Results

> Last run: August 2026  
> Tools: `pnpm audit`, Snyk, SonarQube, Trivy

## Summary

| Tool                    | Status           | Result                                                                 |
| ----------------------- | ---------------- | ---------------------------------------------------------------------- |
| **pnpm audit**          | ✅ Pass          | 0 vulnerabilities (after overrides + upgrades)                         |
| **Trivy** (Dockerfiles) | ✅ Pass          | 0 HIGH/CRITICAL on `infra/docker/Dockerfile.*`                         |
| **Trivy** (Terraform)   | ✅ Fixed         | EKS private endpoint, S3 CMK, SG egress restricted                     |
| **Snyk**                | ⚠️ Auth required | Run `snyk auth` then `npx snyk test --all-projects`                    |
| **SonarQube**           | ⚠️ Auth required | Set `SONAR_TOKEN` + `sonar.organization` in `sonar-project.properties` |

## Dependency fixes applied

Root `package.json` pnpm overrides:

```json
"pnpm": {
  "overrides": {
    "sharp": ">=0.35.0",
    "postcss": ">=8.5.23",
    "deepmerge-ts": ">=8.0.0"
  }
}
```

Package upgrades:

| Package                     | From    | To          | Reason                        |
| --------------------------- | ------- | ----------- | ----------------------------- |
| `next` (admin/consumer)     | ^15.3.3 | ^15.5.24    | Transitive sharp/postcss CVEs |
| `prisma` / `@prisma/client` | ^6.8.2  | ^6.19.3     | deepmerge-ts CVE              |
| `sharp` (api)               | ^0.35.4 | (unchanged) | Already patched               |

## Running scans locally

```bash
# Dependency audit (must pass in CI)
pnpm audit --audit-level=high

# Filesystem + IaC (requires: brew install trivy)
trivy fs --severity HIGH,CRITICAL --skip-dirs node_modules,.next,dist .
trivy config --severity HIGH,CRITICAL infra/

# Snyk (requires: snyk auth)
npx snyk test --all-projects

# SonarQube (requires SONAR_TOKEN + sonar.organization)
export SONAR_TOKEN=<token>
sonar-scanner -Dsonar.organization=<your-org>
```

## Snyk setup

1. Create account at [snyk.io](https://snyk.io)
2. Run `npx snyk auth` (opens browser)
3. Optional: add `SNYK_TOKEN` to GitHub Actions secrets for CI

## SonarQube / SonarCloud setup

1. Create project at [sonarcloud.io](https://sonarcloud.io) or your SonarQube server
2. Add to `sonar-project.properties`:
   ```properties
   sonar.organization=your-org
   ```
3. Export token: `export SONAR_TOKEN=<token>`
4. Run: `sonar-scanner`

## Terraform hardening (Trivy)

Fixes in `infra/terraform/aws/main.tf`:

- EKS API: `cluster_endpoint_public_access = false` by default
- S3: customer-managed KMS key for bucket encryption
- RDS/Redis security groups: egress restricted to VPC CIDR
- EKS nodes: custom security group rules (no public API, VPC-scoped egress)

## CI integration

`.github/workflows/ci.yml` runs:

- `pnpm audit --audit-level=high` (fails on HIGH+)
- Trivy filesystem scan via `aquasecurity/trivy-action`

## Re-scan after changes

```bash
pnpm install && pnpm audit --audit-level=high
pnpm --filter @truemark/api test
trivy config infra/terraform/aws/main.tf
```
