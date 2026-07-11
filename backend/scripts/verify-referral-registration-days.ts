/**
 * Verifica combinaciones a/b/c/d de días de primer ciclo (registro doctor + PayPal).
 * Ejecutar desde la carpeta backend: npx ts-node scripts/verify-referral-registration-days.ts
 */
import { computePayPalFirstCycleDays } from '../src/utils/referralRegistration.utils';

function assert(name: string, actual: number, expected: number, detail?: string) {
  if (actual !== expected) {
    console.error(`FAIL ${name}: esperado ${expected}, obtenido ${actual}`);
    process.exit(1);
  }
  const extra = detail ? ` — ${detail}` : '';
  console.log(`OK ${name}: ${actual}${extra}`);
}

// a) Sin promo, sin referido: solo 15 días de gracia plataforma (cobro desde día 16)
let r = computePayPalFirstCycleDays(undefined, undefined);
assert('a) sin promo, sin referido (total)', r.totalDays, 15, '15 días uso plataforma');
assert('a) platformGraceDays', r.platformGraceDays, 15);

// b) Sin promo + referido: 15 + 30
r = computePayPalFirstCycleDays(undefined, 'referrer-doctor-id');
assert('b) sin promo + referido', r.totalDays, 45, '15 gracia + 30 referido');

// c) Promo 1 mes + referido: 15 + 30 + 30
r = computePayPalFirstCycleDays({ type: 'TRIAL_30D' }, 'referrer-doctor-id');
assert('c) TRIAL_30D + referido', r.totalDays, 75, '15 + 30 promo + 30 ref');

// d) Promo 3 meses + referido: 15 + 90 + 30
r = computePayPalFirstCycleDays({ type: 'DISCOUNT_50_3M' }, 'referrer-doctor-id');
assert('d) DISCOUNT_50_3M + referido', r.totalDays, 135, '15 + 90 + 30');

// Promo 1 mes sin referido: 15 + 30
r = computePayPalFirstCycleDays({ type: 'TRIAL_30D' }, undefined);
assert('TRIAL_30D sin referido', r.totalDays, 45, '15 + 30 promo');

// LIFETIME: sin mes referido ni gracia de cobro (sin suscripción de pago)
r = computePayPalFirstCycleDays({ type: 'LIFETIME' }, 'referrer-doctor-id');
assert('LIFETIME + referido (bonus referido)', r.referralBonusDays, 0, 'días');
assert('LIFETIME + referido (platformGraceDays)', r.platformGraceDays, 0);
assert('LIFETIME + referido (total primer ciclo)', r.totalDays, 30, 'días');

console.log('\nTodas las verificaciones de días de registro referido pasaron.');
