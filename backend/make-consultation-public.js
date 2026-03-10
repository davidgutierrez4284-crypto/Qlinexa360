const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeConsultationPublic() {
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
    
    // Buscar la consulta más reciente del paciente
    const consultation = await prisma.medicalRecord.findFirst({
      where: { patientId: patient.id },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!consultation) {
      console.log('❌ No se encontraron consultas');
      return;
    }
    
    console.log('📋 Consulta encontrada:', consultation.id);
    console.log('Estado actual - ¿Es pública?', consultation.isPublic ? '✅ SÍ' : '❌ NO');
    
    // Hacer la consulta pública
    const updatedConsultation = await prisma.medicalRecord.update({
      where: { id: consultation.id },
      data: { isPublic: true }
    });
    
    console.log('✅ Consulta actualizada exitosamente');
    console.log('Nuevo estado - ¿Es pública?', updatedConsultation.isPublic ? '✅ SÍ' : '❌ NO');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

makeConsultationPublic();
