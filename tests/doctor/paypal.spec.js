const { test, expect } = require('@playwright/test');

const shouldRun = process.env.E2E_PAYPAL_UI === '1';

test.describe('PayPal checkout (UI availability)', () => {
  test.skip(!shouldRun, 'Set E2E_PAYPAL_UI=1 to enable PayPal UI test');

  test('PayPal button renders on registration payment step', async ({ page }) => {
    await page.goto('/register?type=health_staff');
    await expect(page.getByText('Registro profesional de la Salud')).toBeVisible();
    await expect(page.getByText('Pago y Activación')).toBeVisible();
    await expect(page.getByRole('button', { name: /paypal/i })).toBeVisible();
  });
});
