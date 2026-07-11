/**
 * QA de la "capacidad afiliado" (Opción B): un usuario existente (p. ej. paciente)
 * puede además ser afiliado, sin cambiar su rol ni su contraseña.
 *
 * Verifica:
 *  1) createAffiliate vincula AffiliateProfile a un PATIENT existente (sin tempPassword, rol intacto).
 *  2) Reintento con el mismo email -> 400 "ya es afiliado".
 *  3) Un DOCTOR existente queda bloqueado (decisión diferida).
 *  4) El guard requireAffiliateAccess permite al paciente-afiliado y rechaza a quien no tiene perfil.
 *  5) El dashboard del afiliado funciona para un usuario con rol PATIENT.
 *  6) Aislamiento: el paciente-afiliado solo ve sus referidos/comisiones.
 *
 * Ejecutar:  npx ts-node scripts/qa-affiliate-capability.ts
 */
import prisma from '../src/config/database';
import bcrypt from 'bcryptjs';
import { generateToken } from '../src/utils/jwt.utils';
import { requireAffiliateAccess } from '../src/middlewares/auth.middleware';
import { AffiliateAdminController } from '../src/controllers/affiliateAdmin.controller';
import { AffiliateController } from '../src/controllers/affiliate.controller';
import { register } from '../src/controllers/auth.controller';
import { processPaymentForCommission } from '../src/services/affiliate.service';
import { NotificationService } from '../src/services/notification.service';

(NotificationService as any).sendWelcomeEmail = async () => {};
(NotificationService as any).sendNewUserConsentToUser = async () => {};
(NotificationService as any).sendNewUserConsentToLegal = async () => {};

const RUN = Date.now();
const tag = (s: string) => `cap-${s}-${RUN}@qa.test`;

let pass = 0;
let fail = 0;
const failed: string[] = [];
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) { pass += 1; console.log(`  PASS  ${label}`); }
  else { fail += 1; failed.push(label); console.log(`  FAIL  ${label}${extra !== undefined ? `  -> ${JSON.stringify(extra)}` : ''}`); }
}
const section = (t: string) => console.log(`\n=== ${t} ===`);

function mockReq(opts: { body?: any; params?: any; query?: any; user?: any } = {}) {
  return { body: opts.body || {}, params: opts.params || {}, query: opts.query || {}, user: opts.user, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' }, headers: {} } as any;
}
function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.setHeader = () => res;
  res.send = (b: any) => { res.sent = b; return res; };
  return res;
}

/** Ejecuta el guard requireAffiliateAccess y resuelve si dejó pasar (next) o respondió. */
function runGuard(token?: string): Promise<{ allowed: boolean; status: number; body: any }> {
  return new Promise((resolve) => {
    const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res: any = { statusCode: 200 };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { resolve({ allowed: false, status: res.statusCode, body: b }); return res; };
    requireAffiliateAccess(req, res, () => resolve({ allowed: true, status: 200, body: null }));
  });
}

const paypalPaymentEvent = (id: string, subId: string) => ({
  id: `EVT-${id}`, event_type: 'PAYMENT.SALE.COMPLETED',
  resource: { id, billing_agreement_id: subId, amount: { total: '499.00', currency: 'MXN' }, create_time: new Date().toISOString() }
});

const createdUserIds: string[] = [];

async function deleteUserDeep(userId: string) {
  await prisma.affiliateCommission.deleteMany({ where: { doctorUserId: userId } });
  await prisma.affiliateReferral.deleteMany({ where: { doctorUserId: userId } });
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (doctor) {
    await prisma.subscription.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.promoRedemption.deleteMany({ where: { doctorId: doctor.id } });
    await prisma.doctor.delete({ where: { id: doctor.id } });
  }
  const prof = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (prof) await prisma.affiliateCode.updateMany({ where: { affiliateId: prof.id }, data: { affiliateId: null, status: 'AVAILABLE' } });
  await prisma.consentHistory.deleteMany({ where: { userId } });
  await prisma.patient.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { startsWith: 'cap-', endsWith: '@qa.test' } }, select: { id: true } });
  for (const u of users) await deleteUserDeep(u.id);
}

