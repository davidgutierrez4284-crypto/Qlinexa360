/**
 * Prueba básica del cálculo de comisión de afiliados.
 * Ejecutar: npx ts-node scripts/test-affiliate-commission.ts
 */
import { computeCommission, roundMoney } from '../src/utils/affiliateCommission.utils';

let failures = 0;

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}: esperado=${expected} obtenido=${actual}`);
  if (!ok) failures += 1;
}

// Caso Qlinexa360: 499 gross, IVA 16%, 30% comisión
const r = computeCommission({
  grossAmount: 499,
  vatRate: 0.16,
  commissionPercentage: 30,
  commissionMonthNumber: 1,
  commissionDurationMonths: 6,
  paypalPaymentId: 'TEST-PAY-1',
  doctorUserId: 'doc-1',
  affiliateCode: 'QLX-AF-ABC123'
});

assertEqual('netBase (499 / 1.16)', r.netBase, 430.17);
assertEqual('commissionAmount (430.17 * 0.30)', r.commissionAmount, 129.05);

// Redondeo
assertEqual('roundMoney(129.051)', roundMoney(129.051), 129.05);
assertEqual('roundMoney(430.17241379)', roundMoney(430.17241379), 430.17);

// Otro caso: gross 1160, IVA 16% -> net 1000, 30% -> 300
const r2 = computeCommission({ grossAmount: 1160, vatRate: 0.16, commissionPercentage: 30 });
assertEqual('netBase (1160 / 1.16)', r2.netBase, 1000);
assertEqual('commissionAmount (1000 * 0.30)', r2.commissionAmount, 300);

if (failures > 0) {
  console.error(`\n${failures} prueba(s) fallida(s).`);
  process.exit(1);
}
console.log('\nTodas las pruebas de cálculo de comisión pasaron.');
