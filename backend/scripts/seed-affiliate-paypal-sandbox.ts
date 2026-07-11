/**
 * Seed SANDBOX para validar el pago de comisiones por PayPal Payouts.
 *
 * Crea (idempotente):
 *   1) Un afiliado de prueba ACTIVO con método de pago PAYPAL (correo PayPal sandbox).
 *   2) Un doctor que se registró con el código del afiliado (suscripción PayPal demo).
 *   3) Tres comisiones reales (lógica de producción) en estado PENDING/APPROVED, listas
 *      para pagarse con el botón "Pagar con PayPal" del Admin.
 *
 * El correo de PayPal del afiliado se toma de la variable de entorno
 * SANDBOX_AFFILIATE_PAYPAL_EMAIL (usa el email de tu cuenta "personal" de sandbox que
 * pueda RECIBIR pagos). Si no se define, usa un placeholder que debes reemplazar.
 *
 * Ejecutar:  npx ts-node scripts/seed-affiliate-paypal-sandbox.ts
 */
import prisma from '../src/config/database';
import { NotificationService } from '../src/services/notification.service';
import { register } from '../src/controllers/auth.controller';
import { AffiliateAdminController } from '../src/controllers/affiliateAdmin.controller';
import { AffiliateController } from '../src/controllers/affiliate.controller';
import { processPaymentForCommission } from '../src/services/affiliate.service';
import { hashPassword } from '../src/utils/password.utils';

(NotificationService as any).sendWelcomeEmail = async () => {};
(NotificationService as any).sendNewUserConsentToUser = async () => {};
(NotificationService as any).sendNewUserConsentToLegal = async () => {};

const AFFILIATE_EMAIL = 'afiliado.paypal.demo@qlinexa360.com';
const AFFILIATE_PASSWORD = 'Afiliado123!';
const DOCTOR_EMAIL = 'doctor.paypal.demo@qlinexa360.com';
const DOCTOR_PASSWORD = 'Doctor123!';
const DEMO_SUB_ID = 'I-DEMO-PP-SUB-001';
const DEMO_PLAN_ID = 'P-DEMO-PLAN-499';
const PAYMENT_TOTAL = '499.00';
const PAYMENT_CURRENCY = 'MXN';
const MONTHS_TO_GENERATE = 3;

const PAYPAL_RECEIVER_EMAIL = (process.env.SANDBOX_AFFILIATE_PAYPAL_EMAIL || 'sb-receiver@personal.example.com').trim();
const AFFILIATE_COUNTRY = 'CO'; // Internacional (Colombia) para ilustrar pago vía PayPal

function mockReq(opts: { body?: any; params?: any; query?: any; user?: any } = {}) {
  return {
    body: opts.body || {},
    params: opts.params || {},
    query: opts.query || {},
    user: opts.user,
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    headers: {}
  } as any;
}
function mockRes() {
  const res: any = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.send = (b: any) => { res.sent = b; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; return res; };
  return res;
}

function paypalPaymentEvent(paymentId: string, subId: string, createTime: Date) {
  return {
    id: `EVT-${paymentId}`,
    event_type: 'PAYMENT.SALE.COMPLETED',
    resource: {
      id: paymentId,
      billing_agreement_id: subId,
      amount: { total: PAYMENT_TOTAL, currency: PAYMENT_CURRENCY },
      create_time: createTime.toISOString()
    }
  };
}

