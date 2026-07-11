/**
 * QA del ciclo de pago por PayPal Payouts — SIN tocar dinero ni la API real de PayPal.
 *
 * Valida:
 *   - Guardas de payAffiliateViaPaypal (flag off / sin correo PayPal / sin pendientes),
 *     todas con retorno temprano ANTES de llamar a PayPal.
 *   - Conciliación por webhook: handlePayoutItemEvent
 *       SUCCEEDED  -> comisiones PROCESSING pasan a PAID
 *       FAILED     -> comisiones PROCESSING regresan a APPROVED
 *
 * Crea datos aislados (usuario/perfil/comisiones throwaway) y los borra al final,
 * por lo que NO afecta al afiliado de prueba del seed.
 *
 * Ejecutar:  npx ts-node scripts/qa-payout-cycle.ts
 */
import prisma from '../src/config/database';
import { payAffiliateViaPaypal, handlePayoutItemEvent } from '../src/services/affiliatePayout.service';

let pass = 0, fail = 0;
const failed: string[] = [];
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) { pass += 1; console.log(`  PASS  ${label}`); }
  else { fail += 1; failed.push(label); console.log(`  FAIL  ${label}${extra !== undefined ? ` -> ${JSON.stringify(extra)}` : ''}`); }
}

const SUFFIX = Date.now();
const USER_EMAIL = `qa.payout.${SUFFIX}@qlinexa360.com`;
const CODE = `QAPP${SUFFIX}`.slice(0, 12).toUpperCase();
const DOCTOR_USER_ID = `qa-doc-${SUFFIX}`;

async function makeCommission(affiliateId: string, referralId: string, monthNumber: number) {
  return prisma.affiliateCommission.create({
    data: {
      affiliateId,
      doctorUserId: DOCTOR_USER_ID,
      affiliateReferralId: referralId,
      paypalPaymentId: `QA-PAY-${SUFFIX}-${monthNumber}`,
      paypalSubscriptionId: `QA-SUB-${SUFFIX}`,
      paymentDate: new Date(),
      commissionMonthNumber: monthNumber,
      paymentAmountGross: 499,
      vatRate: 0.16,
      paymentAmountNet: 430.17,
      commissionPercentage: 30,
      commissionAmount: 129.05,
      currency: 'MXN',
      status: 'PENDING'
    }
  });
}

