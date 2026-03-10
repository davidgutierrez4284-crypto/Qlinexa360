const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const doctorCreds = {
  email: process.env.E2E_DOCTOR_EMAIL || 'test.doctor1@medilink360.com',
  password: process.env.E2E_DOCTOR_PASSWORD || 'password123',
};

test('Doctor navigation smoke', async ({ page }) => {
  await loginAs(page, doctorCreds);
  await expectRoleHeader(page, 'DOCTOR');

  const navTo = async (label, path) => {
    await page.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(path));
  };

  await navTo('Calendario', '/dashboard/calendario');
  await navTo('Mis Pacientes', '/dashboard/patients');
  await navTo('Zona de estudio', '/dashboard/documents');
  await navTo('Relación de facturación', '/dashboard/billing');
  await navTo('Mi perfil', '/dashboard/profile');
  await navTo('Ayuda y tutoriales', '/dashboard/help');
});