async function cleanupPrevious() {
  const doctorUser = await prisma.user.findUnique({ where: { email: DOCTOR_EMAIL } });
  if (doctorUser) {
    await prisma.affiliateCommission.deleteMany({ where: { doctorUserId: doctorUser.id } });
    await prisma.affiliateReferral.deleteMany({ where: { doctorUserId: doctorUser.id } });
    const doctor = await prisma.doctor.findUnique({ where: { userId: doctorUser.id } });
    if (doctor) {
      await prisma.subscription.deleteMany({ where: { doctorId: doctor.id } });
      await prisma.promoRedemption.deleteMany({ where: { doctorId: doctor.id } });
      await prisma.doctor.delete({ where: { id: doctor.id } });
    }
    await prisma.consentHistory.deleteMany({ where: { userId: doctorUser.id } });
    await prisma.user.delete({ where: { id: doctorUser.id } });
  }

  const affUser = await prisma.user.findUnique({ where: { email: AFFILIATE_EMAIL } });
  if (affUser) {
    const prof = await prisma.affiliateProfile.findUnique({ where: { userId: affUser.id } });
    if (prof) {
      await prisma.affiliateCode.updateMany({ where: { affiliateId: prof.id }, data: { affiliateId: null, status: 'AVAILABLE' } });
    }
    await prisma.user.delete({ where: { id: affUser.id } });
  }

  await prisma.paypalWebhookEvent.deleteMany({
    where: { paypalEventId: { startsWith: 'EVT-PAY-DEMO-PP-' } }
  });
}

async function ensureCommissionRule() {
  const existing = await prisma.affiliateCommissionRule.findFirst({ where: { isActive: true } });
  if (existing) return existing;
  return prisma.affiliateCommissionRule.create({
    data: {
      name: 'Regla estándar (demo)',
      commissionPercentage: 30,
      commissionMonths: 6,
      vatRate: 0.16,
      freeMonthsForDoctor: 1,
      graceDaysForDoctor: 15,
      isActive: true
    }
  });
}

