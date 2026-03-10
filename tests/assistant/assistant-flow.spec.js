const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const assistantCreds = {
  email: process.env.E2E_ASSISTANT_EMAIL || 'test.asistente1@medilink360.com',
  password: process.env.E2E_ASSISTANT_PASSWORD || 'password123',
};

test.describe('Assistant flows', () => {
  test('Can access core modules', async ({ page }) => {
    await loginAs(page, assistantCreds);
    await expectRoleHeader(page, 'ASISTENTE');

    await page.getByRole('link', { name: 'Calendario' }).click();
    await expect(page.getByText('Calendario')).toBeVisible();

    await page.getByRole('link', { name: 'Historial Clínico' }).click();
    await expect(page.getByText('Historial Clínico')).toBeVisible();

    await page.getByRole('link', { name: 'Zona de estudio' }).click();
    await expect(page.getByText('Zona de Estudio')).toBeVisible();

    await page.getByRole('link', { name: 'Relación de facturación' }).click();
    await expect(page.getByText('Relación de facturación')).toBeVisible();
  });

  test('Medical records are read-only for assistant', async ({ page }) => {
    await loginAs(page, assistantCreds);
    await page.getByRole('link', { name: 'Historial Clínico' }).click();
    await expect(page.getByText('Historial Clínico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar Nuevo Paciente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar Consulta' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo caso clínico' })).toHaveCount(0);
  });
});
