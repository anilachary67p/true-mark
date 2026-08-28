import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@truemark.local';
const ADMIN_PASSWORD = 'Admin123!@#';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

test.describe('License API', () => {
  test('returns active license status for seeded tenant', async ({ request }) => {
    const login = await request.post('http://localhost:3001/api/v1/admin/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const { accessToken } = await login.json();

    const res = await request.get(
      `http://localhost:3001/api/v1/admin/tenants/${TENANT_ID}/license/status`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.tenantId).toBe(TENANT_ID);
    expect(['ACTIVE', 'WARNING_30', 'WARNING_15', 'WARNING_7']).toContain(body.status);
    expect(body.commercialModel).toBeTruthy();
  });
});