async function main() {
  console.log('\n###### SEED AFILIADO PAYPAL (SANDBOX) ######\n');
  await cleanupPrevious();
  const rule = await ensureCommissionRule();
  console.log(`Regla activa: ${Number(rule.commissionPercentage)}% / ${rule.commissionMonths} meses / IVA ${Number(rule.vatRate)}`);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No hay usuario ADMIN en la BD. Crea el admin antes de correr el seed.');
  const adminUser = { userId: admin.id, role: 'ADMIN' };

  // 1) Crear afiliado (flujo Admin).
  const rAff = mockRes();
  await AffiliateAdminController.createAffiliate(
    mockReq({
      user: adminUser,
      body: {
        fullName: 'Afiliado PayPal Demo',
        email: AFFILIATE_EMAIL,
        phone: '+573001234567',
        country: AFFILIATE_COUNTRY,
        commissionPercentage: 30,
        commissionMonths: 6
      }
    }),
    rAff
  );
  if (rAff.statusCode !== 201) throw new Error(`createAffiliate falló: ${JSON.stringify(rAff.body)}`);
  const affiliate = rAff.body.data;
  const affiliateCode: string = affiliate.affiliateCode;
  const affProfile = await prisma.affiliateProfile.findUnique({ where: { id: affiliate.id } });

  await prisma.user.update({
    where: { id: affProfile!.userId },
    data: { password: await hashPassword(AFFILIATE_PASSWORD) }
  });
  console.log(`Afiliado creado: ${AFFILIATE_EMAIL}  código ${affiliateCode}`);

  // 1b) Datos bancarios: método PAYPAL.
  const affUserCtx = { userId: affProfile!.userId, role: 'AFFILIATE' };
  const rBank = mockRes();
  await AffiliateController.upsertBankAccount(
    mockReq({
      user: affUserCtx,
      body: {
        payoutMethod: 'PAYPAL',
        beneficiaryFullName: 'Afiliado PayPal Demo',
        country: AFFILIATE_COUNTRY,
        paypalEmail: PAYPAL_RECEIVER_EMAIL
      }
    }),
    rBank
  );
  if (rBank.statusCode !== 201) throw new Error(`upsertBankAccount falló: ${JSON.stringify(rBank.body)}`);
  console.log(`Método de pago: PayPal · correo receptor ${PAYPAL_RECEIVER_EMAIL}`);

  // 2) Registrar doctor con el código del afiliado.
  const rDoc = mockRes();
  await register(
    mockReq({
      body: {
        email: DOCTOR_EMAIL,
        password: DOCTOR_PASSWORD,
        firstName: 'Doctor',
        lastName: 'Referido PayPal',
        role: 'DOCTOR',
        paypalSubscriptionId: DEMO_SUB_ID,
        paypalPlanId: DEMO_PLAN_ID,
        affiliateCode,
        specialty: 'Medicina General',
        licenseNumber: `DEMO-PP-LIC-${Date.now()}`
      }
    }),
    rDoc
  );
  if (rDoc.statusCode !== 201) throw new Error(`register doctor falló: ${JSON.stringify(rDoc.body)}`);
  console.log(`Doctor registrado con código de afiliado: ${DOCTOR_EMAIL}`);

  // 3) Generar comisiones reales (3 pagos mensuales).
  const base = new Date();
  for (let m = 1; m <= MONTHS_TO_GENERATE; m += 1) {
    const when = new Date(base.getFullYear(), base.getMonth() - (MONTHS_TO_GENERATE - m), 5, 12, 0, 0);
    await processPaymentForCommission(paypalPaymentEvent(`PAY-DEMO-PP-${m}`, DEMO_SUB_ID, when));
  }

  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { commissionMonthNumber: 'asc' }
  });
  const totalPorPagar = commissions
    .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED')
    .reduce((acc, c) => acc + Number(c.commissionAmount), 0);

  const payoutsEnabled = String(process.env.PAYPAL_PAYOUTS_ENABLED || '').toLowerCase() === 'true';

  console.log('\n================== RESUMEN (SANDBOX) ==================');
  console.log('AFILIADO (método PayPal):');
  console.log(`  Login:     ${AFFILIATE_EMAIL}`);
  console.log(`  Password:  ${AFFILIATE_PASSWORD}`);
  console.log(`  Código:    ${affiliateCode}`);
  console.log(`  PayPal:    ${PAYPAL_RECEIVER_EMAIL}  (país ${AFFILIATE_COUNTRY})`);
  console.log('\nDOCTOR REFERIDO:');
  console.log(`  Login:     ${DOCTOR_EMAIL} / ${DOCTOR_PASSWORD}`);
  console.log('\nCOMISIONES (sobre base SIN IVA):');
  for (const c of commissions) {
    console.log(`  Mes ${c.commissionMonthNumber}: ${Number(c.commissionAmount)} ${c.currency} · estatus ${c.status}`);
  }
  console.log(`\n  TOTAL POR PAGAR: ${totalPorPagar.toFixed(2)} ${PAYMENT_CURRENCY}`);
  console.log('======================================================\n');

  console.log('PARA VALIDAR EL CICLO REAL EN SANDBOX:');
  console.log(`  1) PAYPAL_PAYOUTS_ENABLED = ${payoutsEnabled ? 'true (OK)' : 'false  -> ponlo en true en backend/.env'}`);
  console.log('  2) Asegura PAYPAL_ENVIRONMENT=sandbox y credenciales SANDBOX en backend/.env.');
  console.log('  3) Reemplaza el correo receptor con tu cuenta "personal" de sandbox:');
  console.log('     SANDBOX_AFFILIATE_PAYPAL_EMAIL="sb-xxxx@personal.example.com" y vuelve a correr este seed.');
  console.log('  4) En el panel de PayPal Developer, agrega los eventos PAYMENT.PAYOUTS-ITEM.* a tu webhook');
  console.log('     y expón tu backend con un túnel (p. ej. ngrok) para recibir el webhook.');
  console.log('  5) En Admin → Afiliados, clic en "Pagar con PayPal" en este afiliado.');
  console.log('     El estatus pasará a "En proceso (PayPal)" y, al llegar el webhook, a "Pagada".\n');
  console.log('Para validar SOLO la conciliación (sin tocar PayPal):  npx ts-node scripts/qa-payout-cycle.ts\n');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERROR EN SEED PAYPAL SANDBOX:', e);
  await prisma.$disconnect();
  process.exit(1);
});
