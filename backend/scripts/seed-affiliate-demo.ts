/**
 * Seed de datos DEMO para el módulo de Afiliados Comerciales.
 *
 * Crea (de forma idempotente):
 *   1) Un afiliado de prueba ACTIVO, con datos bancarios (CLABE) para pago.
 *   2) Un doctor que se registró usando el código del afiliado (con suscripción PayPal).
 *   3) Tres comisiones reales generadas con la lógica de producción
 *      (processPaymentForCommission), calculadas sobre la base SIN IVA.
 *
 * Pensado para revisar en la plataforma: dashboard del afiliado y reporte/pago del Admin.
 *
 * Ejecutar:  npx ts-node scripts/seed-affiliate-demo.ts
 */
import prisma from '../src/config/database';
import { NotificationService } from '../src/services/notification.service';
import { register } from '../src/controllers/auth.controller';
import { AffiliateAdminController } from '../src/controllers/affiliateAdmin.controller';
import { AffiliateController } from '../src/controllers/affiliate.controller';
import { processPaymentForCommission } from '../src/services/affiliate.service';
import { hashPassword } from '../src/utils/password.utils';

// Evitar envíos de correo/WhatsApp durante el seed.
(NotificationService as any).sendWelcomeEmail = async () => {};
(NotificationService as any).sendNewUserConsentToUser = async () => {};
(NotificationService as any).sendNewUserConsentToLegal = async () => {};

// ----- Datos fijos del demo (credenciales conocidas para poder iniciar sesión) -----
const AFFILIATE_EMAIL = 'afiliado.demo@qlinexa360.com';
const AFFILIATE_PASSWORD = 'Afiliado123!';
const DOCTOR_EMAIL = 'doctor.referido.demo@qlinexa360.com';
const DOCTOR_PASSWORD = 'Doctor123!';
const DEMO_SUB_ID = 'I-DEMO-AFF-SUB-001';
const DEMO_PLAN_ID = 'P-DEMO-PLAN-499';
const PAYMENT_TOTAL = '499.00';
const PAYMENT_CURRENCY = 'MXN';
const MONTHS_TO_GENERATE = 3;

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
  const res: any = { statusCode: 200, body: undefined, headers: {}, sent: undefined };
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

