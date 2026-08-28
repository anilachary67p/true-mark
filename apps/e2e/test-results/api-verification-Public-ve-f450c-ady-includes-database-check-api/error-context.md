# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api-verification.spec.ts >> Public verification API >> health ready includes database check
- Location: tests/api-verification.spec.ts:71:7

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:3001
Call log:
  - → GET http://localhost:3001/api/v1/health/ready
    - user-agent: Playwright/1.62.1 (x64; macOS 26.6) node/22.16
    - accept: */*
    - accept-encoding: gzip,deflate,br

```