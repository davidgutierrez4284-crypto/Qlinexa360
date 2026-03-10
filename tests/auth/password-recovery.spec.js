const { test, expect } = require('@playwright/test');

test('Password recovery request flow', async ({ page }) => {
  const email = process.env.E2E_DOCTOR_EMAIL || 'test.doctor1@medilink360.com';
  await page.goto('/forgot-password');

  await expect(page.getByRole('heading', { name: '¿Olvidaste tu contraseña?' })).toBeVisible();
  await page.getByLabel('Correo Electrónico').fill(email);
  await page.getByRole('button', { name: 'Enviar Enlace de Recuperación' }).click();

  await expect(page.getByText('Solicitud Enviada')).toBeVisible();
});
