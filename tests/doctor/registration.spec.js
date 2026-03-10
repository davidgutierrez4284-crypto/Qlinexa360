const { test, expect } = require('@playwright/test');

const shouldRun = process.env.E2E_REGISTER_DOCTOR === '1' && !!process.env.E2E_PROMO_LIFETIME;

test.describe('Doctor registration (optional)', () => {
  test.skip(!shouldRun, 'Set E2E_REGISTER_DOCTOR=1 and E2E_PROMO_LIFETIME to enable');

  test('Registers doctor via API with promo code', async ({ request }) => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const email = `doctor.${unique}@example.com`;

    const res = await request.post('/api/auth/register', {
      data: {
        email,
        password: 'Password123',
        firstName: 'E2E',
        lastName: `Doctor${unique}`,
        role: 'DOCTOR',
        phone: '5555555555',
        licenseNumber: `LIC-${unique}`,
        specialty: 'Medicina General',
        officeAddress: 'Consultorio 123',
        professionalTitle: 'Dr.',
        taxId: `RFC${unique}`,
        taxName: 'E2E Doctor',
        taxStreet: 'Calle 1',
        acceptPrivacy: true,
        acceptTerms: true,
        promoCode: process.env.E2E_PROMO_LIFETIME,
      },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user?.email).toBe(email);
    expect(body.user?.role).toBe('DOCTOR');
  });
});
