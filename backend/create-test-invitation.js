const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const prisma = new PrismaClient();

// Generar token único para invitación
const generateInvitationToken = () => {
  return randomBytes(32).toString('hex');
};

async function createTestInvitation() {
  try {
    console.log('=== CREANDO INVITACIÓN DE PRUEBA ===\n');

    // Buscar un doctor activo
    const doctor = await prisma.doctor.findFirst({
      where: {
        subscription: {
          status: 'ACTIVE'
        }
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!doctor) {
      console.log('❌ No se encontró ningún doctor con suscripción activa');
      return;
    }

    console.log(`Doctor encontrado: ${doctor.user.firstName} ${doctor.user.lastName} (${doctor.user.email})`);

            const email = 'new.test.patient@example.com';
        const firstName = 'New';
        const lastName = 'TestPatient';

    // Verificar si ya existe una invitación para este email
    const existingInvitation = await prisma.patientInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        doctorId: doctor.id
      }
    });

    if (existingInvitation) {
      console.log(`⚠️ Ya existe una invitación para ${email}`);
      console.log(`Estado: ${existingInvitation.status}`);
      console.log(`Creada: ${existingInvitation.createdAt}`);
      console.log(`Expira: ${existingInvitation.expiresAt}`);
      console.log(`¿Expirada?: ${new Date() > existingInvitation.expiresAt ? 'SÍ' : 'NO'}`);
      
      if (existingInvitation.status === 'PENDING' && new Date() <= existingInvitation.expiresAt) {
        console.log('✅ La invitación existente es válida');
        return;
      }
    }

    // Crear nueva invitación
    const invitationToken = generateInvitationToken();
    const invitation = await prisma.patientInvitation.create({
      data: {
        token: invitationToken,
        email: email.toLowerCase(),
        phone: null,
        firstName: firstName,
        lastName: lastName,
        doctorId: doctor.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        createdAt: new Date()
      }
    });

    console.log('✅ Invitación creada exitosamente');
    console.log(`ID: ${invitation.id}`);
    console.log(`Email: ${invitation.email}`);
    console.log(`Token: ${invitation.token}`);
    console.log(`Expira: ${invitation.expiresAt}`);
    console.log(`URL de registro: http://localhost:5173/register?type=patient&invitation=${invitationToken}`);

  } catch (error) {
    console.error('Error creando invitación de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestInvitation();
