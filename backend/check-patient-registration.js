const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPatientRegistration() {
  try {
    console.log('=== VERIFICANDO REGISTRO DEL PACIENTE ===\n');

    const email = 'su de new.test.patient@example.com';

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
      console.log('Esto significa que NO fue registrado durante consulta\n');
      
      // Verificar solo la invitación
      const invitation = await prisma.patientInvitation.findFirst({
        where: {
          email: email.toLowerCase(),
          status: 'PENDING',
          expiresAt: { gt: new Date() }
        }
      });

      if (invitation) {
        console.log('📧 Solo existe la invitación:');
        console.log(`ID: ${invitation.id}`);
        console.log(`Doctor ID: ${invitation.doctorId}`);
        console.log(`Expira: ${invitation.expiresAt}`);
        console.log('\n❌ PROBLEMA: Solo se creó la invitación, NO el paciente');
        console.log('El doctor debe usar "Registrar Nuevo Paciente" primero');
      }
      
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
      console.log(`Creado: ${user.patientProfile.createdAt}`);
    }

    // Verificar si está vinculado al doctor
    const doctorPatient = await prisma.doctorPatient.findFirst({
      where: {
        patientId: user.patientProfile.id
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (doctorPatient) {
      console.log(`\n👨‍⚕️ Vinculado al doctor:`);
      console.log(`Doctor: ${doctorPatient.doctor.user.firstName} ${doctorPatient.doctor.user.lastName}`);
      console.log(`Email: ${doctorPatient.doctor.user.email}`);
      console.log(`Estado del vínculo: ${doctorPatient.status}`);
      console.log(`Fecha del vínculo: ${doctorPatient.createdAt}`);
    } else {
      console.log(`\n❌ NO está vinculado a ningún doctor`);
    }

    // Verificar invitación
    const invitation = await prisma.patientInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (invitation) {
      console.log(`\n📧 Invitación válida:`);
      console.log(`ID: ${invitation.id}`);
      console.log(`Expira: ${invitation.expiresAt}`);
    } else {
      console.log(`\n❌ No se encontró invitación válida`);
    }

  } catch (error) {
    console.error('Error verificando registro del paciente:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPatientRegistration();
