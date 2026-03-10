const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const adminCreds = {
  email: process.env.E2E_ADMIN_EMAIL || 'admin@qlinexa360.com',
  password: process.env.E2E_ADMIN_PASSWORD || 'AdminQlinexa3602024!',
};

test.describe('Admin flows', () => {
  test('Can access dashboard and help', async ({ page }) => {
    await loginAs(page, adminCreds);
    await expectRoleHeader(page, 'ADMIN');

    await expect(page.getByText('Panel de administración de Qlinexa360')).toBeVisible();
    await page.getByRole('link', { name: 'Ayuda y tutoriales' }).click();
    await expect(page.getByText('Beneficios de Qlinexa360')).toBeVisible();
  });
});
