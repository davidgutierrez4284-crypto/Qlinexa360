const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkConsultation() {
  try {
    // Buscar el paciente
    const patient = await prisma.patient.findFirst({
      where: { user: { email: 'new.test.patient@example.com' } },
      include: { user: true }
    });
    
    if (!patient) {
      console.log('❌ Paciente no encontrado');
      return;
    }
    
    console.log('✅ Paciente encontrado:', patient.user.firstName, patient.user.lastName);
    
    // Buscar las consultas del paciente
    const consultations = await prisma.medicalRecord.findMany({
      where: { patientId: patient.id },
      select: {
        id: true,
        diagnosis: true,
        notes: true,
        isPublic: true,
        clinicalEvolution: true,
        createdAt: true,
        clinicalCase: {
          select: {
            id: true,
            padecimiento: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('\n📋 Consultas encontradas:', consultations.length);
    consultations.forEach((consultation, index) => {
      console.log(`\n--- Consulta ${index + 1} ---`);
      console.log('ID:', consultation.id);
      console.log('Diagnóstico:', consultation.diagnosis);
      console.log('Notas:', consultation.notes?.substring(0, 100) + '...');
      console.log('¿Es pública?', consultation.isPublic ? '✅ SÍ' : '❌ NO');
      console.log('Evolución clínica:', consultation.clinicalEvolution);
      console.log('Caso clínico:', consultation.clinicalCase?.padecimiento);
      console.log('Fecha:', consultation.createdAt.toLocaleDateString('es-ES'));
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConsultation();
