/**
 * QA end-to-end del módulo de Afiliados Comerciales.
 * Ejecuta el flujo completo contra la BD de desarrollo, ejercitando los
 * controladores/servicios reales en proceso (sin servidor HTTP) con req/res simulados.
 *
 * Ejecutar:  npx ts-node scripts/qa-affiliates.ts
 */
import prisma from '../src/config/database';
import { NotificationService } from '../src/services/notification.service';
import { register } from '../src/controllers/auth.controller';
import { AffiliateAdminController } from '../src/controllers/affiliateAdmin.controller';
import { AffiliateController } from '../src/controllers/affiliate.controller';
import {
  processPaymentForCommission,
  reverseCommissionForRefund
} from '../src/services/affiliate.service';
import ExcelJS from 'exceljs';

// Evitar envíos SMTP durante el QA.
(NotificationService as any).sendWelcomeEmail = async () => {};
(NotificationService as any).sendNewUserConsentToUser = async () => {};
(NotificationService as any).sendNewUserConsentToLegal = async () => {};

const RUN = Date.now();
const tag = (s: string) => `qa-${s}-${RUN}@qa.test`;

let pass = 0;
let fail = 0;
const failed: string[] = [];
function check(label: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${label}`);
  } else {
    fail += 1;
    failed.push(label);
    console.log(`  FAIL  ${label}${extra !== undefined ? `  -> ${JSON.stringify(extra)}` : ''}`);
  }
}
const approx = (a: number, b: number, eps = 0.005) => Math.abs(a - b) < eps;
const section = (t: string) => console.log(`\n=== ${t} ===`);

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

function paypalPaymentEvent(id: string, subId: string, total = '499.00', currency = 'MXN') {
  return {
    id: `EVT-${id}`,
    event_type: 'PAYMENT.SALE.COMPLETED',
    resource: {
      id,
      billing_agreement_id: subId,
      amount: { total, currency },
      create_time: new Date().toISOString()
    }
  };
}

/** Limpieza robusta por patrón (el módulo es nuevo en dev: todo lo 'qa-*@qa.test' es de pruebas). */
async function cleanupAll() {
  try {
    const qaUsers = await prisma.user.findMany({
      where: { email: { startsWith: 'qa-', endsWith: '@qa.test' } },
      select: { id: true }
    });
    const ids = qaUsers.map((u) => u.id);
    const profs = await prisma.affiliateProfile.findMany({
      where: { OR: [{ userId: { in: ids } }, { email: { startsWith: 'qa-aff', endsWith: '@qa.test' } }] },
      select: { id: true }
    });
    const profIds = profs.map((p) => p.id);
    await prisma.affiliateCommission.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateReferral.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateBankAccount.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateProfile.deleteMany({ where: { id: { in: profIds } } });
    const docs = await prisma.doctor.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    for (const d of docs) {
      await prisma.subscription.deleteMany({ where: { doctorId: d.id } }).catch(() => {});
      await prisma.doctor.delete({ where: { id: d.id } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    // Códigos de pool sin asignar (en dev solo provienen de QA porque el módulo es nuevo).
    await prisma.affiliateCode.deleteMany({ where: { status: 'AVAILABLE', affiliateId: null } }).catch(() => {});
  } catch (e) {
    console.log('  cleanupAll parcial:', (e as Error).message);
  }
}

async function runTests() {
  const createdUserIds: string[] = [];
  const createdAffiliateIds: string[] = [];
  const createdDoctorIds: string[] = [];
  const batchIds: string[] = [];

  // --- Admin de pruebas ---
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: { email: tag('admin'), password: 'x', role: 'ADMIN', firstName: 'QA', lastName: 'Admin' }
    });
    createdUserIds.push(admin.id);
  }
  const adminUser = { userId: admin.id, role: 'ADMIN' };

  // ============================================================
  section('0. Configuración de regla (30% / 6 meses / IVA 0.16)');
  {
    const res = mockRes();
    await AffiliateAdminController.upsertCommissionRule(
      mockReq({ user: adminUser, body: { name: 'QA Rule', commissionPercentage: 30, commissionMonths: 6, vatRate: 0.16, freeMonthsForDoctor: 1, graceDaysForDoctor: 15 } }),
      res
    );
    check('upsert regla responde success', res.body?.success === true, res.body);
    const rule = await prisma.affiliateCommissionRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    check('regla activa con 30% / 6 / 0.16', !!rule && Number(rule.commissionPercentage) === 30 && rule.commissionMonths === 6 && Number(rule.vatRate) === 0.16, rule);
  }

  // ============================================================
  section('a.2 / a.1  Crear afiliados + unicidad de códigos');
  let aff1: any, aff2: any;
  {
    const r1 = mockRes();
    await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Afiliado Uno', email: tag('aff1'), phone: '5550000001', country: 'MX', commissionPercentage: 30, commissionMonths: 6 } }), r1);
    check('createAffiliate 201', r1.statusCode === 201, r1.body);
    check('devuelve contraseña temporal', typeof r1.body?.data?.tempPassword === 'string' && r1.body.data.tempPassword.length >= 8);
    aff1 = r1.body.data;
    check('código con formato QLX-AF-XXXXXX', /^QLX-AF-[A-Z0-9]{6}$/.test(aff1.affiliateCode || ''), aff1.affiliateCode);

    const prof1 = await prisma.affiliateProfile.findUnique({ where: { id: aff1.id }, include: { user: true } });
    createdAffiliateIds.push(prof1!.id);
    createdUserIds.push(prof1!.userId);
    check('usuario creado con rol AFFILIATE', prof1?.user.role === 'AFFILIATE');
    check('porcentaje 30 y meses 6 en perfil', Number(prof1?.defaultCommissionPercentage) === 30 && prof1?.defaultCommissionMonths === 6);

    const r2 = mockRes();
    await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Afiliado Dos', email: tag('aff2'), country: 'MX' } }), r2);
    aff2 = r2.body.data;
    const prof2 = await prisma.affiliateProfile.findUnique({ where: { id: aff2.id } });
    createdAffiliateIds.push(prof2!.id);
    createdUserIds.push(prof2!.userId);
    check('códigos de afiliados distintos', aff1.affiliateCode !== aff2.affiliateCode);

    // Email duplicado rechazado
    const rDup = mockRes();
    await AffiliateAdminController.createAffiliate(mockReq({ user: adminUser, body: { fullName: 'Dup', email: tag('aff1') } }), rDup);
    check('createAffiliate rechaza email duplicado (400)', rDup.statusCode === 400, rDup.body);

    // Lote de códigos + unicidad
    const rb = mockRes();
    await AffiliateAdminController.generateCodesBatch(mockReq({ user: adminUser, body: { count: 50 } }), rb);
    check('genera lote 50 códigos', rb.body?.data?.created === 50, rb.body);
    batchIds.push(rb.body?.data?.batchId);
    const batchId = rb.body?.data?.batchId;
    const codes = await prisma.affiliateCode.findMany({ where: { batchId } });
    const uniqueInBatch = new Set(codes.map((c) => c.code)).size;
    check('50 códigos únicos en el lote', uniqueInBatch === 50, { uniqueInBatch, total: codes.length });
    // Unicidad global (constraint): intentar duplicar uno debe fallar
    let dupBlocked = false;
    try {
      await prisma.affiliateCode.create({ data: { code: codes[0].code } });
    } catch { dupBlocked = true; }
    check('constraint @unique bloquea código repetido', dupBlocked);
  }

  // ============================================================
  section('a.5  Registro del profesional con código de afiliado');
  let doc1UserId = '';
  let doc1ReferralCode = '';
  let doc1SubId = `QA-SUB-1-${RUN}`;
  {
    const res = mockRes();
    await register(mockReq({ body: {
      email: tag('doc1'), password: 'secret123', firstName: 'Doctor', lastName: 'Uno', role: 'DOCTOR',
      paypalSubscriptionId: doc1SubId, paypalPlanId: 'P-PLAN-499', affiliateCode: aff1.affiliateCode,
      specialty: 'Cardiología', licenseNumber: `QA-LIC-1-${RUN}`
    } }), res);
    check('registro doctor 201', res.statusCode === 201, res.body);
    doc1UserId = res.body?.user?.id;
    createdUserIds.push(doc1UserId);

    const doctor = await prisma.doctor.findUnique({ where: { userId: doc1UserId } });
    if (doctor) { createdDoctorIds.push(doctor.id); doc1ReferralCode = doctor.referralCode || ''; }

    const referral = await prisma.affiliateReferral.findUnique({ where: { doctorUserId: doc1UserId } });
    check('AffiliateReferral creado y vinculado', !!referral && referral.affiliateId === aff1.id, referral);
    check('status inicial REGISTERED', referral?.status === 'REGISTERED');
    check('trialDaysGranted = 45', referral?.trialDaysGranted === 45);
    check('affiliateCodeUsed correcto', referral?.affiliateCodeUsed === aff1.affiliateCode);

    const sub = await prisma.subscription.findFirst({ where: { paypalSubscriptionId: doc1SubId } });
    const days = sub ? Math.round((sub.endDate.getTime() - sub.startDate.getTime()) / 86400000) : 0;
    check('primer ciclo PayPal = 45 días (1 mes + 15 gracia)', days === 45, { days });
  }

  // Rechazos de registro
  {
    // código inválido
    const r1 = mockRes();
    await register(mockReq({ body: { email: tag('docbad'), password: 'secret123', firstName: 'D', lastName: 'Bad', role: 'DOCTOR', paypalSubscriptionId: `QA-SUB-BAD-${RUN}`, affiliateCode: 'QLX-AF-ZZZ999' } }), r1);
    check('rechaza código de afiliado inválido (400)', r1.statusCode === 400, r1.body);

    // exclusividad: código de afiliado + código de referido-doctor
    const r2 = mockRes();
    await register(mockReq({ body: { email: tag('docexcl'), password: 'secret123', firstName: 'D', lastName: 'Excl', role: 'DOCTOR', paypalSubscriptionId: `QA-SUB-EXCL-${RUN}`, affiliateCode: aff1.affiliateCode, referrerInviteCode: doc1ReferralCode } }), r2);
    check('rechaza afiliado + referido simultáneos (400)', r2.statusCode === 400, r2.body);

    // afiliado suspendido
    await prisma.affiliateProfile.update({ where: { id: aff2.id }, data: { status: 'SUSPENDED' } });
    const r3 = mockRes();
    await register(mockReq({ body: { email: tag('docsusp'), password: 'secret123', firstName: 'D', lastName: 'Susp', role: 'DOCTOR', paypalSubscriptionId: `QA-SUB-SUSP-${RUN}`, affiliateCode: aff2.affiliateCode } }), r3);
    check('rechaza afiliado SUSPENDED (400)', r3.statusCode === 400, r3.body);
    await prisma.affiliateProfile.update({ where: { id: aff2.id }, data: { status: 'ACTIVE' } });

    // limpieza de usuarios que sí se crearon en intentos fallidos (el rechazo ocurre tras crear el User)
    for (const em of [tag('docbad'), tag('docexcl'), tag('docsusp')]) {
      const u = await prisma.user.findUnique({ where: { email: em } });
      if (u) createdUserIds.push(u.id);
    }
  }

  // ============================================================
  section('a.3 / a.4 / a.10  Generación de comisión y cálculo sin IVA');
  {
    await processPaymentForCommission(paypalPaymentEvent('QA-PAY-1', doc1SubId));
    const c = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-1' } });
    check('comisión generada para el pago', !!c, c);
    check('paymentAmountGross = 499', !!c && Number(c.paymentAmountGross) === 499);
    check('a.10 base SIN IVA = 430.17 (499/1.16)', !!c && approx(Number(c.paymentAmountNet), 430.17), c && Number(c.paymentAmountNet));
    check('a.4 comisión = 129.05 (430.17 * 30%)', !!c && approx(Number(c.commissionAmount), 129.05), c && Number(c.commissionAmount));
    check('a.10 comisión NO es 149.70 (sobre 499 con IVA)', !!c && !approx(Number(c.commissionAmount), 149.7));
    check('estatus inicial PENDING', c?.status === 'PENDING');
    check('mes de comisión = 1', c?.commissionMonthNumber === 1);
    check('trace de cálculo guardado', !!c?.calculationTraceJson && (c!.calculationTraceJson as any).netBase === 430.17, c?.calculationTraceJson);

    const ref = await prisma.affiliateReferral.findUnique({ where: { doctorUserId: doc1UserId } });
    check('referral pasa a ACTIVE_PAID', ref?.status === 'ACTIVE_PAID');
    check('firstPaymentDate establecida', !!ref?.firstPaymentDate);
  }

  // ============================================================
  section('Idempotencia: reenvío del mismo pago no duplica comisión');
  {
    await processPaymentForCommission(paypalPaymentEvent('QA-PAY-1', doc1SubId));
    const count = await prisma.affiliateCommission.count({ where: { paypalPaymentId: 'QA-PAY-1' } });
    check('sigue habiendo 1 sola comisión para QA-PAY-1', count === 1, { count });
  }

  // ============================================================
  section('Duración de comisión: solo 6 meses por doctor');
  {
    for (let i = 2; i <= 7; i += 1) {
      await processPaymentForCommission(paypalPaymentEvent(`QA-PAY-${i}`, doc1SubId));
    }
    const total = await prisma.affiliateCommission.count({ where: { doctorUserId: doc1UserId } });
    check('máximo 6 comisiones por doctor (7º pago no comisiona)', total === 6, { total });
    const pay7 = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-7' } });
    check('el 7º pago no generó comisión', pay7 === null);
    const pay6 = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-6' } });
    check('mes de comisión llega a 6', pay6?.commissionMonthNumber === 6, pay6?.commissionMonthNumber);
  }

  // ============================================================
  section('a.6  Robustez webhook: suscripción desconocida / sin monto');
  {
    await processPaymentForCommission(paypalPaymentEvent('QA-PAY-UNKNOWN', `NO-EXISTE-${RUN}`));
    const c = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-UNKNOWN' } });
    check('pago de suscripción desconocida no genera comisión ni lanza', c === null);
  }

  // ============================================================
  section('Reembolsos: REVERSED si pagada, CANCELLED si pendiente');
  {
    // Marcar QA-PAY-1 como PAGADA por admin, luego reembolsar -> REVERSED
    const c1 = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-1' } });
    const rp = mockRes();
    await AffiliateAdminController.markCommissionPaid(mockReq({ user: adminUser, params: { id: c1!.id } }), rp);
    check('markCommissionPaid success', rp.body?.success === true, rp.body);
    const paid = await prisma.affiliateCommission.findUnique({ where: { id: c1!.id } });
    check('comisión queda PAID con paidAt y paidByAdminUserId', paid?.status === 'PAID' && !!paid?.paidAt && paid?.paidByAdminUserId === admin!.id);

    await reverseCommissionForRefund({ resource: { id: 'QA-REF-1', sale_id: 'QA-PAY-1' } });
    const reversed = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-1' } });
    check('comisión pagada -> REVERSED tras refund', reversed?.status === 'REVERSED');

    // QA-PAY-2 está PENDING -> refund -> CANCELLED
    await reverseCommissionForRefund({ resource: { id: 'QA-REF-2', sale_id: 'QA-PAY-2' } });
    const cancelled = await prisma.affiliateCommission.findUnique({ where: { paypalPaymentId: 'QA-PAY-2' } });
    check('comisión pendiente -> CANCELLED tras refund', cancelled?.status === 'CANCELLED');
  }

  // ============================================================
  section('a.2 / a.7  Datos bancarios del afiliado (MX y validación)');
  const aff1User = { userId: (await prisma.affiliateProfile.findUnique({ where: { id: aff1.id } }))!.userId, role: 'AFFILIATE' };
  {
    // CLABE inválida -> 400
    const rBad = mockRes();
    await AffiliateController.upsertBankAccount(mockReq({ user: aff1User, body: { beneficiaryFullName: 'Afiliado Uno', country: 'MX', bankName: 'BBVA', clabe: '123' } }), rBad);
    check('CLABE inválida rechazada (400)', rBad.statusCode === 400 && Array.isArray(rBad.body?.errors), rBad.body);

    // CLABE válida -> 201
    const rOk = mockRes();
    await AffiliateController.upsertBankAccount(mockReq({ user: aff1User, body: { beneficiaryFullName: 'Afiliado Uno', country: 'MX', bankName: 'BBVA', clabe: '012345678901234567' } }), rOk);
    check('datos bancarios MX válidos guardados (201)', rOk.statusCode === 201, rOk.body);

    const rGet = mockRes();
    await AffiliateController.getMyBankAccount(mockReq({ user: aff1User }), rGet);
    check('puede recuperar su cuenta bancaria activa', rGet.body?.data?.clabe === '012345678901234567', rGet.body?.data);

    // Reemplazo (LATAM) -> desactiva la anterior, solo 1 activa
    const rLat = mockRes();
    await AffiliateController.upsertBankAccount(mockReq({ user: aff1User, body: { beneficiaryFullName: 'Afiliado Uno', country: 'US', bankName: 'Chase', accountNumber: '987654321', preferredCurrency: 'USD', swiftBic: 'CHASUS33' } }), rLat);
    check('datos bancarios LATAM/US válidos guardados (201)', rLat.statusCode === 201, rLat.body);
    const activeCount = await prisma.affiliateBankAccount.count({ where: { affiliateId: aff1.id, isActive: true } });
    check('solo 1 cuenta bancaria activa tras reemplazo', activeCount === 1, { activeCount });
  }

  // ============================================================
  section('a.8  Aislamiento del dashboard del afiliado');
  let doc2SubId = `QA-SUB-2-${RUN}`;
  {
    // Registrar doctor2 con código de aff2 y generar su comisión
    const rReg = mockRes();
    await register(mockReq({ body: { email: tag('doc2'), password: 'secret123', firstName: 'Doctor', lastName: 'Dos', role: 'DOCTOR', paypalSubscriptionId: doc2SubId, affiliateCode: aff2.affiliateCode, licenseNumber: `QA-LIC-2-${RUN}` } }), rReg);
    check('registro doctor2 201', rReg.statusCode === 201, rReg.body);
    const doc2UserId = rReg.body?.user?.id;
    if (doc2UserId) {
      createdUserIds.push(doc2UserId);
      const d2 = await prisma.doctor.findUnique({ where: { userId: doc2UserId } });
      if (d2) createdDoctorIds.push(d2.id);
    }
    await processPaymentForCommission(paypalPaymentEvent('QA-PAY-D2-1', doc2SubId));

    const aff2User = { userId: (await prisma.affiliateProfile.findUnique({ where: { id: aff2.id } }))!.userId, role: 'AFFILIATE' };

    // affiliate1 ve solo lo suyo
    const r1ref = mockRes(); await AffiliateController.getMyReferrals(mockReq({ user: aff1User }), r1ref);
    const r1com = mockRes(); await AffiliateController.getMyCommissions(mockReq({ user: aff1User }), r1com);
    const aff1RefDoctors = (r1ref.body?.data || []).map((r: any) => r.doctorEmail);
    check('afiliado1 NO ve referidos de afiliado2', !aff1RefDoctors.includes(tag('doc2')), aff1RefDoctors);
    check('afiliado1 ve su referido doctor1', aff1RefDoctors.includes(tag('doc1')));
    check('afiliado1 ve sus 6 comisiones (incluye reversadas/canceladas)', (r1com.body?.data || []).length === 6, (r1com.body?.data || []).length);

    // affiliate2 ve solo lo suyo
    const r2ref = mockRes(); await AffiliateController.getMyReferrals(mockReq({ user: aff2User }), r2ref);
    const r2com = mockRes(); await AffiliateController.getMyCommissions(mockReq({ user: aff2User }), r2com);
    const aff2RefDoctors = (r2ref.body?.data || []).map((r: any) => r.doctorEmail);
    check('afiliado2 solo ve a doctor2', aff2RefDoctors.length === 1 && aff2RefDoctors[0] === tag('doc2'), aff2RefDoctors);
    check('afiliado2 solo ve su comisión (1)', (r2com.body?.data || []).length === 1, (r2com.body?.data || []).length);

    // Dashboard explica base sin IVA
    const rDash = mockRes(); await AffiliateController.getMyDashboard(mockReq({ user: aff1User }), rDash);
    const d = rDash.body?.data;
    check('dashboard: base sin IVA 430.17 y comisión 129.05', approx(d?.baseExplanation?.net, 430.17) && approx(d?.baseExplanation?.commission, 129.05), d?.baseExplanation);
    check('dashboard: cuenta médicos registrados (1)', d?.totalReferrals === 1, d?.totalReferrals);
    check('dashboard: cuenta médicos con primer pago (1)', d?.payingReferrals === 1, d?.payingReferrals);
  }

  // ============================================================
  section('a.9  Reporte para el administrador (lista + Excel)');
  {
    const rList = mockRes();
    await AffiliateAdminController.listCommissions(mockReq({ user: adminUser }), rList);
    check('listCommissions devuelve filas y totales', Array.isArray(rList.body?.data) && Array.isArray(rList.body?.totals), rList.body?.totals);
    const totalsHasReversed = (rList.body?.totals || []).some((t: any) => t.status === 'REVERSED');
    check('totales por estatus incluyen REVERSED', totalsHasReversed, rList.body?.totals);

    const rExp = mockRes();
    await AffiliateAdminController.exportCommissionsExcel(mockReq({ user: adminUser, query: {} }), rExp);
    check('export Excel responde con buffer xlsx', Buffer.isBuffer(rExp.sent) && rExp.sent.length > 0 && /spreadsheetml/.test(rExp.headers['Content-Type'] || ''));

    // Parsear el Excel y verificar columnas + datos para pago
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(rExp.sent);
    const ws = wb.getWorksheet('Comisiones');
    const headerRow = ws?.getRow(1);
    const headerCount = headerRow ? (headerRow.values as any[]).filter((v) => v != null).length : 0;
    check('Excel tiene ~30 columnas de trazabilidad', headerCount >= 28, { headerCount });

    // Buscar fila de la comisión pagada/reversada de afiliado1 y validar columnas clave
    const headers = (headerRow!.values as any[]).map((v) => (v == null ? '' : String(v)));
    const colIdx = (name: string) => headers.findIndex((h) => h === name);
    const idxNet = colIdx('Base sin IVA');
    const idxCom = colIdx('Importe comisión');
    const idxClabe = colIdx('CLABE');
    const idxBenef = colIdx('Beneficiario');
    const idxPaidBy = colIdx('Usuario admin que marcó pagada');
    let foundNet = false, foundClabeOrBenef = false, foundPaidBy = false;
    ws?.eachRow((row, n) => {
      if (n === 1) return;
      const net = Number(row.getCell(idxNet).value);
      if (approx(net, 430.17)) foundNet = true;
      const clabe = String(row.getCell(idxClabe).value || '');
      const benef = String(row.getCell(idxBenef).value || '');
      if (clabe || benef) foundClabeOrBenef = true;
      const paidBy = String(row.getCell(idxPaidBy).value || '');
      if (paidBy) foundPaidBy = true;
    });
    check('Excel: base sin IVA 430.17 presente para verificar cálculo', foundNet);
    check('Excel: datos de pago (CLABE/Beneficiario) presentes', foundClabeOrBenef);
    check('Excel: registra qué admin marcó pagada', foundPaidBy);
  }

  void createdUserIds; void createdAffiliateIds; void createdDoctorIds; void batchIds;
}

async function main() {
  console.log(`\n###### QA AFILIADOS  (run ${RUN}) ######`);
  await cleanupAll(); // purgar posibles fugas de corridas previas
  try {
    await runTests();
  } finally {
    section('Limpieza de datos de QA');
    await cleanupAll();
    console.log('  limpieza completada (best-effort)');
  }

  console.log(`\n###### RESULTADO: ${pass} PASS / ${fail} FAIL ######`);
  if (fail > 0) {
    console.log('Fallidas:');
    failed.forEach((f) => console.log(' -', f));
  }
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('ERROR FATAL EN QA:', e);
  await prisma.$disconnect();
  process.exit(2);
});
