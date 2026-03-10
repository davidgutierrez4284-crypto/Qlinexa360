const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const patientCreds = {
  email: process.env.E2E_PATIENT_EMAIL || 'test.paciente1@medilink360.com',
  password: process.env.E2E_PATIENT_PASSWORD || 'password123',
};

test('Patient navigation smoke', async ({ page }) => {
  await loginAs(page, patientCreds);
  await expectRoleHeader(page, 'PATIENT');

  const navTo = async (label, path) => {
    await page.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(path));
  };

  await navTo('Historial clínico', '/dashboard/medical-records');
  await navTo('Zona de estudio', '/dashboard/documents');
  await navTo('Relación de facturación', '/dashboard/billing');
  await navTo('Mi perfil', '/dashboard/profile');
  await navTo('Ayuda y tutoriales', '/dashboard/help');
});
