const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const doctorCreds = {
  email: process.env.E2E_DOCTOR_EMAIL || 'test.doctor1@medilink360.com',
  password: process.env.E2E_DOCTOR_PASSWORD || 'password123',
};

const unique = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

test.describe('Doctor flows', () => {
  test('Dashboard and charts', async ({ page }) => {
    await loginAs(page, doctorCreds);
    await expectRoleHeader(page, 'DOCTOR');
    await expect(page.getByText('Evolución de Indicadores de Salud')).toBeVisible();
  });

  test('Patient registration from patients module', async ({ page }) => {
    await loginAs(page, doctorCreds);
    await page.getByRole('link', { name: 'Mis Pacientes' }).click();
    await expect(page.getByText('Mis Pacientes')).toBeVisible();

    await page.getByRole('button', { name: 'Registrar Nuevo Paciente' }).click();
    await expect(page.getByText('Registrar Nuevo Paciente')).toBeVisible();

    const suffix = unique();
    const firstName = `Auto${suffix}`;
    const lastName = `Test${suffix}`;
    const email = `auto.${suffix}@example.com`;

    await page.getByLabel('Nombre').fill(firstName);
    await page.getByLabel('Apellido').fill(lastName);
    await page.getByLabel('Correo Electrónico').fill(email);
    await page.getByLabel('Fecha de Nacimiento').fill('1990-01-01');
    await page.getByRole('button', { name: 'Registrar Paciente' }).click();

    await expect(page.getByText('Registrar Nuevo Paciente')).toBeHidden();
    await page.getByPlaceholder('Buscar por nombre, apellido, email o padecimiento...').fill(lastName);
    await expect(page.getByText(lastName)).toBeVisible();
  });

  test('Medical records module loads', async ({ page }) => {
    await loginAs(page, doctorCreds);
    await page.getByRole('link', { name: 'Historial Clínico' }).click();
    await expect(page.getByText('Historial Clínico')).toBeVisible();
  });

  test('Calendar module loads', async ({ page }) => {
    await loginAs(page, doctorCreds);
    await page.getByRole('link', { name: 'Calendario' }).click();
    await expect(page.getByText('Calendario')).toBeVisible();
  });

  test('Prescriptions module loads and tabs render', async ({ page }) => {
    await loginAs(page, doctorCreds);
    await page.getByRole('link', { name: 'Recetas' }).click();
    await expect(page.getByText('Sistema de Recetas Médicas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recetas Emitidas' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Estadísticas' })).toBeVisible();
  });

  test('Assistant permissions - grant and revoke', async ({ page }) => {
    const assistantEmail = process.env.E2E_ASSISTANT_EMAIL || 'test.asistente1@medilink360.com';

    await loginAs(page, doctorCreds);
    await page.getByRole('link', { name: 'Mi perfil' }).click();
    await expect(page.getByText('💼 Habilitar asistente del personal de la salud')).toBeVisible();

    // If already linked, revoke first for clean state
    const linkedCard = page.getByText(assistantEmail);
    if (await linkedCard.isVisible().catch(() => false)) {
      await linkedCard.locator('..').locator('..').getByRole('button', { name: 'Revocar acceso' }).click();
    }

    await page.getByLabel('Buscar asistente por nombre o correo').fill(assistantEmail);
    await page.getByText(assistantEmail).first().click();

    await page.getByLabel('Calendario (editar - agendar)').check();
    await page.getByLabel('Zona de Estudio (edición)').check();
    await page.getByRole('button', { name: 'Guardar configuración' }).click();

    await expect(page.getByText(assistantEmail)).toBeVisible();
    await page.getByText(assistantEmail).locator('..').locator('..').getByRole('button', { name: 'Revocar acceso' }).click();
  });

  test('Promo code validation in doctor registration UI', async ({ page }) => {
    const promoLifetime = process.env.E2E_PROMO_LIFETIME || 'QLX-LIFE-23BAFFDCB6';
    await page.goto('/register?type=health_staff');
    await expect(page.getByText('Registro profesional de la Salud')).toBeVisible();
    await expect(page.getByText('Pago y Activación')).toBeVisible();

    await page.getByPlaceholder('Ingresa tu código (opcional)').fill(promoLifetime);
    await page.getByRole('button', { name: 'Validar' }).click();
    await expect(page.getByText('¡Código válido! Acceso de por vida activado.')).toBeVisible();
    await expect(page.getByText('¡Acceso de por vida activado! No se realizará ningún cobro.')).toBeVisible();
  });

  test('Medical records deep flow, recipes, calendar', async ({ page }) => {
    await loginAs(page, doctorCreds);

    // Create patient
    await page.getByRole('link', { name: 'Mis Pacientes' }).click();
    await page.getByRole('button', { name: 'Registrar Nuevo Paciente' }).click();

    const suffix = unique();
    const firstName = `Auto${suffix}`;
    const lastName = `Deep${suffix}`;
    const email = `auto.deep.${suffix}@example.com`;

    await page.getByLabel('Nombre').fill(firstName);
    await page.getByLabel('Apellido').fill(lastName);
    await page.getByLabel('Correo Electrónico').fill(email);
    await page.getByLabel('Fecha de Nacimiento').fill('1990-01-01');
    await page.getByRole('button', { name: 'Registrar Paciente' }).click();
    await expect(page.getByText('Registrar Nuevo Paciente')).toBeHidden();

    // Medical records: select patient
    await page.getByRole('link', { name: 'Historial Clínico' }).click();
    await expect(page.getByText('Historial Clínico')).toBeVisible();
    await page.getByPlaceholder('Buscar paciente por nombre, email o padecimiento...').fill(lastName);
    await page.locator('li').filter({ hasText: email }).first().click();

    // Create clinical case
    await page.getByRole('button', { name: 'Nuevo caso clínico' }).click();
    await page.getByLabel(/Padecimiento/).fill('Prueba');
    await page.getByRole('button', { name: 'Crear caso clínico' }).click();
    await expect(page.getByText('Prueba')).toBeVisible();

    // Create consultation
    await page.getByRole('button', { name: 'Registrar Consulta' }).click();
    await page.locator('label:has-text("Motivo de la Consulta")').locator('..').locator('input').fill('Consulta de prueba');
    const evolutionSelect = page.locator('label:has-text("Evolución Clínica del Paciente")').locator('..').locator('select');
    await evolutionSelect.selectOption('INITIAL_EVALUATION');
    await page.locator('label:has-text("Notas / Diagnóstico / Tratamiento")').locator('..').locator('textarea').fill('Notas de prueba');
    await page.getByRole('button', { name: 'Guardar Consulta' }).click();
    await expect(page.getByText('Consulta de prueba')).toBeVisible();

    // Collaborative invite
    await page.getByRole('button', { name: /Colaborativo/i }).first().click();
    await expect(page.getByText('Agregar colaborador')).toBeVisible();
    await page.getByPlaceholder('correo@ejemplo.com').fill(`colab.${suffix}@example.com`);
    await page.getByRole('button', { name: 'Invitar por correo' }).click();
    await expect(page.getByText(/Invitación enviada|Se ha enviado/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();

    // Recipes: create real prescription
    await page.getByRole('link', { name: 'Recetas' }).click();
    await expect(page.getByText('Sistema de Recetas Médicas')).toBeVisible();
    await page.getByPlaceholder('Buscar paciente por nombre o email...').fill(lastName);
    await page.getByText(email).first().click();
    await page.getByPlaceholder('Medicamento').fill('Paracetamol');
    await page.getByPlaceholder('Dosis').fill('500mg');
    await page.getByPlaceholder('Frecuencia').fill('Cada 8 horas');
    await page.getByPlaceholder('Duración').fill('5 días');
    await page.getByPlaceholder('Indicaciones (opcional)').fill('Tomar con alimentos');
    await page.getByRole('button', { name: 'Crear Receta' }).click();
    await expect(page.getByText(/Receta creada exitosamente/i)).toBeVisible();

    // Calendar: create appointment
    await page.getByRole('link', { name: 'Calendario' }).click();
    await page.getByRole('button', { name: 'Nueva cita' }).click();
    await page.getByLabel('Paciente').selectOption({ label: `${firstName} ${lastName}` });
    await page.getByLabel('Título de la cita').fill(`Cita ${suffix}`);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel('Fecha').fill(tomorrow);
    await page.getByRole('button', { name: 'Crear Cita' }).click();
    await expect(page.getByText('Evento creado correctamente')).toBeVisible();
  });
});
