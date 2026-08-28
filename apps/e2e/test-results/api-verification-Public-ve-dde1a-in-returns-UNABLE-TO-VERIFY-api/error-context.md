# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api-verification.spec.ts >> Public verification API >> unregistered domain returns UNABLE_TO_VERIFY
- Location: tests/api-verification.spec.ts:34:7

# Error details

```
Error: apiRequestContext.post: connect ECONNREFUSED ::1:3001
Call log:
  - → POST http://localhost:3001/api/v1/public/verify/qr
    - user-agent: Playwright/1.62.1 (x64; macOS 26.6) node/22.16
    - accept: */*
    - accept-encoding: gzip,deflate,br
    - content-type: application/json
    - content-length: 89

```