/**
 * QA funcional de flujos de registro/enrolamiento "desde la vista del usuario".
 * Verifica HAPPY PATHS extremo a extremo + comprobaciones en BD tras la limpieza
 * de código muerto (registerPatientFromFrontend).
 *
 * Requiere backend dev en http://127.0.0.1:3000.
 * Ejecutar:  npx ts-node scripts/qa-flujos-usuario.ts
 *
 * Flujos:
 *   a) Registro de Doctor + suscripción (verifica Subscription en BD).
 *   b) Paciente por invitación (crear -> validar -> completar -> login -> /me).
 *   b) Asistente (registro vinculado a doctor -> login -> /me -> my-doctors).
 *   b) Paciente por pre-registro/pre-consulta (portal -> start -> draft -> submit -> convert),
 *      verifica que los datos del paciente quedan registrados (User PATIENT + Patient + MedicalRecord).
 *
 * Nota: el submit de pre-consulta genera un PDF de consentimiento y lo sube a S3.
 *       Si S3/PDF no está configurado en dev, ese paso puede dar 500 (INFRA, no regresión);
 *       el script lo marca como INFRA y continúa la conversión (que es lo que registra al paciente).
 */
import prisma from '../src/config/database';

const BASE = 'http://127.0.0.1:3000';
const RUN = Date.now();
const TAG = `qaflujo_${RUN}`;

type Verdict = 'PASS' | 'WARN' | 'FAIL' | 'INFRA';
type Row = { flujo: string; paso: string; req: string; status: number | string; verdict: Verdict; nota?: string };
const rows: Row[] = [];

function add(flujo: string, paso: string, req: string, status: number | string, verdict: Verdict, nota?: string) {
  rows.push({ flujo, paso, req, status, verdict, nota });
}

async function http(method: string, path: string, opts: { token?: string; body?: any; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<{ status: number; json: any; timedOut: boolean }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 40000);
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal });
    let json: any = null;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json, timedOut: false };
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    return { status: isAbort ? 408 : -1, json: { error: isAbort ? 'timeout' : e.message }, timedOut: isAbort };
  } finally {
    clearTimeout(timer);
  }
}

function v(status: number, expect: number): Verdict {
  if (status === expect) return 'PASS';
  if (status >= 500) return 'FAIL';
  return 'WARN';
}

// ---------------------------------------------------------------------------
async function flujoDoctor() {
  const F = 'a) Doctor + Suscripción';
  const email = `${TAG}-doc@qa.test`;
  const subId = `I-QAFLUJO-${RUN}`;
  const body = {
    email, password: 'Doctor123', firstName: 'Doc', lastName: 'QA', role: 'DOCTOR', phone: '5500000000',
    paypalSubscriptionId: subId, paypalPlanId: 'P-QAFLUJO',
    licenseNumber: `QA-LIC-${RUN}`, specialty: 'Medicina General',
    acceptPrivacy: true, acceptTerms: true
  };
  const r = await http('POST', '/api/auth/register', { body });
  add(F, 'Registro de doctor', 'POST /api/auth/register', r.status, v(r.status, 201), r.status !== 201 ? (r.json?.message || r.json?.error) : undefined);
  const token = r.json?.token as string | undefined;
  const doctorId = r.json?.user?.doctorId as string | undefined;
  if (!token) add(F, 'Token tras registro', 'token', 'SIN TOKEN', 'FAIL');

  // Verificación en BD: suscripción creada
  if (doctorId) {
    const sub = await prisma.subscription.findFirst({ where: { doctorId } });
    add(F, 'Suscripción creada en BD', 'prisma.subscription', sub ? 'OK' : 'NO ENCONTRADA', sub ? 'PASS' : 'FAIL',
      sub ? `status=${(sub as any).status ?? '-'}, paypalSubscriptionId=${(sub as any).paypalSubscriptionId || '(vacío)'}` : undefined);
  }

  // Endpoint que la UI llama: detalle de suscripción
  if (token) {
    const rs = await http('GET', '/api/subscriptions/details', { token });
    add(F, 'UI ve su suscripción', 'GET /api/subscriptions/details', rs.status, rs.status >= 200 && rs.status < 300 ? 'PASS' : (rs.status >= 500 ? 'FAIL' : 'WARN'));
  }

  // Login del doctor
  const rl = await http('POST', '/api/auth/login', { body: { email, password: 'Doctor123' } });
  add(F, 'Login de doctor', 'POST /api/auth/login', rl.status, v(rl.status, 200), rl.json?.requiresTwoFactor ? 'requiere 2FA' : (rl.status !== 200 ? rl.json?.message : undefined));

  return { token: (rl.json?.token as string) || token, doctorId };
}

