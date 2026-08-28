import { test, expect } from '@playwright/test';
import { E2E_FIXTURES } from '@truemark/shared';

test('manual code verification flow in consumer UI', async ({ page }) => {
  await page.goto('/verify');
  await page.getByPlaceholder('TM-XXXX-XXXX-XXXX').fill(E2E_FIXTURES.manualCode);
  await page.getByRole('button', { name: 'VERIFY' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText(/VERIFIED|REVERIFIED/);
  await expect(page.getByText(/Daily Repair Shampoo/)).toBeVisible();
});
