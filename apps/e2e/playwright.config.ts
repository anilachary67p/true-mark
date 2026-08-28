import { defineConfig } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001';
const ADMIN_WEB_URL = process.env.ADMIN_WEB_URL ?? 'http://localhost:3000';
const CONSUMER_WEB_URL = process.env.CONSUMER_WEB_URL ?? 'http://localhost:3002';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: '**/api-*.spec.ts',
    },
    {
      name: 'consumer',
      testMatch: '**/consumer-smoke.spec.ts',
      use: { baseURL: CONSUMER_WEB_URL },
    },
    {
      name: 'admin',
      testMatch: '**/admin-smoke.spec.ts',
      use: { baseURL: ADMIN_WEB_URL },
    },
    {
      name: 'admin-auth',
      testMatch: '**/admin-auth.spec.ts',
      use: { baseURL: ADMIN_WEB_URL },
    },
    {
      name: 'integration',
      testMatch: '**/verify-flow.spec.ts',
      use: { baseURL: CONSUMER_WEB_URL },
    },
  ],
  // Optional: uncomment to auto-start API when not using run-all-tests.sh
  // webServer: {
  //   command: 'pnpm --filter @truemark/api start',
  //   url: `${API_URL}/api/v1/health/ready`,
  //   reuseExistingServer: true,
  //   timeout: 120_000,
  // },
});
