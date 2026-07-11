/**
 * Smoke test funcional módulo-por-módulo + flujos de registro/enrolamiento.
 * Verifica que nada se haya roto tras el módulo de Afiliados.
 *
 * Requiere backend dev en http://127.0.0.1:3000.
 * Ejecutar:  npx ts-node scripts/qa-smoke-modules.ts
 *
 * Estrategia:
 *  - Flujos de registro: se ejercitan contra el endpoint real POST /api/auth/register
 *    y POST /api/admin/affiliates + POST /api/auth/login.
 *  - Módulos: se generan tokens por rol y se hace GET al endpoint principal que la
 *    página llama al cargar, registrando el status real.
 *  Veredicto:  2xx => PASS | status esperado en negativos => PASS | 4xx inesperado => WARN | 5xx => FAIL
 */
import bcrypt from 'bcryptjs';
import prisma from '../src/config/database';
import { generateToken } from '../src/utils/jwt.utils';

const BASE = 'http://127.0.0.1:3000';
const RUN = Date.now();
const TAG = `qasmoke_${RUN}`;

type Row = { area: string; modulo: string; req: string; status: number | string; verdict: 'PASS' | 'WARN' | 'FAIL'; nota?: string };
const rows: Row[] = [];

function verdictFor(status: number, expect?: number): Row['verdict'] {
  if (expect !== undefined) return status === expect ? 'PASS' : (status >= 500 ? 'FAIL' : 'WARN');
  if (status >= 200 && status < 300) return 'PASS';
  if (status >= 500) return 'FAIL';
  return 'WARN';
}

async function http(method: string, path: string, opts: { token?: string; body?: any; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  let status: number; let json: any = null;
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    status = res.status;
    try { json = await res.json(); } catch { json = null; }
  } catch (e: any) {
    status = -1; json = { error: e.message };
  }
  return { status, json };
}

async function check(area: string, modulo: string, method: string, path: string, opts: { token?: string; body?: any; headers?: Record<string, string>; expect?: number; nota?: string } = {}) {
  const { status, json } = await http(method, path, opts);
  const verdict = verdictFor(typeof status === 'number' ? status : 500, opts.expect);
  let nota = opts.nota;
  if (verdict !== 'PASS' && json && (json.message || json.error)) nota = `${nota ? nota + ' | ' : ''}${json.message || json.error}`;
  rows.push({ area, modulo, req: `${method} ${path}`, status, verdict, nota });
  return { status, json };
}

// ----------------------------------------------------------------------------
async function seedSupportUsers() {
  // Admin (reusar o crear)
  let admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) admin = await prisma.user.create({ data: { email: `${TAG}-admin@qa.test`, password: await bcrypt.hash('Admin123', 10), role: 'ADMIN', firstName: 'QA', lastName: 'Admin' } });
  const adminToken = generateToken({ userId: admin.id, role: 'ADMIN' } as any);

  // Paciente con registro Patient vinculado
  const patientUser = await prisma.user.create({ data: { email: `${TAG}-pat@qa.test`, password: await bcrypt.hash('Pac123456', 10), role: 'PATIENT', firstName: 'Paciente', lastName: 'QA' } });
  await prisma.patient.create({ data: { userId: patientUser.id, firstName: 'Paciente', lastName: 'QA', email: patientUser.email, dataConsent: true, dateOfBirth: new Date('1990-01-01'), gender: 'OTHER' } });
  const patientToken = generateToken({ userId: patientUser.id, role: 'PATIENT' } as any);

  // Asistente (sin vínculo profundo; prueba ligera)
  const asisUser = await prisma.user.create({ data: { email: `${TAG}-asis@qa.test`, password: await bcrypt.hash('Asis123456', 10), role: 'ASISTENTE', firstName: 'Asis', lastName: 'QA' } });
  const asisToken = generateToken({ userId: asisUser.id, role: 'ASISTENTE' } as any);

  // Afiliado para el código de registro de doctor
  const affForCode = await prisma.user.create({ data: { email: `${TAG}-affcode@qa.test`, password: await bcrypt.hash('Afi123456', 10), role: 'AFFILIATE', firstName: 'Cod', lastName: 'Afiliado' } });
  const affCode = `QLX-AF-SMK${String(RUN).slice(-3)}`;
  const affProfile = await prisma.affiliateProfile.create({ data: { userId: affForCode.id, affiliateCode: affCode, fullName: 'Cod Afiliado', email: affForCode.email, country: 'MX', status: 'ACTIVE', defaultCommissionPercentage: 30, defaultCommissionMonths: 6 } });

  return { admin, adminToken, patientToken, asisToken, affCode, affProfileId: affProfile.id };
}

