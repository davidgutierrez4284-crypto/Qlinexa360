const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDoctorPatients() {
  try {
    console.log('=== VERIFICANDO PACIENTES DEL DOCTOR ===\n');

    // Buscar al doctor Carlos García
    const doctor = await prisma.doctor.findFirst({
      where: {
        user: {
          email: 'dr.garcia@test.com'
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
      console.log('❌ No se encontró al doctor Carlos García');
      return;
    }

    console.log(`Doctor encontrado: ${doctor.user.firstName} ${doctor.user.lastName} (${doctor.user.email})`);
    console.log(`ID del doctor: ${doctor.id}\n`);

    // Buscar todos los pacientes vinculados a este doctor
    const doctorPatients = await prisma.doctorPatient.findMany({
      where: {
        doctorId: doctor.id
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                password: true,
                createdAt: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total de pacientes vinculados: ${doctorPatients.length}\n`);

    doctorPatients.forEach((dp, index) => {
      const patient = dp.patient;
      const user = patient.user;
      
      console.log(`--- Paciente ${index + 1} ---`);
      console.log(`ID del paciente: ${patient.id}`);
      console.log(`Nombre: ${user.firstName} ${user.lastName}`);
      console.log(`Email: ${user.email}`);
      console.log(`Tiene contraseña: ${user.password ? 'SÍ' : 'NO'}`);
      console.log(`Usuario creado: ${user.createdAt}`);
      console.log(`Estado del vínculo: ${dp.status}`);
      console.log(`Fecha del vínculo: ${dp.createdAt}`);
      console.log('');
    });

    // Verificar invitaciones pendientes
    console.log('=== INVITACIONES PENDIENTES ===\n');
    
    const pendingInvitations = await prisma.patientInvitation.findMany({
      where: {
        doctorId: doctor.id,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Total de invitaciones pendientes: ${pendingInvitations.length}\n`);

    pendingInvitations.forEach((inv, index) => {
      console.log(`--- Invitación ${index + 1} ---`);
      console.log(`ID: ${inv.id}`);
      console.log(`Email: ${inv.email}`);
      console.log(`Nombre: ${inv.firstName} ${inv.lastName}`);
      console.log(`Estado: ${inv.status}`);
      console.log(`Expira: ${inv.expiresAt}`);
      console.log(`Creada: ${inv.createdAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error verificando pacientes del doctor:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDoctorPatients();
