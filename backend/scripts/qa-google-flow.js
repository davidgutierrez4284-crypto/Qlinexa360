/**
 * QA del flujo de Google (lógica + estado de BD, sin tocar la API de Google).
 * Ejecutar desde backend/: node scripts/qa-google-flow.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });

const { shouldAllowVideoConferenceForAppointment } = require('../dist/utils/calendarSync.utils');
const { ScheduleService } = require('../dist/services/schedule.service');

const ok = (m) => console.log('  \u2705 ' + m);
const bad = (m) => console.log('  \u274c ' + m);
const info = (m) => console.log('  \u2022 ' + m);

async function main() {
  console.log('\n=== QA FLUJO GOOGLE (lógica + datos) ===\n');

  // 1) Estado de conexión de calendarios por doctor
  console.log('1) Conexiones de calendario externas');
  const configs = await prisma.calendarSyncConfig.findMany({
    select: { doctorId: true, provider: true, isConnected: true, accessToken: true, expiresAt: true }
  });
  if (configs.length === 0) {
    bad('No hay ninguna CalendarSyncConfig: ningún doctor tiene Google/Outlook conectado.');
  } else {
    for (const c of configs) {
      const tok = c.accessToken ? 'token:sí' : 'token:NO';
      const exp = c.expiresAt ? `exp:${new Date(c.expiresAt).toISOString()}` : 'exp:n/a';
      const line = `${c.provider} | doctor ${c.doctorId} | conectado:${c.isConnected} | ${tok} | ${exp}`;
      if (c.provider === 'google' && c.isConnected && c.accessToken) ok(line);
      else info(line);
    }
  }
  const googleDoctor = configs.find((c) => c.provider === 'google' && c.isConnected && c.accessToken);

  // 2) Lógica pura de habilitación de videollamada
  console.log('\n2) Regla shouldAllowVideoConferenceForAppointment');
  const cases = [
    { type: 'presencial', signed: false, expected: false },
    { type: 'presencial', signed: true, expected: false },
    { type: 'teleconsulta', signed: false, expected: false },
    { type: 'teleconsulta', signed: true, expected: true }
  ];
  let logicPass = true;
  for (const t of cases) {
    const got = shouldAllowVideoConferenceForAppointment(t.type, t.signed);
    const pass = got === t.expected;
    logicPass = logicPass && pass;
    (pass ? ok : bad)(`${t.type} consentSigned=${t.signed} => ${got} (esperado ${t.expected})`);
  }

  // 3) Gating real de meetingUrl en teleconsultas existentes
  console.log('\n3) Gating de meetingUrl en teleconsultas de la BD');
  const teles = await prisma.appointment.findMany({
    where: { appointmentType: 'teleconsulta' },
    include: { teleconsultation: { select: { consentSigned: true, meetingUrl: true } } },
    take: 20,
    orderBy: { date: 'desc' }
  });
  if (teles.length === 0) {
    info('No hay teleconsultas en la BD para inspeccionar.');
  } else {
    for (const a of teles) {
      const signed = a.teleconsultation?.consentSigned ?? false;
      const url = a.teleconsultation?.meetingUrl ?? null;
      // Invariante: si NO firmado => no debe haber meetingUrl visible
      const violates = !signed && !!url;
      const msg = `cita ${a.id.slice(0, 8)} | firmado:${signed} | meetingUrl:${url ? 'sí' : 'no'}`;
      (violates ? bad : ok)(msg + (violates ? '  <- liga presente sin firma!' : ''));
    }
  }

  // 4) Presenciales no deben tener linkMeeting en su evento interno
  console.log('\n4) Presenciales sin liga en el evento interno');
  const presenciales = await prisma.appointment.findMany({
    where: { appointmentType: 'presencial' },
    select: { id: true, doctorId: true, patientId: true, date: true },
    take: 20,
    orderBy: { date: 'desc' }
  });
  if (presenciales.length === 0) {
    info('No hay citas presenciales en la BD.');
  } else {
    let checked = 0;
    for (const a of presenciales) {
      if (!a.patientId) continue;
      const ev = await prisma.internalCalendarEvent.findFirst({
        where: {
          doctorId: a.doctorId,
          patientId: a.patientId,
          fechaHoraInicio: {
            gte: new Date(a.date.getTime() - 30 * 60000),
            lte: new Date(a.date.getTime() + 30 * 60000)
          }
        },
        select: { id: true, linkMeeting: true }
      });
      if (!ev) continue;
      checked++;
      (ev.linkMeeting ? bad : ok)(`cita ${a.id.slice(0, 8)} | evento ${ev.id.slice(0, 8)} | linkMeeting:${ev.linkMeeting ? 'sí <- no debería' : 'no'}`);
    }
    if (checked === 0) info('No se encontraron eventos internos vinculados a presenciales.');
  }

  // 5) Slots reservables (agenda compartida) para reagenda
  console.log('\n5) Slots reservables para reagenda (próximos 7 días)');
  const doctor = (googleDoctor && (await prisma.doctor.findUnique({ where: { id: googleDoctor.doctorId }, select: { id: true, timezone: true } })))
    || (await prisma.doctor.findFirst({ select: { id: true, timezone: true } }));
  if (!doctor) {
    bad('No hay doctores en la BD.');
  } else {
    const tz = doctor.timezone || 'America/Mexico_City';
    let foundAny = false;
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const slots = await ScheduleService.getBookableSlotsForDate(doctor.id, dateStr, { timezone: tz });
      if (slots.length > 0) {
        foundAny = true;
        ok(`${dateStr}: ${slots.length} slots (ej. ${slots.slice(0, 3).map((s) => s.displayTime).join(', ')})`);
      }
    }
    if (!foundAny) info('No hay slots en los próximos 7 días (agenda no configurada o llena). La función respondió sin error.');
  }

  console.log('\n=== RESUMEN ===');
  (logicPass ? ok : bad)('Regla de habilitación de videollamada');
  (googleDoctor ? ok : info)(googleDoctor
    ? `Google conectado (doctor ${googleDoctor.doctorId}) -> prueba end-to-end real es posible desde la UI.`
    : 'Google NO conectado en BD -> la prueba end-to-end real requiere conectar una cuenta vía OAuth desde la UI.');
  console.log('');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
