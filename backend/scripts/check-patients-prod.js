/**
 * Busca pacientes por email en la BD.
 * Uso: DATABASE_URL="postgresql://..." node scripts/check-patients-prod.js
 * Obtener DATABASE_URL de AWS Secrets Manager: qlinexa360-prod-database-url
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMAILS = ['dava42@hotmail.com', 'ext_dgutierrez@qmctelecom.com'];

async function main() {
  console.log('Buscando pacientes con emails:', EMAILS.join(', '));
  console.log('---');

  // Buscar en User (los pacientes tienen userId -> User)
  const users = await prisma.user.findMany({
    where: { email: { in: EMAILS } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      patientProfile: {
        select: {
          id: true,
          dateOfBirth: true,
          createdAt: true
        }
      }
    }
  });

  if (users.length === 0) {
    console.log('No se encontraron usuarios con esos emails.');
    return;
  }

  for (const u of users) {
    console.log('Usuario:', u.email);
    console.log('  ID:', u.id);
    console.log('  Nombre:', u.firstName, u.lastName);
    console.log('  Rol:', u.role);
    if (u.patientProfile) {
      console.log('  Paciente ID:', u.patientProfile.id);
      console.log('  Fecha nacimiento:', u.patientProfile.dateOfBirth);
      console.log('  Creado:', u.patientProfile.createdAt);
    } else {
      console.log('  (No tiene perfil de paciente)');
    }
    console.log('---');
  }

  // También buscar en Patient.email por si está ahí
  const patientsByEmail = await prisma.patient.findMany({
    where: { email: { in: EMAILS } },
    include: { user: { select: { email: true, firstName: true, lastName: true } } }
  });

  if (patientsByEmail.length > 0) {
    console.log('Pacientes encontrados por Patient.email:');
    for (const p of patientsByEmail) {
      console.log('  Paciente ID:', p.id, '| Email:', p.email, '| User:', p.user?.email);
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