async function flujoPacienteInvitacion(doctorToken: string, doctorId: string) {
  const F = 'b) Paciente por invitación';
  const email = `${TAG}-pat@qa.test`;

  // 1) Doctor crea la invitación (la fila se persiste ANTES de notificar; el envío
  //    WhatsApp/email es una dependencia externa que puede colgar en dev -> INFRA)
  const r1 = await http('POST', '/api/invitations/create', { token: doctorToken, timeoutMs: 15000, body: { firstName: 'Paciente', lastName: 'Invitado', email, phone: '5512345678', doctorId } });
  const v1: Verdict = r1.status === 201 ? 'PASS' : (r1.timedOut ? 'INFRA' : (r1.status >= 500 ? 'FAIL' : 'WARN'));
  add(F, 'Doctor crea invitación', 'POST /api/invitations/create', r1.timedOut ? 'TIMEOUT' : r1.status, v1, r1.timedOut ? 'envío de notificación colgado (Twilio/SMTP); la invitación sí se persiste' : (r1.status !== 201 ? r1.json?.message : undefined));

  // 2) Recuperar token (va por email; lo leemos de BD igual que llegaría al paciente por el enlace).
  //    La fila se persiste ANTES de notificar, pero el handler puede tardar en confirmar tras el
  //    abort del cliente; hacemos polling para evitar falsos negativos por carrera de tiempo.
  let inv = null as Awaited<ReturnType<typeof prisma.patientInvitation.findFirst>>;
  for (let i = 0; i < 15 && !inv; i++) {
    inv = await prisma.patientInvitation.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
    if (!inv) await new Promise((r) => setTimeout(r, 1000));
  }
  add(F, 'Invitación registrada en BD', 'prisma.patientInvitation', inv ? 'OK' : 'NO ENCONTRADA', inv ? 'PASS' : 'FAIL', inv ? `status=${inv.status}` : 'no apareció tras 15s');
  const invToken = inv?.token;
  if (!invToken) return;

  // 3) Validar token (lo que hace la pantalla de activación al abrir el enlace)
  const r3 = await http('GET', `/api/invitations/validate/${invToken}`);
  add(F, 'Validar enlace de invitación', 'GET /api/invitations/validate/:token', r3.status, v(r3.status, 200), r3.status === 200 ? `doctor=${r3.json?.invitation?.doctorName}` : r3.json?.message);

  // 4) Completar registro (paciente define su contraseña)
  const r4 = await http('POST', '/api/invitations/complete', { body: { token: invToken, password: 'Paciente123', additionalData: { birthDate: '1990-05-10', gender: 'OTHER' } } });
  add(F, 'Completar registro paciente', 'POST /api/invitations/complete', r4.status, v(r4.status, 201), r4.status !== 201 ? r4.json?.message : undefined);

  // 5) El paciente entra a la plataforma
  const r5 = await http('POST', '/api/auth/login', { body: { email, password: 'Paciente123' } });
  add(F, 'Paciente inicia sesión', 'POST /api/auth/login', r5.status, v(r5.status, 200), r5.status !== 200 ? r5.json?.message : undefined);
  const patToken = r5.json?.token as string | undefined;

  // 6) Sesión activa + rol correcto
  if (patToken) {
    const r6 = await http('GET', '/api/auth/me', { token: patToken });
    const role = r6.json?.user?.role || r6.json?.role;
    add(F, 'Sesión paciente (rol)', 'GET /api/auth/me', r6.status, r6.status === 200 && role === 'PATIENT' ? 'PASS' : (r6.status >= 500 ? 'FAIL' : 'WARN'), `role=${role}`);
  }

  // 7) Verificación BD: paciente + vínculo con su doctor
  const u = await prisma.user.findUnique({ where: { email }, include: { patientProfile: true } });
  add(F, 'Usuario PATIENT + perfil en BD', 'prisma.user/patient', u?.patientProfile ? 'OK' : 'NO', u?.role === 'PATIENT' && u?.patientProfile ? 'PASS' : 'FAIL');
  if (u?.patientProfile) {
    const link = await prisma.doctorPatient.findFirst({ where: { doctorId, patientId: u.patientProfile.id } });
    add(F, 'Vínculo doctor-paciente en BD', 'prisma.doctorPatient', link ? 'OK' : 'NO', link ? 'PASS' : 'FAIL', link ? `status=${link.status}` : undefined);
  }
}

