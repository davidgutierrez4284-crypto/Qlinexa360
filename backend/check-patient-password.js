const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkPatientPassword() {
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
    console.log('📧 Email:', patient.user.email);
    console.log('🔑 Contraseña hash:', patient.user.password.substring(0, 20) + '...');
    
    // Probar algunas contraseñas comunes
    const commonPasswords = [
      'password123',
      '123456',
      'password',
      'admin',
      'test123',
      'qlinexa360',
      'newtestpatient',
      'patient123'
    ];
    
    console.log('\n🔍 Probando contraseñas comunes...');
    for (const password of commonPasswords) {
      const isValid = await bcrypt.compare(password, patient.user.password);
      if (isValid) {
        console.log(`✅ Contraseña encontrada: "${password}"`);
        return;
      }
    }
    
    console.log('❌ No se encontró una contraseña común');
    console.log('💡 Sugerencia: Usar el flujo de "forgot password" para resetear la contraseña');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatientPassword();
