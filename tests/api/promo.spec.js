const { test, expect } = require('@playwright/test');

const promoCodes = {
  lifetime: process.env.E2E_PROMO_LIFETIME || 'QLX-LIFE-23BAFFDCB6',
  trial: process.env.E2E_PROMO_TRIAL || 'QLX-TRIAL-5B1990BCC7',
  discount: process.env.E2E_PROMO_DISCOUNT || 'QLX-50-3M-96E061E234',
  reactivation: process.env.E2E_PROMO_REACTIVATION || 'QLX-REACT-30D-CC228F8A84',
};

test.describe('Promo code validation API', () => {
  test('Validates lifetime code', async ({ request }) => {
    const res = await request.post('/api/promo/validate', { data: { code: promoCodes.lifetime } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.type).toBe('LIFETIME');
  });

  test('Validates trial code', async ({ request }) => {
    const res = await request.post('/api/promo/validate', { data: { code: promoCodes.trial } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.type).toBe('TRIAL_30D');
  });

  test('Validates 50% 3 months code', async ({ request }) => {
    const res = await request.post('/api/promo/validate', { data: { code: promoCodes.discount } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.type).toBe('DISCOUNT_50_3M');
  });

  test('Validates reactivation code', async ({ request }) => {
    const res = await request.post('/api/promo/validate', { data: { code: promoCodes.reactivation } });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.type).toBe('REACTIVATION_30D');
  });

  test('Rejects invalid code', async ({ request }) => {
    const res = await request.post('/api/promo/validate', { data: { code: 'INVALID-CODE-123' } });
    expect(res.ok()).toBeFalsy();
    const body = await res.json();
    expect(body.valid).toBe(false);
  });
});