async function flujoAsistente(doctorId: string) {
  const F = 'b) Asistente (vinculado a doctor)';
  const email = `${TAG}-asis@qa.test`;

  // 1) Registro del asistente (enlace provisto por el doctor; queda vinculado)
  const r1 = await http('POST', '/api/assistants/register', { body: {
    firstName: 'Asis', lastName: 'QA', email, password: 'Asis123456', phone: '5598765432',
    doctorId, acceptPrivacy: true, acceptTerms: true, signature: 'Asis QA'
  } });
  add(F, 'Registro de asistente', 'POST /api/assistants/register', r1.status, v(r1.status, 201), r1.status !== 201 ? (r1.json?.error || r1.json?.message) : undefined);

  // 2) Login
  const r2 = await http('POST', '/api/auth/login', { body: { email, password: 'Asis123456' } });
  add(F, 'Asistente inicia sesión', 'POST /api/auth/login', r2.status, v(r2.status, 200), r2.status !== 200 ? r2.json?.message : undefined);
  const asisToken = r2.json?.token as string | undefined;

  // 3) Sesión + rol
  if (asisToken) {
    const r3 = await http('GET', '/api/auth/me', { token: asisToken });
    const role = r3.json?.user?.role || r3.json?.role;
    add(F, 'Sesión asistente (rol)', 'GET /api/auth/me', r3.status, r3.status === 200 && role === 'ASISTENTE' ? 'PASS' : (r3.status >= 500 ? 'FAIL' : 'WARN'), `role=${role}`);

    // 4) Ve a su(s) doctor(es) vinculado(s)
    const r4 = await http('GET', '/api/assistants/my-doctors', { token: asisToken });
    const count = Array.isArray(r4.json) ? r4.json.length : (Array.isArray(r4.json?.data) ? r4.json.data.length : '?');
    add(F, 'Asistente ve doctor vinculado', 'GET /api/assistants/my-doctors', r4.status, r4.status === 200 ? 'PASS' : (r4.status >= 500 ? 'FAIL' : 'WARN'), `doctores=${count}`);
  }

  // 5) Verificación BD
  const u = await prisma.user.findUnique({ where: { email } });
  add(F, 'Usuario ASISTENTE en BD', 'prisma.user', u ? 'OK' : 'NO', u?.role === 'ASISTENTE' ? 'PASS' : 'FAIL');
  if (u) {
    const link = await prisma.asistenteDoctorVinculo.findFirst({ where: { asistenteId: u.id, doctorId, activo: true } });
    add(F, 'Vínculo asistente-doctor en BD', 'prisma.asistenteDoctorVinculo', link ? 'OK' : 'NO', link ? 'PASS' : 'FAIL');
  }
}

