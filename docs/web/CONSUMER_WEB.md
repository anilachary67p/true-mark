# Consumer Web

> Public-facing Next.js app for product verification. No login required.

## Overview

| Property | Value |
|----------|-------|
| App path | `apps/consumer-web` |
| Package | `@truemark/consumer-web` |
| Default URL | http://localhost:3002 |
| Primary route | `/verify` |

## User flows

### QR scan

**In-app camera scanner** on `/verify`:

1. Tap **Scan QR Code** → camera opens (requires browser camera permission; HTTPS or localhost)
2. Point at product QR → decoded URL is sent to `POST /api/v1/public/verify/qr`
3. Result displayed: VERIFIED, REVERIFIED, UNKNOWN_QR, REVOKED, etc.

**Deep link** (e.g. from phone camera app):

1. Consumer scans QR → lands on `/verify?url=https://verify.example.com/v/<token>`
2. App calls `POST /api/v1/public/verify/qr` with `url` and `hostname`
3. Result displayed: VERIFIED, REVERIFIED, UNKNOWN_QR, REVOKED, etc.

### Manual code

1. Consumer enters code (e.g. `TM-E2E0-FIXD-0001`) on `/verify`
2. App calls `POST /api/v1/public/verify/code`
3. Product details shown on success

### Optional AI validation

After a successful core verification, consumer may start AI capture:

1. `POST /api/v1/public/verify/ai/initiate`
2. Upload images per `requiredViews` (FRONT, BACK, …)
3. `POST /api/v1/public/verify/ai/:jobId/process`

AI never changes the core verification result — it adds probabilistic evidence only.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3001` | API base URL |
| `NEXT_PUBLIC_VERIFY_HOSTNAME` | No | browser hostname | Verification domain sent to API |

For local dev with seed data, set at **build time**:

```bash
NEXT_PUBLIC_VERIFY_HOSTNAME=verify.localhost \
NEXT_PUBLIC_API_URL=http://localhost:3001 \
pnpm --filter @truemark/consumer-web build
```

## Development

```bash
NEXT_PUBLIC_VERIFY_HOSTNAME=verify.localhost \
NEXT_PUBLIC_API_URL=http://localhost:3001 \
pnpm --filter @truemark/consumer-web dev
```

## E2E test fixtures

After `pnpm db:seed`, use:

| Fixture | Value |
|---------|-------|
| Hostname | `verify.localhost` |
| Manual code | `TM-E2E0-FIXD-0001` |
| QR URL | `https://verify.localhost/v/e2eFixedQrToken0001` |

Defined in `packages/shared/src/constants.ts` as `E2E_FIXTURES`.

## Related docs

- [Core Verification](../architecture/CORE_VERIFICATION.md)
- [API Reference](../api/API_REFERENCE.md)
- [AI Boundary](../architecture/AI.md)