/** Borra cualquier rastro de un seed anterior para que el script sea repetible. */
async function cleanupPrevious() {
  // --- Doctor demo ---
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

  // --- Afiliado demo (cascade borra perfil, bancos, referrals y comisiones) ---
  const affUser = await prisma.user.findUnique({ where: { email: AFFILIATE_EMAIL } });
  if (affUser) {
    // Liberar cualquier código del pool asignado (onDelete SetNull, pero por claridad)
    const prof = await prisma.affiliateProfile.findUnique({ where: { userId: affUser.id } });
    if (prof) {
      await prisma.affiliateCode.updateMany({ where: { affiliateId: prof.id }, data: { affiliateId: null, status: 'AVAILABLE' } });
    }
    await prisma.user.delete({ where: { id: affUser.id } });
  }

  // Limpiar restos de webhooks idempotentes de pagos demo previos
  await prisma.paypalWebhookEvent.deleteMany({
    where: { paypalEventId: { startsWith: 'EVT-PAY-DEMO-AFF-' } }
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
  console.log('\n###### SEED AFILIADO DEMO ######\n');
  await cleanupPrevious();
  const rule = await ensureCommissionRule();
  console.log(`Regla activa: ${Number(rule.commissionPercentage)}% / ${rule.commissionMonths} meses / IVA ${Number(rule.vatRate)}`);

  // Admin para ejecutar acciones administrativas (usa el admin real de dev si existe).
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No hay usuario ADMIN en la BD. Crea el admin antes de correr el seed.');
  const adminUser = { userId: admin.id, role: 'ADMIN' };

  // 1) Crear afiliado vía controlador real (flujo de Admin).
  const rAff = mockRes();
  await AffiliateAdminController.createAffiliate(
    mockReq({
      user: adminUser,
      body: {
        fullName: 'Afiliado Demo',
        email: AFFILIATE_EMAIL,
        phone: '+525555123456',
        country: 'MX',
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

  // Fijar una contraseña conocida para poder iniciar sesión fácilmente.
  await prisma.user.update({
    where: { id: affProfile!.userId },
    data: { password: await hashPassword(AFFILIATE_PASSWORD) }
  });
  console.log(`Afiliado creado: ${AFFILIATE_EMAIL}  código ${affiliateCode}`);

  // 1b) Datos bancarios del afiliado (para que el Admin tenga con qué pagar).
  const affUserCtx = { userId: affProfile!.userId, role: 'AFFILIATE' };
  const rBank = mockRes();
  await AffiliateController.upsertBankAccount(
    mockReq({
      user: affUserCtx,
      body: {
        beneficiaryFullName: 'Afiliado Demo',
        country: 'MX',
        bankName: 'BBVA México',
        clabe: '012345678901234567',
        preferredCurrency: 'MXN',
        additionalInstructions: 'Cuenta de demostración'
      }
    }),
    rBank
  );
  if (rBank.statusCode !== 201) throw new Error(`upsertBankAccount falló: ${JSON.stringify(rBank.body)}`);
  console.log('Datos bancarios del afiliado guardados (CLABE 012345678901234567).');

  // 2) Registrar al doctor usando el código del afiliado.
  const rDoc = mockRes();
  await register(
    mockReq({
      body: {
        email: DOCTOR_EMAIL,
        password: DOCTOR_PASSWORD,
        firstName: 'Doctora',
        lastName: 'Referida',
        role: 'DOCTOR',
        paypalSubscriptionId: DEMO_SUB_ID,
        paypalPlanId: DEMO_PLAN_ID,
        affiliateCode,
        specialty: 'Medicina General',
        licenseNumber: `DEMO-LIC-${Date.now()}`
      }
    }),
    rDoc
  );
  if (rDoc.statusCode !== 201) throw new Error(`register doctor falló: ${JSON.stringify(rDoc.body)}`);
  const doctorUserId: string = rDoc.body.user.id;
  console.log(`Doctor registrado con código de afiliado: ${DOCTOR_EMAIL}`);

  const referral = await prisma.affiliateReferral.findUnique({ where: { doctorUserId } });
  if (!referral) throw new Error('No se creó el AffiliateReferral del doctor.');
  console.log(`Referral vinculado: status=${referral.status}  códigoUsado=${referral.affiliateCodeUsed}`);

  // 3) Generar comisiones reales (3 pagos mensuales) con la lógica de producción.
  const base = new Date();
  for (let m = 1; m <= MONTHS_TO_GENERATE; m += 1) {
    const when = new Date(base.getFullYear(), base.getMonth() - (MONTHS_TO_GENERATE - m), 5, 12, 0, 0);
    await processPaymentForCommission(paypalPaymentEvent(`PAY-DEMO-AFF-${m}`, DEMO_SUB_ID, when));
  }

  const commissions = await prisma.affiliateCommission.findMany({
    where: { affiliateId: affiliate.id },
    orderBy: { commissionMonthNumber: 'asc' }
  });
  const totalPorPagar = commissions
    .filter((c) => c.status === 'PENDING' || c.status === 'APPROVED')
    .reduce((acc, c) => acc + Number(c.commissionAmount), 0);

  // ----- Resumen -----
  console.log('\n================== RESUMEN DEMO ==================');
  console.log('AFILIADO (dashboard exclusivo de su info):');
  console.log(`  Login:     ${AFFILIATE_EMAIL}`);
  console.log(`  Password:  ${AFFILIATE_PASSWORD}`);
  console.log(`  Código:    ${affiliateCode}`);
  console.log('  Banco:     BBVA México · CLABE 012345678901234567 · MXN');
  console.log('\nDOCTOR REFERIDO (se registró con el código del afiliado):');
  console.log(`  Login:     ${DOCTOR_EMAIL}`);
  console.log(`  Password:  ${DOCTOR_PASSWORD}`);
  console.log(`  Suscripción PayPal: ${DEMO_SUB_ID}`);
  console.log('\nCOMISIONES GENERADAS (sobre base SIN IVA):');
  for (const c of commissions) {
    console.log(
      `  Mes ${c.commissionMonthNumber}: bruto ${Number(c.paymentAmountGross)} ${c.currency} | ` +
      `base sin IVA ${Number(c.paymentAmountNet)} | ${Number(c.commissionPercentage)}% = ` +
      `${Number(c.commissionAmount)} ${c.currency} | estatus ${c.status}`
    );
  }
  console.log(`\n  TOTAL POR PAGAR (PENDING/APPROVED): ${totalPorPagar.toFixed(2)} ${PAYMENT_CURRENCY}`);
  console.log('=================================================\n');
  console.log('Revisa en Admin → Afiliados (Comisiones) y en el dashboard del afiliado.');

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error('ERROR EN SEED DEMO:', e);
  await prisma.$disconnect();
  process.exit(1);
});