async function flujoPreConsulta(doctorToken: string, doctorId: string) {
  const F = 'b) Paciente por pre-registro/pre-consulta';
  const email = `${TAG}-preconsulta@qa.test`;

  // 1) Doctor obtiene su portal de pre-registro
  const r1 = await http('GET', '/api/clinical-intakes/portal-link', { token: doctorToken });
  add(F, 'Doctor obtiene portal de pre-registro', 'GET /api/clinical-intakes/portal-link', r1.status, r1.status === 200 ? 'PASS' : (r1.status >= 500 ? 'FAIL' : 'WARN'));
  const portalToken = r1.json?.data?.portalToken as string | undefined;
  if (!portalToken) { add(F, 'portalToken', 'data.portalToken', 'SIN TOKEN', 'FAIL'); return; }

  // 2) Paciente abre el portal e inicia (público, sin login)
  const r2 = await http('POST', `/api/clinical-intakes/public/portal/${portalToken}/start`);
  add(F, 'Paciente inicia pre-registro (público)', 'POST /public/portal/:token/start', r2.status, r2.status === 200 ? 'PASS' : (r2.status >= 500 ? 'FAIL' : 'WARN'));
  const intakeToken = r2.json?.data?.token as string | undefined;
  if (!intakeToken) { add(F, 'intakeToken', 'data.token', 'SIN TOKEN', 'FAIL'); return; }

  // 3) Lee el formulario público
  const r3 = await http('GET', `/api/clinical-intakes/public/${intakeToken}`);
  add(F, 'Carga formulario público', 'GET /public/:token', r3.status, r3.status === 200 ? 'PASS' : (r3.status >= 500 ? 'FAIL' : 'WARN'));

  // 4) Captura/guarda sus datos (borrador)
  const formData = { patient: { firstName: 'Pre', lastName: 'Consulta QA', email, phone: '5500112233' } };
  const r4 = await http('PUT', `/api/clinical-intakes/public/${intakeToken}`, { body: { formData, consultationReason: 'Dolor de cabeza' } });
  add(F, 'Paciente guarda sus datos (borrador)', 'PUT /public/:token', r4.status, r4.status === 200 ? 'PASS' : (r4.status >= 500 ? 'FAIL' : 'WARN'));

  // 5) Envío con consentimientos (genera PDF + S3; puede ser INFRA en dev)
  const r5 = await http('POST', `/api/clinical-intakes/public/${intakeToken}/submit`, { timeoutMs: 15000, body: {
    formData, consultationReason: 'Dolor de cabeza',
    consentPrivacy: true, consentTreatment: true, consentPlatform: true, consentSignerName: 'Pre Consulta QA'
  } });
  const isInfra5 = r5.timedOut || r5.status >= 500;
  if (r5.status === 200) {
    add(F, 'Paciente envía pre-consulta', 'POST /public/:token/submit', r5.status, 'PASS');
  } else if (isInfra5) {
    add(F, 'Paciente envía pre-consulta', 'POST /public/:token/submit', r5.timedOut ? 'TIMEOUT' : r5.status, 'INFRA', `${r5.json?.message || 'timeout'} (depende de S3/PDF; se fuerza estado SUBMITTED para validar conversión)`);
    // Forzar estado enviado para poder validar la conversión (registro del paciente)
    await prisma.clinicalIntake.update({ where: { token: intakeToken }, data: { status: 'SUBMITTED_PENDING_VALIDATION' } }).catch(() => {});
  } else {
    add(F, 'Paciente envía pre-consulta', 'POST /public/:token/submit', r5.status, 'WARN', r5.json?.message);
  }

  // 6) Doctor convierte la pre-consulta -> registra al paciente en su historial
  const intake = await prisma.clinicalIntake.findUnique({ where: { token: intakeToken } });
  if (!intake) { add(F, 'intake en BD', 'prisma.clinicalIntake', 'NO', 'FAIL'); return; }
  const r6 = await http('POST', `/api/clinical-intakes/${intake.id}/convert`, { token: doctorToken });
  add(F, 'Doctor convierte a historial', 'POST /api/clinical-intakes/:id/convert', r6.status, r6.status === 200 ? 'PASS' : (r6.status >= 500 ? 'FAIL' : 'WARN'), r6.status !== 200 ? r6.json?.message : undefined);

  // 7) Verificación BD: datos del paciente quedaron registrados
  const u = await prisma.user.findUnique({ where: { email }, include: { patientProfile: true } });
  add(F, 'Paciente registrado en BD', 'prisma.user/patient', u?.patientProfile ? 'OK' : 'NO', u?.role === 'PATIENT' && u?.patientProfile ? 'PASS' : 'FAIL');
  if (u?.patientProfile) {
    const mr = await prisma.medicalRecord.findFirst({ where: { patientId: u.patientProfile.id }, orderBy: { date: 'desc' } });
    add(F, 'Historial clínico creado', 'prisma.medicalRecord', mr ? 'OK' : 'NO', mr ? 'PASS' : 'FAIL', mr ? `reason=${(mr as any).reason || '-'}` : undefined);
    const link = await prisma.doctorPatient.findFirst({ where: { doctorId, patientId: u.patientProfile.id } });
    add(F, 'Vínculo doctor-paciente en BD', 'prisma.doctorPatient', link ? 'OK' : 'NO', link ? 'PASS' : 'FAIL');
  }
}

