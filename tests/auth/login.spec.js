const { test, expect } = require('@playwright/test');
const { loginAs, expectRoleHeader } = require('../utils/auth');

const creds = {
  doctor: {
    email: process.env.E2E_DOCTOR_EMAIL || 'test.doctor1@medilink360.com',
    password: process.env.E2E_DOCTOR_PASSWORD || 'password123',
  },
  assistant: {
    email: process.env.E2E_ASSISTANT_EMAIL || 'test.asistente1@medilink360.com',
    password: process.env.E2E_ASSISTANT_PASSWORD || 'password123',
  },
  patient: {
    email: process.env.E2E_PATIENT_EMAIL || 'test.paciente1@medilink360.com',
    password: process.env.E2E_PATIENT_PASSWORD || 'password123',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@qlinexa360.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'AdminQlinexa3602024!',
  },
};

test.describe('Login flows', () => {
  test('Doctor can login and see role header', async ({ page }) => {
    await loginAs(page, creds.doctor);
    await expectRoleHeader(page, 'DOCTOR');
  });

  test('Assistant can login and see role header', async ({ page }) => {
    await loginAs(page, creds.assistant);
    await expectRoleHeader(page, 'ASISTENTE');
  });

  test('Patient can login and see role header', async ({ page }) => {
    await loginAs(page, creds.patient);
    await expectRoleHeader(page, 'PATIENT');
  });

  test('Admin can login and see role header', async ({ page }) => {
    await loginAs(page, creds.admin);
    await expectRoleHeader(page, 'ADMIN');
  });
});