async function main() {
  console.log('\n###### QA CICLO PAYOUT (conciliación) ######\n');

  // ---- Datos aislados ----
  const user = await prisma.user.create({
    data: { email: USER_EMAIL, password: 'x', firstName: 'QA', lastName: 'Payout', role: 'AFFILIATE' }
  });
  const profile = await prisma.affiliateProfile.create({
    data: { userId: user.id, affiliateCode: CODE, fullName: 'QA Payout', email: USER_EMAIL, country: 'CO' }
  });
  const bank = await prisma.affiliateBankAccount.create({
    data: {
      affiliateId: profile.id, isActive: true, payoutMethod: 'PAYPAL',
      paypalEmail: 'qa-receiver@personal.example.com', beneficiaryFullName: 'QA Payout',
      country: 'CO', preferredCurrency: ''
    }
  });
  const referral = await prisma.affiliateReferral.create({
    data: { affiliateId: profile.id, doctorUserId: DOCTOR_USER_ID, doctorEmail: 'qa-doc@x.com', affiliateCodeUsed: CODE }
  });
  let commissions = [
    await makeCommission(profile.id, referral.id, 1),
    await makeCommission(profile.id, referral.id, 2)
  ];

  try {
    // ---- Guardas (sin llamar a la API real) ----
    process.env.PAYPAL_PAYOUTS_ENABLED = 'false';
    let r = await payAffiliateViaPaypal(profile.id, user.id);
    check('Flag OFF -> 409 (deshabilitado)', !r.ok && r.status === 409, r);

    process.env.PAYPAL_PAYOUTS_ENABLED = 'true';
    // Bank SPEI sin correo PayPal -> 400 antes de llamar a PayPal
    await prisma.affiliateBankAccount.update({ where: { id: bank.id }, data: { payoutMethod: 'SPEI', paypalEmail: null } });
    r = await payAffiliateViaPaypal(profile.id, user.id);
    check('Flag ON + sin correo PayPal -> 400', !r.ok && r.status === 400, r);

    // Bank PAYPAL pero sin comisiones pendientes -> 400 antes de llamar a PayPal
    await prisma.affiliateBankAccount.update({ where: { id: bank.id }, data: { payoutMethod: 'PAYPAL', paypalEmail: 'qa-receiver@personal.example.com' } });
    await prisma.affiliateCommission.updateMany({ where: { affiliateId: profile.id }, data: { status: 'PAID' } });
    r = await payAffiliateViaPaypal(profile.id, user.id);
    check('Flag ON + sin pendientes -> 400', !r.ok && r.status === 400, r);
    await prisma.affiliateCommission.updateMany({ where: { affiliateId: profile.id }, data: { status: 'PENDING' } });

    // ---- Conciliación SUCCEEDED ----
    const batchOk = `QA-BATCH-OK-${SUFFIX}`;
    await prisma.affiliateCommission.updateMany({
      where: { affiliateId: profile.id },
      data: { status: 'PROCESSING', payoutBatchId: batchOk }
    });
    await handlePayoutItemEvent({
      event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
      resource: { payout_batch_id: batchOk, payout_item_id: 'QA-ITEM-OK', transaction_status: 'SUCCESS' }
    });
    commissions = await prisma.affiliateCommission.findMany({ where: { affiliateId: profile.id } });
    check('SUCCEEDED -> todas PAID', commissions.every((c) => c.status === 'PAID'), commissions.map((c) => c.status));
    check('SUCCEEDED -> paidAt y payoutItemId asignados', commissions.every((c) => c.paidAt && c.payoutItemId === 'QA-ITEM-OK'));

    // ---- Conciliación FAILED (revierte a APPROVED) ----
    const batchFail = `QA-BATCH-FAIL-${SUFFIX}`;
    await prisma.affiliateCommission.updateMany({
      where: { affiliateId: profile.id },
      data: { status: 'PROCESSING', payoutBatchId: batchFail, paidAt: null }
    });
    await handlePayoutItemEvent({
      event_type: 'PAYMENT.PAYOUTS-ITEM.FAILED',
      resource: { payout_batch_id: batchFail, payout_item_id: 'QA-ITEM-FAIL', transaction_status: 'FAILED' }
    });
    commissions = await prisma.affiliateCommission.findMany({ where: { affiliateId: profile.id } });
    check('FAILED -> todas regresan a APPROVED', commissions.every((c) => c.status === 'APPROVED'), commissions.map((c) => c.status));

    // ---- Idempotencia: batch sin comisiones PROCESSING no rompe ----
    await handlePayoutItemEvent({
      event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
      resource: { payout_batch_id: 'QA-BATCH-INEXISTENTE', payout_item_id: 'x' }
    });
    check('Batch inexistente -> sin error (no-op)', true);
  } finally {
    // ---- Limpieza ----
    await prisma.affiliateCommission.deleteMany({ where: { affiliateId: profile.id } });
    await prisma.affiliateReferral.deleteMany({ where: { affiliateId: profile.id } });
    await prisma.affiliateBankAccount.deleteMany({ where: { affiliateId: profile.id } });
    await prisma.affiliateProfile.delete({ where: { id: profile.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }

  console.log(`\nRESULTADO: ${pass} PASS / ${fail} FAIL`);
  await prisma.$disconnect();
  if (fail > 0) { failed.forEach((f) => console.log(' -', f)); process.exit(1); }
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERROR EN QA PAYOUT CYCLE:', e);
  await prisma.$disconnect();
  process.exit(1);
});