async function registroFlows(ctx: Awaited<ReturnType<typeof seedSupportUsers>>) {
  const AREA = 'Registro/Enrolamiento';

  // 1) Doctor sin código
  const docBody = (extra: any = {}) => ({
    email: `${TAG}-doc${Math.random().toString(36).slice(2, 7)}@qa.test`,
    password: 'Doctor123', firstName: 'Doc', lastName: 'QA', role: 'DOCTOR', phone: '5500000000',
    paypalSubscriptionId: `I-QASMOKE-${RUN}-${Math.random().toString(36).slice(2, 6)}`,
    paypalPlanId: 'P-QASMOKE',
    licenseNumber: `QA-LIC-${RUN}-${Math.random().toString(36).slice(2, 6)}`,
    specialty: 'Medicina General', acceptPrivacy: true, acceptTerms: true,
    ...extra
  });

  const r1 = await check(AREA, 'Registro Doctor (sin código)', 'POST', '/api/auth/register', { body: docBody(), expect: 201 });
  const doctorToken = r1.json?.token as string | undefined;
  const doctorId = r1.json?.user?.doctorId as string | undefined;
  if (!doctorToken) rows.push({ area: AREA, modulo: 'Registro Doctor (sin código)', req: 'token', status: 'NO TOKEN', verdict: 'FAIL' });

  // 2) Doctor con código de afiliado válido -> debe crear AffiliateReferral
  const docEmailAff = `${TAG}-docaff@qa.test`;
  const r2 = await check(AREA, 'Registro Doctor (con código afiliado)', 'POST', '/api/auth/register', { body: docBody({ email: docEmailAff, affiliateCode: ctx.affCode }), expect: 201 });
  const docAffUserId = r2.json?.user?.id as string | undefined;
  // Verificar referral en BD
  if (docAffUserId) {
    const ref = await prisma.affiliateReferral.findFirst({ where: { affiliateId: ctx.affProfileId, doctorUserId: docAffUserId } });
    rows.push({ area: AREA, modulo: 'Vínculo AffiliateReferral creado', req: 'prisma.affiliateReferral', status: ref ? 'OK' : 'NO ENCONTRADO', verdict: ref ? 'PASS' : 'FAIL', nota: ref ? `status=${ref.status}, code=${ref.affiliateCodeUsed}` : undefined });
  }

  // 3) Doctor con código de afiliado inválido -> 400
  await check(AREA, 'Registro Doctor (código afiliado inválido)', 'POST', '/api/auth/register', { body: docBody({ affiliateCode: 'QLX-AF-NOEXISTE' }), expect: 400 });

  // 4) Email duplicado -> 400
  await check(AREA, 'Registro Doctor (email duplicado)', 'POST', '/api/auth/register', { body: docBody({ email: docEmailAff }), expect: 400 });

  // 5) Enrolamiento Afiliado por admin + login
  const affEmail = `${TAG}-newaff@qa.test`;
  const ra = await check(AREA, 'Alta Afiliado por Admin', 'POST', '/api/admin/affiliates', { token: ctx.adminToken, body: { fullName: 'Nuevo Afiliado QA', email: affEmail, country: 'MX', commissionPercentage: 30, commissionMonths: 6 }, expect: 201 });
  const tempPassword = ra.json?.data?.tempPassword as string | undefined;
  let affToken: string | undefined;
  if (tempPassword) {
    const rl = await check(AREA, 'Login Afiliado (password temporal)', 'POST', '/api/auth/login', { body: { email: affEmail, password: tempPassword }, expect: 200 });
    affToken = rl.json?.token as string | undefined;
    if (rl.json?.requiresTwoFactor) rows.push({ area: AREA, modulo: 'Login Afiliado', req: '2FA', status: '2FA', verdict: 'WARN', nota: 'requiere 2FA' });
  }

  // 6) Auto-registro de paciente DESHABILITADO por política (solo invitación / pre-registro) => 404.
  await check(AREA, 'Auto-registro Paciente deshabilitado', 'POST', '/api/patients/register', { body: { email: `${TAG}-x@qa.test`, password: 'Paciente123', firstName: 'X', lastName: 'Y' }, expect: 404, nota: 'paciente ingresa solo por invitación/pre-registro' });

  // 7) Flujo de invitación de paciente sigue operativo (no roto): token inválido => 4xx (no 5xx)
  await check(AREA, 'Invitación paciente (validar token inválido)', 'GET', '/api/invitations/validate/token-invalido', { nota: 'flujo de invitación operativo' });

  return { doctorToken, doctorId, affToken };
}

