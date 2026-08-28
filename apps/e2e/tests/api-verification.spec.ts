import { test, expect } from '@playwright/test';
import { E2E_FIXTURES } from '@truemark/shared';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

test.describe('Public verification API', () => {
  test('valid QR returns VERIFIED', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/public/verify/qr`, {
      data: {
        url: E2E_FIXTURES.qrUrl,
        hostname: E2E_FIXTURES.verifyHostname,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(['VERIFIED', 'REVERIFIED']).toContain(body.result);
    expect(body.verificationPublicId).toBeTruthy();
    expect(body.tenantId).toBeUndefined();
    expect(body.product?.name).toContain('Daily Repair Shampoo');
  });

  test('invalid QR returns UNKNOWN_QR', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/public/verify/qr`, {
      data: {
        url: `https://${E2E_FIXTURES.verifyHostname}/v/not-a-real-token-xyz`,
        hostname: E2E_FIXTURES.verifyHostname,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe('UNKNOWN_QR');
  });

  test('unregistered domain returns UNABLE_TO_VERIFY', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/public/verify/qr`, {
      data: {
        url: E2E_FIXTURES.qrUrl,
        hostname: 'unknown.example.com',
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.result).toBe('UNABLE_TO_VERIFY');
  });

  test('raw numeric QR payload returns VERIFIED', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/public/verify/qr`, {
      data: {
        url: E2E_FIXTURES.scanQrPayload,
        hostname: E2E_FIXTURES.verifyHostname,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(['VERIFIED', 'REVERIFIED']).toContain(body.result);
    expect(body.product?.serial).toBe('SN-SCAN-12345');
  });

  test('manual code verification works', async ({ request }) => {
    const res = await request.post(`${API_URL}/api/v1/public/verify/code`, {
      data: {
        code: E2E_FIXTURES.manualCode,
        hostname: E2E_FIXTURES.verifyHostname,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(['VERIFIED', 'REVERIFIED']).toContain(body.result);
  });

  test('health ready includes database check', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/health/ready`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.checks.database).toBe('ok');
  });
});
