const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMigration() {
  try {
    console.log('🔍 Verificando migración...\n');

    // Verificar usuarios
    const users = await prisma.user.findMany({
      include: {
        doctorProfile: true,
        patientProfile: true
      }
    });

    console.log(`📊 Total de usuarios: ${users.length}`);
    
    const doctors = users.filter(u => u.role === 'DOCTOR');
    const assistants = users.filter(u => u.role === 'ASISTENTE');
    const patients = users.filter(u => u.role === 'PATIENT');

    console.log(`👨‍⚕️ Doctores: ${doctors.length}`);
    console.log(`👩‍💼 Asistentes: ${assistants.length}`);
    console.log(`👥 Pacientes: ${patients.length}`);

    // Verificar suscripciones
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' }
    });
    console.log(`💳 Suscripciones activas: ${subscriptions.length}`);

    // Verificar plantillas
    const templates = await prisma.formTemplate.findMany();
    console.log(`📋 Plantillas de especialidad: ${templates.length}`);

    // Verificar relaciones doctor-paciente
    const doctorPatients = await prisma.doctorPatient.findMany();
    console.log(`🔗 Relaciones doctor-paciente: ${doctorPatients.length}`);

    console.log('\n👨‍⚕️ Doctores creados:');
    doctors.forEach(d => {
      console.log(`   • ${d.email} - ${d.doctorProfile?.specialization}`);
    });

    console.log('\n👩‍💼 Asistentes creados:');
    assistants.forEach(a => {
      console.log(`   • ${a.email}`);
    });

    console.log('\n👥 Pacientes creados:');
    patients.forEach(p => {
      console.log(`   • ${p.email}`);
    });

    console.log('\n📋 Plantillas de especialidad:');
    templates.forEach(t => {
      console.log(`   • ${t.name} (${t.specialty})`);
    });

    console.log('\n✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error verificando migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigration();
