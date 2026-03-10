const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkConsultations() {
  try {
    console.log('Verificando consultas...');

    // Buscar el paciente
    const patient = await prisma.patient.findFirst({
      where: {
        user: {
          email: 'paciente@test.com'
        }
      },
      include: {
        user: true,
        clinicalCases: {
          include: {
            medicalRecords: true
          }
        }
      }
    });

    if (!patient) {
      console.log('❌ No se encontró el paciente');
      return;
    }

    console.log('✅ Paciente encontrado:', patient.user.email);
    console.log('📋 Casos clínicos:', patient.clinicalCases.length);

    for (const clinicalCase of patient.clinicalCases) {
      console.log(`  - Caso: ${clinicalCase.padecimiento} (${clinicalCase.status})`);
      console.log(`    Consultas: ${clinicalCase.medicalRecords.length}`);
      
      for (const consultation of clinicalCase.medicalRecords) {
        const date = new Date(consultation.createdAt).toLocaleDateString('es-ES');
        console.log(`      * ${date}: ${consultation.notes}`);
      }
    }

  } catch (error) {
    console.error('Error verificando consultas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkConsultations();
