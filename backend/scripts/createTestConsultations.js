const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestConsultations() {
  try {
    console.log('Creando consultas de prueba...');

    // Buscar el paciente de prueba
    const patient = await prisma.patient.findFirst({
      where: {
        user: {
          email: 'paciente@test.com'
        }
      },
      include: {
        user: true
      }
    });

    if (!patient) {
      console.log('No se encontró el paciente de prueba. Creando uno...');
      // Crear el paciente si no existe
      const user = await prisma.user.create({
        data: {
          email: 'paciente@test.com',
          password: await require('bcrypt').hash('password123', 10),
          firstName: 'Paciente',
          lastName: 'Prueba',
          role: 'PATIENT'
        }
      });

      const newPatient = await prisma.patient.create({
        data: {
          userId: user.id,
          taxName: 'Paciente Prueba',
          taxId: 'TEST123',
          taxAddress: 'Dirección de Prueba'
        },
        include: {
          user: true
        }
      });
      
      console.log('Paciente creado:', newPatient.user.email);
    }

    // Buscar el doctor (doctor1)
    const doctor = await prisma.doctor.findFirst({
      where: {
        user: {
          email: 'doctor1@test.com'
        }
      },
      include: {
        user: true
      }
    });

    if (!doctor) {
      console.log('No se encontró el doctor. Ejecuta primero createTestUsers.js');
      return;
    }

    const patientId = patient ? patient.id : (await prisma.patient.findFirst({
      where: { user: { email: 'paciente@test.com' } }
    })).id;

    // Crear un caso clínico para el paciente
    const clinicalCase = await prisma.clinicalCase.create({
      data: {
        padecimiento: 'Dolor de cabeza frecuente',
        descripcion: 'Paciente presenta dolores de cabeza recurrentes',
        status: 'ACTIVO',
        patient: {
          connect: { id: patientId }
        }
      }
    });

    console.log('Caso clínico creado:', clinicalCase.id);

    // Crear 3 consultas con fechas diferentes
    const consultations = [
      {
        notes: 'Primera consulta - Evaluación inicial del dolor de cabeza',
        clinicalCaseId: clinicalCase.id,
        autorConsultaId: doctor.user.id,
        vinculadoADoctor: doctor.id,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 días atrás
      },
      {
        notes: 'Segunda consulta - Seguimiento del tratamiento',
        clinicalCaseId: clinicalCase.id,
        autorConsultaId: doctor.user.id,
        vinculadoADoctor: doctor.id,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 días atrás
      },
      {
        notes: 'Tercera consulta - Control y ajuste de medicación',
        clinicalCaseId: clinicalCase.id,
        autorConsultaId: doctor.user.id,
        vinculadoADoctor: doctor.id,
        createdAt: new Date() // Hoy
      }
    ];

    for (const consultation of consultations) {
      const created = await prisma.medicalRecord.create({
        data: consultation
      });
      console.log('Consulta creada:', created.id, '-', consultation.notes);
    }

    // Vincular el paciente al doctor
    await prisma.doctorPatient.upsert({
      where: {
        doctorId_patientId: {
          doctorId: doctor.id,
          patientId: patientId
        }
      },
      update: {},
      create: {
        doctorId: doctor.id,
        patientId: patientId
      }
    });

    console.log('✅ Consultas de prueba creadas exitosamente');
    console.log('📋 Paciente:', patient ? patient.user.email : 'paciente@test.com');
    console.log('👨‍⚕️ Doctor:', doctor.user.email);
    console.log('📅 Se crearon 3 consultas con fechas diferentes');

  } catch (error) {
    console.error('Error creando consultas de prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestConsultations();