async function moduleSmoke(ctx: Awaited<ReturnType<typeof seedSupportUsers>>, reg: Awaited<ReturnType<typeof registroFlows>>) {
  const { adminToken, patientToken, asisToken } = ctx;
  const { doctorToken, doctorId, affToken } = reg;
  const isoNow = new Date();
  const start = new Date(isoNow.getFullYear(), isoNow.getMonth(), 1).toISOString();
  const end = new Date(isoNow.getFullYear(), isoNow.getMonth() + 1, 1).toISOString();

  // ---- DOCTOR ----
  if (doctorToken) {
    const A = 'Módulos DOCTOR';
    await check(A, 'Dashboard (my-patients)', 'GET', '/api/doctors/my-patients', { token: doctorToken });
    await check(A, 'Dashboard (stats)', 'GET', '/api/doctors/dashboard-stats', { token: doctorToken });
    await check(A, 'Mis Pacientes', 'GET', '/api/doctors/my-patients', { token: doctorToken });
    await check(A, 'Calendario (perfil)', 'GET', '/api/doctors/profile', { token: doctorToken });
    await check(A, 'Calendario (sync-status)', 'GET', '/api/calendar-sync/sync-status', { token: doctorToken });
    await check(A, 'Calendario (config horario)', 'GET', '/api/schedule/config', { token: doctorToken });
    await check(A, 'Calendario (eventos)', 'GET', `/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { token: doctorToken });
    await check(A, 'Pre-consultas (portal-link)', 'GET', '/api/clinical-intakes/portal-link', { token: doctorToken });
    await check(A, 'Pre-consultas (lista)', 'GET', '/api/clinical-intakes', { token: doctorToken });
    await check(A, 'Historial Clínico (form-templates)', 'GET', '/api/form-templates', { token: doctorToken });
    if (doctorId) await check(A, 'Recetas (lista doctor)', 'GET', `/api/recipes/doctor/${doctorId}`, { token: doctorToken });
    await check(A, 'Zona de estudio', 'GET', '/api/study-documents', { token: doctorToken });
    await check(A, 'Facturación (invoices)', 'GET', '/api/doctors/invoices', { token: doctorToken });
    await check(A, 'Mi perfil (perfil)', 'GET', '/api/doctors/profile', { token: doctorToken });
    await check(A, 'Mi perfil (suscripción)', 'GET', '/api/subscriptions/details', { token: doctorToken });
    await check(A, 'Mi perfil (asistentes)', 'GET', '/api/assistants/linked', { token: doctorToken });
    await check(A, 'Ayuda y tutoriales', 'GET', '/api/tutorial-videos', { token: doctorToken });
    await check(A, 'Sesión (auth/me)', 'GET', '/api/auth/me', { token: doctorToken });
  }

  // ---- PATIENT ----
  {
    const A = 'Módulos PACIENTE';
    await check(A, 'Dashboard (citas)', 'GET', '/api/patients/my/appointments', { token: patientToken });
    await check(A, 'Dashboard (casos clínicos)', 'GET', '/api/patients/my/clinical-cases', { token: patientToken });
    await check(A, 'Dashboard (consultas)', 'GET', '/api/patients/my/consultations', { token: patientToken });
    await check(A, 'Dashboard (perfil)', 'GET', '/api/patients/my/profile', { token: patientToken });
    await check(A, 'Mis citas', 'GET', '/api/patients/my/appointments', { token: patientToken });
    await check(A, 'Zona de estudio', 'GET', '/api/study-documents', { token: patientToken });
    await check(A, 'Facturación', 'GET', '/api/doctors/invoices', { token: patientToken });
    await check(A, 'Historial (form-templates)', 'GET', '/api/form-templates', { token: patientToken });
    await check(A, 'Ayuda y tutoriales', 'GET', '/api/tutorial-videos', { token: patientToken });
    await check(A, 'Sesión (auth/me)', 'GET', '/api/auth/me', { token: patientToken });
  }

  // ---- ADMIN ----
  {
    const A = 'Módulos ADMIN';
    await check(A, 'Afiliados comerciales (lista)', 'GET', '/api/admin/affiliates', { token: adminToken });
    await check(A, 'Auditoría — Evidencias (exports)', 'GET', '/api/admin/audit-evidence/exports', { token: adminToken });
    await check(A, 'Ayuda y tutoriales', 'GET', '/api/tutorial-videos', { token: adminToken });
    await check(A, 'Sesión (auth/me)', 'GET', '/api/auth/me', { token: adminToken });
  }

  // ---- AFFILIATE ----
  if (affToken) {
    const A = 'Módulos AFILIADO';
    await check(A, 'Panel de afiliado (dashboard)', 'GET', '/api/affiliate/dashboard', { token: affToken });
    await check(A, 'Panel (perfil)', 'GET', '/api/affiliate/me', { token: affToken });
    await check(A, 'Panel (referidos)', 'GET', '/api/affiliate/referrals', { token: affToken });
    await check(A, 'Panel (comisiones)', 'GET', '/api/affiliate/commissions', { token: affToken });
    await check(A, 'Datos bancarios', 'GET', '/api/affiliate/bank-account', { token: affToken });
    await check(A, 'Sesión (auth/me)', 'GET', '/api/auth/me', { token: affToken });
  }

  // ---- ASISTENTE (prueba ligera; requiere doctor seleccionado para módulos del doctor) ----
  {
    const A = 'Módulos ASISTENTE (ligero)';
    await check(A, 'Ayuda y tutoriales', 'GET', '/api/tutorial-videos', { token: asisToken });
    await check(A, 'Sesión (auth/me)', 'GET', '/api/auth/me', { token: asisToken });
    await check(A, 'Doctores vinculados', 'GET', '/api/assistants/my-doctors', { token: asisToken, nota: 'sin vínculos => lista vacía esperada' });
  }
}

async function cleanup() {
  try {
    const users = await prisma.user.findMany({ where: { email: { contains: 'qasmoke_' } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    const profs = await prisma.affiliateProfile.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const profIds = profs.map((p) => p.id);
    // doctores creados en el flujo (por userId)
    const docs = await prisma.doctor.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const docIds = docs.map((d) => d.id);
    await prisma.affiliateCommission.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateReferral.deleteMany({ where: { OR: [{ affiliateId: { in: profIds } }, { doctorUserId: { in: ids } }] } });
    await prisma.affiliateBankAccount.deleteMany({ where: { affiliateId: { in: profIds } } });
    await prisma.affiliateProfile.deleteMany({ where: { id: { in: profIds } } });
    await prisma.subscription.deleteMany({ where: { doctorId: { in: docIds } } }).catch(() => {});
    await prisma.doctor.deleteMany({ where: { id: { in: docIds } } }).catch(() => {});
    await prisma.patient.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  } catch (e) {
    console.log('cleanup parcial:', (e as Error).message);
  }
}

function printReport() {
  const areas = [...new Set(rows.map((r) => r.area))];
  let pass = 0, warn = 0, fail = 0;
  for (const r of rows) { if (r.verdict === 'PASS') pass++; else if (r.verdict === 'WARN') warn++; else fail++; }
  console.log('\n================ REPORTE SMOKE FUNCIONAL ================');
  for (const area of areas) {
    console.log(`\n### ${area}`);
    for (const r of rows.filter((x) => x.area === area)) {
      const mark = r.verdict === 'PASS' ? 'PASS' : r.verdict === 'WARN' ? 'WARN' : 'FAIL';
      console.log(`  [${mark}] ${String(r.status).padEnd(6)} ${r.modulo}  (${r.req})${r.nota ? '  -> ' + r.nota : ''}`);
    }
  }
  console.log('\n--------------------------------------------------------');
  console.log(`TOTAL: ${rows.length}  |  PASS: ${pass}  WARN: ${warn}  FAIL: ${fail}`);
  console.log('========================================================\n');
}

async function main() {
  console.log('### SMOKE FUNCIONAL MÓDULOS + REGISTRO ###  base=', BASE);
  await cleanup();
  const ctx = await seedSupportUsers();
  const reg = await registroFlows(ctx);
  await moduleSmoke(ctx, reg);
  printReport();
  await cleanup();
  await prisma.$disconnect();
  process.exit(rows.some((r) => r.verdict === 'FAIL') ? 2 : 0);
}

main().catch(async (e) => {
  console.error('ERROR SMOKE:', e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
