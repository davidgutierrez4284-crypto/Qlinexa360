const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkMedicalRecords() {
  try {
    console.log('Consultando registros médicos...');
    
    const records = await prisma.medicalRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        diagnosis: true,
        formData: true,
        reason: true,
        tags: true,
        clinicalEvolution: true,
        createdAt: true,
        clinicalCaseId: true
      }
    });

    console.log('\n=== REGISTROS MÉDICOS ===');
    records.forEach((record, index) => {
      console.log(`\n--- Registro ${index + 1} ---`);
      console.log('ID:', record.id);
      console.log('Diagnóstico:', record.diagnosis);
      console.log('Motivo (reason):', record.reason || 'NULL');
      console.log('Etiquetas (tags):', record.tags);
      console.log('Evolución clínica:', record.clinicalEvolution);
      console.log('Fecha creación:', record.createdAt);
      console.log('Caso clínico ID:', record.clinicalCaseId);
      console.log('FormData:', JSON.stringify(record.formData, null, 2));
    });

    // También consultar casos clínicos
    console.log('\n=== CASOS CLÍNICOS ===');
    const cases = await prisma.clinicalCase.findMany({
      include: {
        medicalRecords: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });

    cases.forEach((clinicalCase, index) => {
      console.log(`\n--- Caso ${index + 1} ---`);
      console.log('ID:', clinicalCase.id);
      console.log('Padecimiento:', clinicalCase.padecimiento);
      console.log('Paciente ID:', clinicalCase.patientId);
      console.log('Registros médicos:', clinicalCase.medicalRecords.length);
      
      clinicalCase.medicalRecords.forEach((record, recIndex) => {
        console.log(`  Registro ${recIndex + 1}:`);
        console.log(`    ID: ${record.id}`);
        console.log(`    Diagnóstico: ${record.diagnosis}`);
        console.log(`    FormData: ${JSON.stringify(record.formData)}`);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMedicalRecords(); 