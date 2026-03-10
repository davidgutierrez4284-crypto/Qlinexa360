const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSpecificUser() {
  try {
    console.log('=== VERIFICANDO USUARIO ESPECÍFICO ===\n');

    const email = 'dava42@hotmail.com';

    // Buscar usuario por email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        patientProfile: true,
        doctorProfile: true
      }
    });

    if (!user) {
      console.log(`❌ No se encontró usuario con email: ${email}`);
      return;
    }

    console.log(`✅ Usuario encontrado:`);
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Nombre: ${user.firstName} ${user.lastName}`);
    console.log(`Rol: ${user.role}`);
    console.log(`Creado: ${user.createdAt}`);
    console.log(`Tiene contraseña: ${user.password ? 'SÍ' : 'NO'}`);

    if (user.patientProfile) {
      console.log(`\n📋 Perfil de Paciente:`);
      console.log(`ID: ${user.patientProfile.id}`);
      console.log(`¿Tiene consentimientos?: ${user.patientProfile.dataConsent ? 'SÍ' : 'NO'}`);
    }

    if (user.doctorProfile) {
      console.log(`\n👨‍⚕️ Perfil de Doctor:`);
      console.log(`ID: ${user.doctorProfile.id}`);
    }

    // Verificar si tiene invitación válida
    const invitation = await prisma.patientInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (invitation) {
      console.log(`\n📧 Invitación válida encontrada:`);
      console.log(`ID: ${invitation.id}`);
      console.log(`Doctor ID: ${invitation.doctorId}`);
      console.log(`Expira: ${invitation.expiresAt}`);
    } else {
      console.log(`\n❌ No se encontró invitación válida para este email`);
    }

  } catch (error) {
    console.error('Error verificando usuario:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificUser();
