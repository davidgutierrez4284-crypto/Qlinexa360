/**
 * Muestra en consola los valores para las variables QA_* del script qa-mercadopago-e2e.
 *
 * Uso: npx ts-node scripts/qa-get-mp-tokens.ts
 *      npx ts-node scripts/qa-get-mp-tokens.ts doctor@ejemplo.com
 */
import prisma from '../src/config/database';

async function main() {
  const emailFilter = process.argv[2]?.trim().toLowerCase();

  console.log('\n=== Tokens QA Mercado Pago ===\n');

  console.log('--- QA_DOCTOR_TOKEN / QA_ASSISTANT_TOKEN (JWT) ---');
  console.log('No se guardan en BD. Obtén el JWT así:');
  console.log('  1. Inicia sesión en http://localhost:5173/login (completa 2FA si aplica)');
  console.log('  2. F12 → Application → Local Storage → http://localhost:5173 → copia "token"');
  console.log('  3. Doctor → QA_DOCTOR_TOKEN   |   Asistente → QA_ASSISTANT_TOKEN\n');

  const doctors = await prisma.doctor.findMany({
    where: emailFilter
      ? { user: { email: { contains: emailFilter, mode: 'insensitive' } } }
      : undefined,
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { email: true, firstName: true, lastName: true, role: true } },
    },
  });

  console.log('--- QA_SELECTED_DOCTOR_ID (solo asistente) ---');
  if (doctors.length === 0) {
    console.log('  (No hay doctores recientes en BD)\n');
  } else {
    for (const d of doctors) {
      console.log(
        `  doctorId: ${d.id}\n  email: ${d.user.email}\n  nombre: ${d.user.firstName} ${d.user.lastName}\n`
      );
    }
  }

  const assistantLinks = await prisma.asistenteDoctorVinculo.findMany({
    where: { activo: true },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      doctor: { include: { user: { select: { email: true } } } },
    },
  });

  if (assistantLinks.length > 0) {
    console.log('Vínculos asistente → doctor (usa doctorId con QA_ASSISTANT_TOKEN):');
    for (const link of assistantLinks) {
      const asistente = await prisma.user.findUnique({
        where: { id: link.asistenteId },
        select: { email: true },
      });
      console.log(
        `  asistente: ${asistente?.email || link.asistenteId} → doctorId: ${link.doctorId} (${link.doctor.user.email})`
      );
    }
    console.log('');
  }

  const teleRequests = await prisma.appointmentConfirmationRequest.findMany({
    where: {
      expiresAt: { gt: new Date() },
      appointment: { appointmentType: 'teleconsulta' },
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      appointment: {
        include: {
          patient: { select: { firstName: true, lastName: true } },
          doctor: { include: { user: { select: { email: true } } } },
        },
      },
    },
  });

  console.log('--- QA_TELECONSULT_TOKEN ---');
  console.log('Es el token de la URL /teleconsulta/<TOKEN> (tabla appointment_confirmation_requests)\n');

  if (teleRequests.length === 0) {
    console.log('  No hay enlaces de teleconsulta vigentes.');
    console.log('  Crea una cita teleconsulta en Calendario con paciente y vuelve a ejecutar este script.\n');
  } else {
    for (const req of teleRequests) {
      const apt = req.appointment;
      const patient = `${apt.patient.firstName || ''} ${apt.patient.lastName || ''}`.trim();
      console.log(`  token: ${req.confirmationToken}`);
      console.log(`  url:   http://localhost:5173/teleconsulta/${req.confirmationToken}`);
      console.log(`  cita:  ${apt.date.toISOString()} | paciente: ${patient}`);
      console.log(`  doctor: ${apt.doctor.user.email} | appointmentId: ${apt.id}`);
      console.log('');
    }
  }

  console.log('--- Comando ejemplo (PowerShell) ---\n');
  const sampleToken = teleRequests[0]?.confirmationToken || '<TELECONSULT_TOKEN>';
  const sampleDoctorId = doctors[0]?.id || '<DOCTOR_ID>';
  console.log(`$env:QA_API_BASE = "http://localhost:3000"`);
  console.log(`$env:QA_DOCTOR_TOKEN = "<pega JWT de localStorage>"`);
  console.log(`$env:QA_TELECONSULT_TOKEN = "${sampleToken}"`);
  console.log(`$env:QA_ASSISTANT_TOKEN = "<opcional JWT asistente>"`);
  console.log(`$env:QA_SELECTED_DOCTOR_ID = "${sampleDoctorId}"`);
  console.log(`npm run qa:mercadopago\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
