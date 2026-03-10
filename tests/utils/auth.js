const { expect } = require('@playwright/test');

const loginAs = async (page, { email, password }) => {
  await page.goto('/login');
  await page.getByLabel('Correo Electrónico').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password);
  await page.locator('form').getByRole('button', { name: 'Iniciar Sesión' }).click();
  await page.waitForURL(/\/dashboard/);
};

const expectRoleHeader = async (page, role) => {
  await expect(page.getByText(`${role} |`)).toBeVisible();
};

module.exports = {
  loginAs,
  expectRoleHeader,
};
