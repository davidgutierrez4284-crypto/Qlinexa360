const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkInvitations() {
  try {
    console.log('=== VERIFICANDO INVITACIONES EXISTENTES ===\n');

    const invitations = await prisma.patientInvitation.findMany({
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total de invitaciones encontradas: ${invitations.length}\n`);

    if (invitations.length === 0) {
      console.log('❌ No hay invitaciones en la base de datos');
      return;
    }

    invitations.forEach((invitation, index) => {
      console.log(`--- Invitación ${index + 1} ---`);
      console.log(`ID: ${invitation.id}`);
      console.log(`Email del paciente: ${invitation.email}`);
      console.log(`Doctor: ${invitation.doctor.user.firstName} ${invitation.doctor.user.lastName} (${invitation.doctor.user.email})`);
      console.log(`Estado: ${invitation.status}`);
      console.log(`Creada: ${invitation.createdAt}`);
      console.log(`Expira: ${invitation.expiresAt}`);
      console.log(`Completada: ${invitation.completedAt || 'No completada'}`);
      console.log(`¿Expirada?: ${new Date() > invitation.expiresAt ? 'SÍ' : 'NO'}`);
      console.log('');
    });

    // Estadísticas
    const pending = invitations.filter(i => i.status === 'PENDING');
    const completed = invitations.filter(i => i.status === 'COMPLETED');
    const expired = invitations.filter(i => new Date() > i.expiresAt);

    console.log('=== ESTADÍSTICAS ===');
    console.log(`Pendientes: ${pending.length}`);
    console.log(`Completadas: ${completed.length}`);
    console.log(`Expiradas: ${expired.length}`);

  } catch (error) {
    console.error('Error verificando invitaciones:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInvitations();
