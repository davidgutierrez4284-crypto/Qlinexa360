const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const patientCreds = {
  email: process.env.E2E_PATIENT_EMAIL || 'test.paciente1@medilink360.com',
  password: process.env.E2E_PATIENT_PASSWORD || 'password123',
};

test.describe('Patient flows', () => {
  test('Can access patient modules', async ({ page }) => {
    await loginAs(page, patientCreds);
    await expectRoleHeader(page, 'PATIENT');

    await page.getByRole('link', { name: 'Historial clínico' }).click();
    await expect(page.getByText('Historial Clínico')).toBeVisible();

    await page.getByRole('link', { name: 'Zona de estudio' }).click();
    await expect(page.getByText('Zona de Estudio')).toBeVisible();

    await page.getByRole('link', { name: 'Relación de facturación' }).click();
    await expect(page.getByText('Relación de facturación')).toBeVisible();

    await page.getByRole('link', { name: 'Mi perfil' }).click();
    await expect(page.getByText('Mi perfil')).toBeVisible();
  });

  test('Medical records are read-only for patient', async ({ page }) => {
    await loginAs(page, patientCreds);
    await page.getByRole('link', { name: 'Historial clínico' }).click();
    await expect(page.getByText('Historial Clínico')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar Nuevo Paciente' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Registrar Consulta' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nuevo caso clínico' })).toHaveCount(0);
  });
});
