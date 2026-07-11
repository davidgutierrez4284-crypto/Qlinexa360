/**
 * Prueba EN VIVO de solo lectura contra Google Calendar:
 * - Verifica refresh de token y lectura de un evento real (no muta nada).
 * Ejecutar desde backend/: node scripts/qa-google-live-read.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error'] });
const { GoogleCalendarSyncService } = require('../dist/services/googleCalendarSync.service');

async function main() {
  console.log('\n=== GOOGLE LIVE (solo lectura) ===\n');

  const cfg = await prisma.calendarSyncConfig.findFirst({
    where: { provider: 'google', isConnected: true, accessToken: { not: null } }
  });
  if (!cfg) {
    console.log('No hay Google conectado.');
    return;
  }
  console.log('Doctor con Google:', cfg.doctorId);

  const ev = await prisma.internalCalendarEvent.findFirst({
    where: { doctorId: cfg.doctorId, externalProvider: 'google', externalEventId: { not: null } },
    orderBy: { fechaHoraInicio: 'desc' },
    select: { id: true, externalEventId: true, titulo: true, linkMeeting: true }
  });
  if (!ev) {
    console.log('El doctor no tiene eventos internos vinculados a Google.');
    return;
  }
  console.log('Evento interno:', ev.id.slice(0, 8), '| extId:', ev.externalEventId, '| linkMeeting:', ev.linkMeeting ? 'sí' : 'no');

  try {
    const remote = await GoogleCalendarSyncService.getEvent(cfg.doctorId, ev.externalEventId);
    if (!remote) {
      console.log('\u26a0\ufe0f  Google respondió null (evento no encontrado o sin acceso).');
    } else {
      console.log('\u2705 Lectura en vivo OK (token válido / refrescado).');
      console.log('   summary:', remote.summary);
      console.log('   hangoutLink:', remote.hangoutLink || '(ninguno)');
      console.log('   conferenceData:', remote.conferenceData ? 'PRESENTE' : '(ninguno)');
      console.log('   status:', remote.status);
    }
  } catch (e) {
    console.log('\u274c Error leyendo de Google:', e?.message || e);
  }

  console.log('');
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
