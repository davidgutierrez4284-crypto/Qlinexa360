/**
 * Limpieza de datos de PRUEBA (solo desarrollo) para un paciente.
 *
 * Elimina las citas (Appointment) de un paciente y sus eventos de calendario
 * internos vinculados. Sirve para deshacer la "data encimada" de pruebas que
 * provoca colisiones de emparejamiento.
 *
 * SEGURIDAD:
 *  - Por defecto corre en DRY-RUN: solo lista lo que borraría, NO borra nada.
 *  - Para borrar de verdad agrega el flag --apply.
 *  - NO toca eventos en Google/Outlook (esos hay que borrarlos manualmente o
 *    dejar que el siguiente sync los reconcilie).
 *
 * Uso:
 *   node scripts/cleanup-test-patient-appointments.js                       (dry-run, email por defecto)
 *   node scripts/cleanup-test-patient-appointments.js --email otro@mail.com (dry-run)
 *   node scripts/cleanup-test-patient-appointments.js --apply               (BORRA de verdad)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error', 'warn'] });

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1];
  }
  return fallback;
}

const APPLY = process.argv.includes('--apply');
const EMAIL = (getArg('--email', 'dava42@hotmail.com') || '').toLowerCase().trim();

async function main() {
  console.log('========================================');
  console.log(`Modo: ${APPLY ? '🔴 APPLY (BORRARÁ datos)' : '🟢 DRY-RUN (solo lista)'}`);
  console.log(`Paciente objetivo (email): ${EMAIL}`);
  console.log('========================================\n');

  const patients = await prisma.patient.findMany({
    where: {
      OR: [{ email: EMAIL }, { user: { email: EMAIL } }]
    },
    select: { id: true, firstName: true, lastName: true, email: true, user: { select: { email: true } } }
  });

  if (patients.length === 0) {
    console.log('No se encontró ningún paciente con ese email. Nada que hacer.');
    return;
  }

  for (const patient of patients) {
    console.log(`👤 Paciente: ${patient.firstName} ${patient.lastName}`);
    console.log(`   id=${patient.id}  email=${patient.email || patient.user?.email || '—'}`);

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      orderBy: { date: 'asc' },
      select: { id: true, date: true, appointmentType: true, status: true, confirmationStatus: true }
    });

    const events = await prisma.internalCalendarEvent.findMany({
      where: { patientId: patient.id },
      orderBy: { fechaHoraInicio: 'asc' },
      select: {
        id: true,
        appointmentId: true,
        fechaHoraInicio: true,
        titulo: true,
        externalProvider: true,
        externalEventId: true
      }
    });

    console.log(`\n   📋 Citas (${appointments.length}):`);
    appointments.forEach(a =>
      console.log(
        `      - ${a.id}  ${a.date.toISOString()}  ${a.appointmentType}  ${a.status}/${a.confirmationStatus}`
      )
    );

    console.log(`\n   🗓️  Eventos de calendario internos (${events.length}):`);
    events.forEach(e =>
      console.log(
        `      - ${e.id}  ${e.fechaHoraInicio.toISOString()}  apptId=${e.appointmentId || '—'}  ` +
          `${e.externalProvider || 'interno'}:${e.externalEventId || '—'}  "${e.titulo}"`
      )
    );

    if (!APPLY) {
      console.log('\n   (DRY-RUN) No se borró nada. Re-ejecuta con --apply para borrar.\n');
      continue;
    }

    // BORRADO real: primero eventos de calendario, luego citas (cascade a teleconsultation/
    // confirmationRequests/preConsultation por las relaciones onDelete: Cascade del schema).
    const deletedEvents = await prisma.internalCalendarEvent.deleteMany({
      where: { patientId: patient.id }
    });
    const deletedAppointments = await prisma.appointment.deleteMany({
      where: { patientId: patient.id }
    });

    console.log(`\n   ✅ Eventos de calendario borrados: ${deletedEvents.count}`);
    console.log(`   ✅ Citas borradas: ${deletedAppointments.count}`);
    console.log('   ⚠️  Recuerda borrar manualmente los eventos en Google/Outlook si quedaron.\n');
  }
}

main()
  .catch(e => {
    console.error('Error en cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
