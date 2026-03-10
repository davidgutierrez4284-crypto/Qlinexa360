const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const assistantCreds = {
  email: process.env.E2E_ASSISTANT_EMAIL || 'test.asistente1@medilink360.com',
  password: process.env.E2E_ASSISTANT_PASSWORD || 'password123',
};

test('Assistant sidebar renders', async ({ page }) => {
  await loginAs(page, assistantCreds);
  await expectRoleHeader(page, 'ASISTENTE');

  await expect(page.getByRole('link', { name: 'Calendario' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Historial Clínico' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zona de estudio' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Relación de facturación' })).toBeVisible();
});