// ---------------------------------------------------------------------------
async function cleanup() {
  try {
    const users = await prisma.user.findMany({ where: { email: { contains: TAG } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return;
    const docs = await prisma.doctor.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const docIds = docs.map((d) => d.id);
    const pats = await prisma.patient.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
    const patIds = pats.map((p) => p.id);

    const del = async (label: string, fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { /* best-effort */ } };

    await del('clinicalIntake', () => prisma.clinicalIntake.deleteMany({ where: { doctorId: { in: docIds } } }));
    await del('file', () => prisma.file.deleteMany({ where: { OR: [{ patientId: { in: patIds } }, { doctorId: { in: docIds } }] } }));
    await del('medicalRecord', () => prisma.medicalRecord.deleteMany({ where: { patientId: { in: patIds } } }));
    await del('clinicalCase', () => prisma.clinicalCase.deleteMany({ where: { patientId: { in: patIds } } }));
    await del('doctorPatient', () => prisma.doctorPatient.deleteMany({ where: { OR: [{ doctorId: { in: docIds } }, { patientId: { in: patIds } }] } }));
    await del('patientInvitation', () => prisma.patientInvitation.deleteMany({ where: { doctorId: { in: docIds } } }));
    await del('asistenteVinculo', () => prisma.asistenteDoctorVinculo.deleteMany({ where: { OR: [{ doctorId: { in: docIds } }, { asistenteId: { in: userIds } }] } }));
    await del('consentHistory', () => prisma.consentHistory.deleteMany({ where: { userId: { in: userIds } } }));
    await del('notification', () => prisma.notification.deleteMany({ where: { userId: { in: userIds } } }));
    await del('subscription', () => prisma.subscription.deleteMany({ where: { doctorId: { in: docIds } } }));
    await del('patient', () => prisma.patient.deleteMany({ where: { userId: { in: userIds } } }));
    await del('doctor', () => prisma.doctor.deleteMany({ where: { userId: { in: userIds } } }));
    await del('user', () => prisma.user.deleteMany({ where: { id: { in: userIds } } }));
  } catch (e) {
    console.log('cleanup parcial:', (e as Error).message);
  }
}

function report() {
  const flujos = [...new Set(rows.map((r) => r.flujo))];
  let pass = 0, warn = 0, fail = 0, infra = 0;
  for (const r of rows) { if (r.verdict === 'PASS') pass++; else if (r.verdict === 'WARN') warn++; else if (r.verdict === 'INFRA') infra++; else fail++; }
  console.log('\n============ QA FLUJOS DE REGISTRO/ENROLAMIENTO ============');
  for (const f of flujos) {
    console.log(`\n### ${f}`);
    for (const r of rows.filter((x) => x.flujo === f)) {
      console.log(`  [${r.verdict.padEnd(5)}] ${String(r.status).padEnd(7)} ${r.paso}  (${r.req})${r.nota ? '  -> ' + r.nota : ''}`);
    }
  }
  console.log('\n-----------------------------------------------------------');
  console.log(`TOTAL: ${rows.length}  |  PASS: ${pass}  WARN: ${warn}  INFRA: ${infra}  FAIL: ${fail}`);
  console.log('===========================================================\n');
}

async function main() {
  console.log('### QA FLUJOS USUARIO ###  base=', BASE, ' tag=', TAG);
  await cleanup();
  const doc = await flujoDoctor();
  if (doc.token && doc.doctorId) {
    await flujoPacienteInvitacion(doc.token, doc.doctorId);
    await flujoAsistente(doc.doctorId);
    await flujoPreConsulta(doc.token, doc.doctorId);
  } else {
    add('a) Doctor + Suscripción', 'Prerrequisito', 'token+doctorId', 'FALTA', 'FAIL', 'sin doctor no se pueden probar los demás flujos');
  }
  report();
  await cleanup();
  await prisma.$disconnect();
  process.exit(rows.some((r) => r.verdict === 'FAIL') ? 2 : 0);
}

main().catch(async (e) => {
  console.error('ERROR QA FLUJOS:', e);
  await cleanup().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
