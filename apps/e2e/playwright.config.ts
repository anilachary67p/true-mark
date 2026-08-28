import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'consumer',
      testMatch: '**/consumer-smoke.spec.ts',
      use: { baseURL: process.env.CONSUMER_WEB_URL ?? 'http://localhost:3002' },
    },
    {
      name: 'admin',
      testMatch: '**/admin-smoke.spec.ts',
      use: { baseURL: process.env.ADMIN_WEB_URL ?? 'http://localhost:3000' },
    },
    {
      name: 'api',
      testMatch: '**/api-*.spec.ts',
    },
    {
      name: 'integration',
      testMatch: '**/verify-flow.spec.ts',
      use: { baseURL: process.env.CONSUMER_WEB_URL ?? 'http://localhost:3002' },
    },
  ],
});
