/**
 * Script para probar las queries que fallan en producción.
 * Ejecutar: DATABASE_URL="..." node scripts/test-db-queries.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['error', 'warn'] });

async function main() {
  // Obtener un doctorId de prueba
  const doctor = await prisma.doctor.findFirst({ select: { id: true, userId: true } });
  if (!doctor) {
    console.log('No hay doctores en la BD');
    return;
  }
  console.log('Doctor ID:', doctor.id, 'User ID:', doctor.userId);

  try {
    // 1. Test doctorPatient.groupBy (getDashboardStats)
    console.log('\n1. Testing doctorPatient.groupBy...');
    const uniquePatients = await prisma.doctorPatient.groupBy({
      by: ['patientId'],
      where: { doctorId: doctor.id }
    });
    console.log('OK - uniquePatients count:', uniquePatients.length);
  } catch (e) {
    console.error('FAIL doctorPatient.groupBy:', e.code, e.message, e.meta);
  }

  try {
    // 2. Test appointment.count (getDashboardStats)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    console.log('\n2. Testing appointment.count...');
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: doctor.id,
        date: { gte: todayStart, lte: todayEnd },
        confirmationStatus: { not: 'CANCELLED' }
      }
    });
    console.log('OK - todayAppointments:', todayAppointments);
  } catch (e) {
    console.error('FAIL appointment.count:', e.code, e.message, e.meta);
  }

  try {
    // 3. Test recetaMedica.count (getDashboardStats)
    console.log('\n3. Testing recetaMedica.count...');
    const totalRecipes = await prisma.recetaMedica.count({
      where: { doctorId: doctor.id }
    });
    console.log('OK - totalRecipes:', totalRecipes);
  } catch (e) {
    console.error('FAIL recetaMedica.count:', e.code, e.message, e.meta);
  }

  try {
    // 4. Test patient.findMany (getAllMyPatients - simplified)
    console.log('\n4. Testing patient.findMany...');
    const patients = await prisma.patient.findMany({
      where: { doctors: { some: { doctorId: doctor.id } } },
      take: 2,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } }
      }
    });
    console.log('OK - patients count:', patients.length);
  } catch (e) {
    console.error('FAIL patient.findMany:', e.code, e.message, e.meta);
  }

  console.log('\nDone.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