async function run() {
  // Admin para acciones administrativas.
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No hay ADMIN en la BD.');
  const adminUser = { userId: admin.id, role: 'ADMIN' };

  // --- Paciente existente (con contraseña conocida) ---
  section('Preparación: paciente existente');
  const patientPwd = 'Paciente123!';
  const patientUser = await prisma.user.create({
    data: { email: tag('pac'), password: await bcrypt.hash(patientPwd, 10), role: 'PATIENT', firstName: 'Paco', lastName: 'Paciente' }
  });
  createdUserIds.push(patientUser.id);
  await prisma.patient.create({
    data: { userId: patientUser.id, firstName: 'Paco', lastName: 'Paciente', dataConsent: true, dateOfBirth: new Date('1990-01-01'), gender: 'M' }
  });
  check('paciente creado con rol PATIENT', patientUser.role === 'PATIENT');

  // 1) Vincular como afiliado
  section('1) createAffiliate vincula a la cuenta PATIENT existente');
  // Capturar códigos disponibles del lote ANTES de crear (para verificar auto-consumo).
  const availBefore = await prisma.affiliateCode.findMany({ where: { status: 'AVAILABLE', affiliateId: null }, select: { code: true } });
  const availSet = new Set(availBefore.map((c) => c.code));
  const r1 = mockRes();
  await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Paco Paciente', email: tag('pac'), country: 'MX' } }), r1);
  check('createAffiliate 201', r1.statusCode === 201, r1.body);
  check('linkedToExisting = true', r1.body?.data?.linkedToExisting === true, r1.body?.data);
  check('NO devuelve tempPassword (usa su contraseña actual)', r1.body?.data?.tempPassword == null);
  const affCode: string = r1.body?.data?.affiliateCode;

  const profile = await prisma.affiliateProfile.findUnique({ where: { userId: patientUser.id } });
  check('AffiliateProfile vinculado al MISMO userId', !!profile && profile.userId === patientUser.id);
  const stillPatient = await prisma.user.findUnique({ where: { id: patientUser.id } });
  check('el rol del usuario sigue siendo PATIENT', stillPatient?.role === 'PATIENT', stillPatient?.role);
  const samePwd = await bcrypt.compare(patientPwd, stillPatient!.password);
  check('la contraseña del paciente NO cambió', samePwd === true);

  // 1b) Auto-consumo del lote (sin código manual)
  section('1b) Auto-consumo del lote de códigos');
  const usedPoolCode = await prisma.affiliateCode.findUnique({ where: { code: affCode } });
  if (availSet.size > 0) {
    check('el código asignado proviene del lote disponible', availSet.has(affCode), affCode);
    check('el código del lote quedó ASSIGNED y ligado al afiliado', usedPoolCode?.status === 'ASSIGNED' && usedPoolCode?.affiliateId === profile?.id, { status: usedPoolCode?.status, affiliateId: usedPoolCode?.affiliateId });
  } else {
    check('sin lote disponible: se generó un código nuevo con formato', /^QLX-AF-[A-Z0-9]+$/.test(affCode) && !usedPoolCode, affCode);
  }

  // 2) Reintento -> ya es afiliado
  section('2) Reintento con el mismo email');
  const r2 = mockRes();
  await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Paco Paciente', email: tag('pac'), country: 'MX' } }), r2);
  check('rechaza con 400 (ya es afiliado)', r2.statusCode === 400 && /ya es afiliado/i.test(r2.body?.message || ''), r2.body);

  // 3) Doctor bloqueado (diferido)
  section('3) Un DOCTOR existente queda bloqueado');
  const docUser = await prisma.user.create({
    data: { email: tag('doc-existing'), password: await bcrypt.hash('x', 10), role: 'DOCTOR', firstName: 'Dora', lastName: 'Doctora' }
  });
  createdUserIds.push(docUser.id);
  const r3 = mockRes();
  await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Dora Doctora', email: tag('doc-existing'), country: 'MX' } }), r3);
  check('rechaza DOCTOR con 400 (pendiente de definir)', r3.statusCode === 400 && /doctor/i.test(r3.body?.message || ''), r3.body);

  // 4) Guard requireAffiliateAccess
  section('4) Guard requireAffiliateAccess');
  const patientToken = generateToken({ userId: patientUser.id, role: 'PATIENT' });
  const gAllowed = await runGuard(patientToken);
  check('paciente CON perfil de afiliado: ACCESO permitido', gAllowed.allowed === true, gAllowed);

  const otherPatient = await prisma.user.create({
    data: { email: tag('pac2'), password: await bcrypt.hash('x', 10), role: 'PATIENT', firstName: 'Sin', lastName: 'Afiliado' }
  });
  createdUserIds.push(otherPatient.id);
  const otherToken = generateToken({ userId: otherPatient.id, role: 'PATIENT' });
  const gDenied = await runGuard(otherToken);
  check('paciente SIN perfil de afiliado: 403', gDenied.allowed === false && gDenied.status === 403, gDenied);
  const gNoToken = await runGuard(undefined);
  check('sin token: 401', gNoToken.allowed === false && gNoToken.status === 401, gNoToken);

  // 5) Dashboard del afiliado con rol PATIENT
  section('5) Dashboard del afiliado funciona con rol PATIENT');
  const patientAffCtx = { userId: patientUser.id, role: 'PATIENT' };
  const rDash = mockRes();
  await AffiliateController.getMyDashboard(mockReq({ user: patientAffCtx }), rDash);
  check('getMyDashboard responde con datos del afiliado', rDash.body?.success === true && !!rDash.body?.data, rDash.body);

  // 6) Aislamiento: registrar doctor con su código, generar comisión y verificar visibilidad
  section('6) Aislamiento de datos');
  const subId = `CAP-SUB-${RUN}`;
  const rReg = mockRes();
  await register(mockReq({ body: { email: tag('docref'), password: 'secret123', firstName: 'Doc', lastName: 'Ref', role: 'DOCTOR', paypalSubscriptionId: subId, paypalPlanId: 'P-499', affiliateCode: affCode, specialty: 'MG', licenseNumber: `CAP-LIC-${RUN}` } }), rReg);
  check('doctor referido registrado (201)', rReg.statusCode === 201, rReg.body);
  if (rReg.body?.user?.id) createdUserIds.push(rReg.body.user.id);
  await processPaymentForCommission(paypalPaymentEvent(`CAP-PAY-${RUN}`, subId));

  // Segundo afiliado (puro) + su referido, para comprobar aislamiento.
  const rAff2 = mockRes();
  await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Otro Afiliado', email: tag('aff2'), country: 'MX' } }), rAff2);
  createdUserIds.push((await prisma.affiliateProfile.findUnique({ where: { id: rAff2.body.data.id } }))!.userId);
  const sub2 = `CAP-SUB2-${RUN}`;
  const rReg2 = mockRes();
  await register(mockReq({ body: { email: tag('docref2'), password: 'secret123', firstName: 'Doc2', lastName: 'Ref2', role: 'DOCTOR', paypalSubscriptionId: sub2, paypalPlanId: 'P-499', affiliateCode: rAff2.body.data.affiliateCode, specialty: 'MG', licenseNumber: `CAP-LIC2-${RUN}` } }), rReg2);
  if (rReg2.body?.user?.id) createdUserIds.push(rReg2.body.user.id);
  await processPaymentForCommission(paypalPaymentEvent(`CAP-PAY2-${RUN}`, sub2));

  const rRefs = mockRes();
  await AffiliateController.getMyReferrals(mockReq({ user: patientAffCtx }), rRefs);
  const refEmails = (rRefs.body?.data || []).map((x: any) => x.doctorEmail);
  check('paciente-afiliado ve su referido', refEmails.includes(tag('docref')), refEmails);
  check('paciente-afiliado NO ve referidos del otro afiliado', !refEmails.includes(tag('docref2')), refEmails);

  const rComs = mockRes();
  await AffiliateController.getMyCommissions(mockReq({ user: patientAffCtx }), rComs);
  check('paciente-afiliado ve exactamente 1 comisión (la suya)', (rComs.body?.data || []).length === 1, (rComs.body?.data || []).length);
}

async function main() {
  console.log(`\n###### QA CAPACIDAD AFILIADO (run ${RUN}) ######`);
  await cleanup();
  try {
    await run();
  } finally {
    section('Limpieza');
    await cleanup();
    console.log('  limpieza completada');
  }
  console.log(`\n###### RESULTADO: ${pass} PASS / ${fail} FAIL ######`);
  if (fail > 0) failed.forEach((f) => console.log(' -', f));
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error('ERROR FATAL:', e); await prisma.$disconnect(); process.exit(2); });
