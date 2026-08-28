import { test, expect } from '@playwright/test';

test('verify page loads', async ({ page }) => {
  await page.goto('/verify');
  await expect(page.getByRole('heading', { name: 'TRUE MARK' })).toBeVisible();
  await expect(page.getByText('Verify your product authenticity')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scan QR Code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'VERIFY' })).toBeVisible();
});
