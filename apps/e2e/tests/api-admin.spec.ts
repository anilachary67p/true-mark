import { test, expect } from '@playwright/test';
import { E2E_FIXTURES } from '@truemark/shared';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function login(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${API_URL}/api/v1/admin/auth/login`, {
    data: { email: 'admin@truemark.local', password: 'Admin123!@#' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return body.accessToken as string;
}

test.describe('Admin API (authenticated)', () => {
  test('lists tenants and tenant products', async ({ request }) => {
    const token = await login(request);
    const headers = { Authorization: `Bearer ${token}` };

    const tenants = await request.get(`${API_URL}/api/v1/admin/tenants`, { headers });
    expect(tenants.ok()).toBeTruthy();
    const tenantList = await tenants.json();
    expect(tenantList.length).toBeGreaterThan(0);

    const products = await request.get(`${API_URL}/api/v1/admin/tenants/${TENANT_ID}/products`, {
      headers,
    });
    expect(products.ok()).toBeTruthy();
    const productList = await products.json();
    expect(productList.length).toBeGreaterThan(0);
  });

  test('returns QR codes and verification history', async ({ request }) => {
    const token = await login(request);
    const headers = { Authorization: `Bearer ${token}` };

    const qr = await request.get(`${API_URL}/api/v1/admin/tenants/${TENANT_ID}/qr`, { headers });
    expect(qr.ok()).toBeTruthy();
    const qrList = await qr.json();
    expect(qrList.total).toBeGreaterThan(0);
    expect(qrList.items.length).toBeGreaterThan(0);

    const history = await request.get(
      `${API_URL}/api/v1/admin/tenants/${TENANT_ID}/verification-history`,
      { headers },
    );
    expect(history.ok()).toBeTruthy();
  });

  test('refresh token rotation works', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/api/v1/admin/auth/login`, {
      data: { email: 'admin@truemark.local', password: 'Admin123!@#' },
    });
    const { refreshToken } = await loginRes.json();
    const refreshRes = await request.post(`${API_URL}/api/v1/admin/auth/refresh`, {
      data: { refreshToken },
    });
    expect(refreshRes.ok()).toBeTruthy();
    const refreshed = await refreshRes.json();
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).toBeTruthy();
  });

  test('consumer report accepts reason field', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/public/reports`, {
      headers: { Host: E2E_FIXTURES.verifyHostname },
      data: { reason: 'E2E test report', comment: 'Automated test' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
