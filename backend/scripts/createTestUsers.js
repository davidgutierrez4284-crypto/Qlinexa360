const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createTestUsers() {
  try {
    console.log('Creando usuarios de prueba (doctores, enfermeras, pacientes, asistentes)...');

    // 5 doctores y 5 enfermeras (rol DOCTOR para probar colaboración)
    const staff = [
      // Doctores
      { email: 'doctor1@test.com', password: 'password123', firstName: 'Carlos', lastName: 'García', licenseNumber: 'DOC101', specialization: 'Cardiología', professionalTitle: 'Dr.' },
      { email: 'doctor2@test.com', password: 'password123', firstName: 'Ana', lastName: 'Rodríguez', licenseNumber: 'DOC102', specialization: 'Dermatología', professionalTitle: 'Dra.' },
      { email: 'doctor3@test.com', password: 'password123', firstName: 'Luis', lastName: 'Martínez', licenseNumber: 'DOC103', specialization: 'Ortopedia', professionalTitle: 'Dr.' },
      { email: 'doctor4@test.com', password: 'password123', firstName: 'María', lastName: 'López', licenseNumber: 'DOC104', specialization: 'Ginecología', professionalTitle: 'Dra.' },
      { email: 'doctor5@test.com', password: 'password123', firstName: 'Roberto', lastName: 'González', licenseNumber: 'DOC105', specialization: 'Neurología', professionalTitle: 'Dr.' },
      // Enfermeras (creadas como ASISTENTE)
      { email: 'enfermera1@test.com', password: 'password123', firstName: 'Laura', lastName: 'Gutiérrez', licenseNumber: 'ENF201', specialization: 'Enfermería', professionalTitle: 'Enf.' },
      { email: 'enfermera2@test.com', password: 'password123', firstName: 'Jorge', lastName: 'Ramírez', licenseNumber: 'ENF202', specialization: 'Enfermería', professionalTitle: 'Enf.' },
      { email: 'enfermera3@test.com', password: 'password123', firstName: 'Rosa', lastName: 'Silva', licenseNumber: 'ENF203', specialization: 'Enfermería', professionalTitle: 'Enf.' },
      { email: 'enfermera4@test.com', password: 'password123', firstName: 'Diego', lastName: 'Mendoza', licenseNumber: 'ENF204', specialization: 'Enfermería', professionalTitle: 'Enf.' },
      { email: 'enfermera5@test.com', password: 'password123', firstName: 'Adriana', lastName: 'Cruz', licenseNumber: 'ENF205', specialization: 'Enfermería', professionalTitle: 'Enf.' }
    ];

    // 5 asistentes (User.role = ASISTENTE, sin perfil Doctor)
    const assistants = [
      { email: 'assistant1@test.com', password: 'password123', firstName: 'Asis', lastName: 'Uno' },
      { email: 'assistant2@test.com', password: 'password123', firstName: 'Asis', lastName: 'Dos' },
      { email: 'assistant3@test.com', password: 'password123', firstName: 'Asis', lastName: 'Tres' },
      { email: 'assistant4@test.com', password: 'password123', firstName: 'Asis', lastName: 'Cuatro' },
      { email: 'assistant5@test.com', password: 'password123', firstName: 'Asis', lastName: 'Cinco' }
    ];

    // 5 pacientes
    const patients = [
      { email: 'patient1@test.com', password: 'password123', firstName: 'Paciente', lastName: 'Uno' },
      { email: 'patient2@test.com', password: 'password123', firstName: 'Paciente', lastName: 'Dos' },
      { email: 'patient3@test.com', password: 'password123', firstName: 'Paciente', lastName: 'Tres' },
      { email: 'patient4@test.com', password: 'password123', firstName: 'Paciente', lastName: 'Cuatro' },
      { email: 'patient5@test.com', password: 'password123', firstName: 'Paciente', lastName: 'Cinco' }
    ];

    const createdDoctors = [];

    // Crear staff (doctores con perfil Doctor y enfermeras como ASISTENTE)
    for (const s of staff) {
      const existing = await prisma.user.findUnique({ where: { email: s.email } });
      if (existing) continue;
      const hashed = await bcrypt.hash(s.password, 10);
      const role = s.licenseNumber.startsWith('ENF') ? 'ASISTENTE' : 'DOCTOR';
      const user = await prisma.user.create({
        data: {
          email: s.email,
          password: hashed,
          firstName: s.firstName,
          lastName: s.lastName,
          role
        }
      });
      if (role === 'DOCTOR') {
        const doc = await prisma.doctor.create({
        data: {
          userId: user.id,
            licenseNumber: s.licenseNumber,
            specialization: s.specialization,
            officeAddress: 'Dirección Demo',
            officePhone: '555-0000',
            professionalTitle: s.professionalTitle,
            taxId: 'XAXX010101000',
            taxName: `${s.professionalTitle} ${s.firstName} ${s.lastName}`,
            taxAddress: 'Dirección Fiscal Demo',
            taxCertificateUrl: 'https://example.com/cert.pdf',
          dataConsent: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          accessType: 'subscription'
        }
      });
        await prisma.subscription.create({
        data: {
            doctorId: doc.id,
            paypalSubscriptionId: `sub_${s.licenseNumber}`,
          paypalPlanId: 'plan_basic',
          status: 'active',
          startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        });
        createdDoctors.push(doc);
      }
    }

    // Crear asistentes (usuarios con rol ASISTENTE)
    for (const a of assistants) {
      const existing = await prisma.user.findUnique({ where: { email: a.email } });
      if (existing) continue;
      const hashed = await bcrypt.hash(a.password, 10);
      await prisma.user.create({
        data: { email: a.email, password: hashed, firstName: a.firstName, lastName: a.lastName, role: 'ASISTENTE' }
      });
    }

    // Crear pacientes y vincular TODOS al primer doctor
    let primaryDoctor = createdDoctors[0];
    if (!primaryDoctor) {
      // Si por alguna razón no se creó, obtener cualquiera existente
      primaryDoctor = await prisma.doctor.findFirst();
    }

    for (const p of patients) {
      const existing = await prisma.user.findUnique({ where: { email: p.email } });
      if (existing) continue;
      const hashed = await bcrypt.hash(p.password, 10);
      const user = await prisma.user.create({
        data: { email: p.email, password: hashed, firstName: p.firstName, lastName: p.lastName, role: 'PATIENT' },
        include: { patientProfile: true }
      });

      const patientProfile = await prisma.patient.create({
        data: {
          userId: user.id,
          profilePictureUrl: null,
          taxName: null,
          taxId: null,
          taxAddress: null,
          dataConsent: true,
          dateOfBirth: new Date('1990-01-01'),
          gender: 'No especificado',
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email
        }
      });

      if (primaryDoctor) {
        await prisma.doctorPatient.create({
          data: {
            doctorId: primaryDoctor.id,
            patientId: patientProfile.id,
            status: 'activo',
            context: 'Vinculado automáticamente (tests)',
            specialization: primaryDoctor.specialization
          }
        });
      }
    }

    console.log('Usuarios de prueba creados. Credenciales: password123 para todos.');
  } catch (e) {
    console.error('Error creando usuarios de prueba:', e);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers(); 