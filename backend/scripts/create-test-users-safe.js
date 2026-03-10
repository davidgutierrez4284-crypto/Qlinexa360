const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Script para crear usuarios de prueba de forma segura
 * - 5 Doctores
 * - 5 Pacientes
 * - 5 Asistentes
 * 
 * Respeta los datos existentes: solo crea usuarios que no existan
 * 
 * Uso: node backend/scripts/create-test-users-safe.js
 */

const PASSWORD = 'password123'; // Contraseña común para todos los usuarios de prueba

// Datos de doctores
const doctorsData = [
  {
    email: 'test.doctor1@medilink360.com',
    firstName: 'Dr. Carlos',
    lastName: 'Mendoza',
    phone: '+52 55 1000 0001',
    specialization: 'Cardiología',
    licenseNumber: 'TEST-DOC-001',
    officeAddress: 'Av. Insurgentes Sur 1001, Col. Del Valle, CDMX',
    officePhone: '+52 55 1000 0001',
    professionalTitle: 'Cardiólogo',
    taxId: 'TEST001001',
    taxName: 'Dr. Carlos Mendoza',
    taxAddress: 'Av. Insurgentes Sur 1001, Col. Del Valle, CDMX'
  },
  {
    email: 'test.doctor2@medilink360.com',
    firstName: 'Dra. Laura',
    lastName: 'Fernández',
    phone: '+52 55 1000 0002',
    specialization: 'Pediatría',
    licenseNumber: 'TEST-DOC-002',
    officeAddress: 'Calle Reforma 1002, Col. Centro, CDMX',
    officePhone: '+52 55 1000 0002',
    professionalTitle: 'Pediatra',
    taxId: 'TEST002002',
    taxName: 'Dra. Laura Fernández',
    taxAddress: 'Calle Reforma 1002, Col. Centro, CDMX'
  },
  {
    email: 'test.doctor3@medilink360.com',
    firstName: 'Dr. Roberto',
    lastName: 'Sánchez',
    phone: '+52 55 1000 0003',
    specialization: 'Dermatología',
    licenseNumber: 'TEST-DOC-003',
    officeAddress: 'Blvd. Ávila Camacho 1003, Col. Lomas, CDMX',
    officePhone: '+52 55 1000 0003',
    professionalTitle: 'Dermatólogo',
    taxId: 'TEST003003',
    taxName: 'Dr. Roberto Sánchez',
    taxAddress: 'Blvd. Ávila Camacho 1003, Col. Lomas, CDMX'
  },
  {
    email: 'test.doctor4@medilink360.com',
    firstName: 'Dra. Patricia',
    lastName: 'González',
    phone: '+52 55 1000 0004',
    specialization: 'Ginecología',
    licenseNumber: 'TEST-DOC-004',
    officeAddress: 'Av. Universidad 1004, Col. Coyoacán, CDMX',
    officePhone: '+52 55 1000 0004',
    professionalTitle: 'Ginecóloga',
    taxId: 'TEST004004',
    taxName: 'Dra. Patricia González',
    taxAddress: 'Av. Universidad 1004, Col. Coyoacán, CDMX'
  },
  {
    email: 'test.doctor5@medilink360.com',
    firstName: 'Dr. Fernando',
    lastName: 'Torres',
    phone: '+52 55 1000 0005',
    specialization: 'Ortopedia',
    licenseNumber: 'TEST-DOC-005',
    officeAddress: 'Calle Insurgentes 1005, Col. Roma, CDMX',
    officePhone: '+52 55 1000 0005',
    professionalTitle: 'Ortopedista',
    taxId: 'TEST005005',
    taxName: 'Dr. Fernando Torres',
    taxAddress: 'Calle Insurgentes 1005, Col. Roma, CDMX'
  }
];

// Datos de pacientes
const patientsData = [
  {
    email: 'test.paciente1@medilink360.com',
    firstName: 'Ana',
    lastName: 'Martínez',
    phone: '+52 55 2000 0001',
    dateOfBirth: new Date('1990-05-15'),
    gender: 'Femenino',
    address: 'Calle Morelos 2001, Col. Centro, CDMX',
    bloodType: 'O+',
    allergies: 'Ninguna',
    chronicDiseases: null
  },
  {
    email: 'test.paciente2@medilink360.com',
    firstName: 'Juan',
    lastName: 'Pérez',
    phone: '+52 55 2000 0002',
    dateOfBirth: new Date('1985-08-20'),
    gender: 'Masculino',
    address: 'Av. Juárez 2002, Col. Centro, CDMX',
    bloodType: 'A+',
    allergies: 'Penicilina',
    chronicDiseases: 'Hipertensión'
  },
  {
    email: 'test.paciente3@medilink360.com',
    firstName: 'María',
    lastName: 'López',
    phone: '+52 55 2000 0003',
    dateOfBirth: new Date('1992-03-10'),
    gender: 'Femenino',
    address: 'Calle Hidalgo 2003, Col. Centro, CDMX',
    bloodType: 'B+',
    allergies: null,
    chronicDiseases: null
  },
  {
    email: 'test.paciente4@medilink360.com',
    firstName: 'Carlos',
    lastName: 'García',
    phone: '+52 55 2000 0004',
    dateOfBirth: new Date('1988-11-25'),
    gender: 'Masculino',
    address: 'Blvd. Miguel Alemán 2004, Col. Centro, CDMX',
    bloodType: 'AB+',
    allergies: 'Ibuprofeno',
    chronicDiseases: 'Asma'
  },
  {
    email: 'test.paciente5@medilink360.com',
    firstName: 'Sofía',
    lastName: 'Rodríguez',
    phone: '+52 55 2000 0005',
    dateOfBirth: new Date('1995-07-30'),
    gender: 'Femenino',
    address: 'Calle Allende 2005, Col. Centro, CDMX',
    bloodType: 'O-',
    allergies: null,
    chronicDiseases: 'Diabetes tipo 2'
  }
];

// Datos de asistentes
const assistantsData = [
  {
    email: 'test.asistente1@medilink360.com',
    firstName: 'Carmen',
    lastName: 'Vega',
    phone: '+52 55 3000 0001'
  },
  {
    email: 'test.asistente2@medilink360.com',
    firstName: 'Miguel',
    lastName: 'Cruz',
    phone: '+52 55 3000 0002'
  },
  {
    email: 'test.asistente3@medilink360.com',
    firstName: 'Rosa',
    lastName: 'Silva',
    phone: '+52 55 3000 0003'
  },
  {
    email: 'test.asistente4@medilink360.com',
    firstName: 'Diego',
    lastName: 'Mendoza',
    phone: '+52 55 3000 0004'
  },
  {
    email: 'test.asistente5@medilink360.com',
    firstName: 'Adriana',
    lastName: 'Morales',
    phone: '+52 55 3000 0005'
  }
];

// Almacenar credenciales creadas
const createdCredentials = {
  doctors: [],
  patients: [],
  assistants: []
};

async function createDoctors() {
  console.log('\n👨‍⚕️ Creando doctores...\n');
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  for (const doctorData of doctorsData) {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: doctorData.email }
      });

      if (existingUser) {
        console.log(`⚠️  Doctor ya existe: ${doctorData.email} - Omitiendo`);
        continue;
      }

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          email: doctorData.email,
          password: hashedPassword,
          firstName: doctorData.firstName,
          lastName: doctorData.lastName,
          phone: doctorData.phone,
          role: 'DOCTOR'
        }
      });

      // Crear perfil de doctor
      const doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          licenseNumber: doctorData.licenseNumber,
          specialization: doctorData.specialization,
          officeAddress: doctorData.officeAddress,
          officePhone: doctorData.officePhone,
          professionalTitle: doctorData.professionalTitle,
          taxId: doctorData.taxId,
          taxName: doctorData.taxName,
          taxAddress: doctorData.taxAddress,
          taxCertificateUrl: 'https://example.com/cert.pdf',
          dataConsent: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          accessType: 'PREMIUM'
        }
      });

      // Crear suscripción activa
      await prisma.subscription.create({
        data: {
          doctorId: doctor.id,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
          paypalSubscriptionId: `test_sub_${doctor.id}`,
          paypalPlanId: `plan_premium_${doctor.id}`
        }
      });

      createdCredentials.doctors.push({
        email: doctorData.email,
        password: PASSWORD,
        name: `${doctorData.firstName} ${doctorData.lastName}`,
        specialization: doctorData.specialization
      });

      console.log(`✅ Doctor creado: ${doctorData.firstName} ${doctorData.lastName} - ${doctorData.specialization}`);
    } catch (error) {
      console.error(`❌ Error al crear doctor ${doctorData.email}:`, error.message);
    }
  }
}

async function createPatients() {
  console.log('\n👥 Creando pacientes...\n');
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  // Obtener el primer doctor para vincular los pacientes
  const firstDoctor = await prisma.doctor.findFirst({
    include: { user: true }
  });

  if (!firstDoctor) {
    console.log('⚠️  No se encontró ningún doctor. Los pacientes se crearán sin vínculo.');
    console.log('   Puedes vincularlos después usando: node scripts/link-patients-to-doctor.js\n');
  } else {
    console.log(`📋 Los pacientes se vincularán con: ${firstDoctor.user.firstName} ${firstDoctor.user.lastName} (${firstDoctor.user.email})\n`);
  }

  for (const patientData of patientsData) {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: patientData.email }
      });

      if (existingUser) {
        console.log(`⚠️  Paciente ya existe: ${patientData.email} - Omitiendo`);
        continue;
      }

      // Crear usuario
      const user = await prisma.user.create({
        data: {
          email: patientData.email,
          password: hashedPassword,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          phone: patientData.phone,
          role: 'PATIENT'
        }
      });

      // Crear perfil de paciente
      const patient = await prisma.patient.create({
        data: {
          userId: user.id,
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender,
          phone: patientData.phone,
          address: patientData.address,
          bloodType: patientData.bloodType,
          allergies: patientData.allergies,
          chronicDiseases: patientData.chronicDiseases,
          dataConsent: true,
          dataConsentAt: new Date()
        }
      });

      // Vincular paciente con el primer doctor si existe
      if (firstDoctor) {
        try {
          // Verificar si ya existe el vínculo
          const existingLink = await prisma.doctorPatient.findUnique({
            where: {
              doctorId_patientId: {
                doctorId: firstDoctor.id,
                patientId: patient.id
              }
            }
          });

          if (!existingLink) {
            await prisma.doctorPatient.create({
              data: {
                doctorId: firstDoctor.id,
                patientId: patient.id,
                status: 'ACTIVE',
                specialization: firstDoctor.specialization || 'Medicina General',
                context: 'Paciente de prueba - Vinculado automáticamente',
                startDate: new Date()
              }
            });
            console.log(`✅ Paciente creado y vinculado: ${patientData.firstName} ${patientData.lastName}`);
          } else {
            console.log(`✅ Paciente creado: ${patientData.firstName} ${patientData.lastName} (ya estaba vinculado)`);
          }
        } catch (linkError) {
          console.log(`✅ Paciente creado: ${patientData.firstName} ${patientData.lastName} (error al vincular: ${linkError.message})`);
        }
      } else {
        console.log(`✅ Paciente creado: ${patientData.firstName} ${patientData.lastName}`);
      }

      createdCredentials.patients.push({
        email: patientData.email,
        password: PASSWORD,
        name: `${patientData.firstName} ${patientData.lastName}`,
        dateOfBirth: patientData.dateOfBirth.toLocaleDateString('es-ES')
      });
    } catch (error) {
      console.error(`❌ Error al crear paciente ${patientData.email}:`, error.message);
    }
  }
}

async function createAssistants() {
  console.log('\n👩‍💼 Creando asistentes...\n');
  const hashedPassword = await bcrypt.hash(PASSWORD, 10);

  for (const assistantData of assistantsData) {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: assistantData.email }
      });

      if (existingUser) {
        console.log(`⚠️  Asistente ya existe: ${assistantData.email} - Omitiendo`);
        continue;
      }

      // Crear usuario (los asistentes solo necesitan ser usuarios con rol ASISTENTE)
      const user = await prisma.user.create({
        data: {
          email: assistantData.email,
          password: hashedPassword,
          firstName: assistantData.firstName,
          lastName: assistantData.lastName,
          phone: assistantData.phone,
          role: 'ASISTENTE'
        }
      });

      createdCredentials.assistants.push({
        email: assistantData.email,
        password: PASSWORD,
        name: `${assistantData.firstName} ${assistantData.lastName}`
      });

      console.log(`✅ Asistente creado: ${assistantData.firstName} ${assistantData.lastName}`);
    } catch (error) {
      console.error(`❌ Error al crear asistente ${assistantData.email}:`, error.message);
    }
  }
}

function printCredentials() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 CREDENCIALES DE USUARIOS CREADOS');
  console.log('='.repeat(80));
  
  console.log('\n👨‍⚕️ DOCTORES:');
  console.log('-'.repeat(80));
  if (createdCredentials.doctors.length === 0) {
    console.log('   (Ningún doctor nuevo fue creado)');
  } else {
    createdCredentials.doctors.forEach((doc, index) => {
      console.log(`\n   ${index + 1}. ${doc.name}`);
      console.log(`      Email: ${doc.email}`);
      console.log(`      Contraseña: ${doc.password}`);
      console.log(`      Especialidad: ${doc.specialization}`);
    });
  }

  console.log('\n👥 PACIENTES:');
  console.log('-'.repeat(80));
  if (createdCredentials.patients.length === 0) {
    console.log('   (Ningún paciente nuevo fue creado)');
  } else {
    createdCredentials.patients.forEach((pat, index) => {
      console.log(`\n   ${index + 1}. ${pat.name}`);
      console.log(`      Email: ${pat.email}`);
      console.log(`      Contraseña: ${pat.password}`);
      console.log(`      Fecha de Nacimiento: ${pat.dateOfBirth}`);
    });
  }

  console.log('\n👩‍💼 ASISTENTES:');
  console.log('-'.repeat(80));
  if (createdCredentials.assistants.length === 0) {
    console.log('   (Ningún asistente nuevo fue creado)');
  } else {
    createdCredentials.assistants.forEach((ast, index) => {
      console.log(`\n   ${index + 1}. ${ast.name}`);
      console.log(`      Email: ${ast.email}`);
      console.log(`      Contraseña: ${ast.password}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 RESUMEN:`);
  console.log(`   Doctores creados: ${createdCredentials.doctors.length}/5`);
  console.log(`   Pacientes creados: ${createdCredentials.patients.length}/5`);
  console.log(`   Asistentes creados: ${createdCredentials.assistants.length}/5`);
  console.log(`\n🔑 Contraseña común para todos: ${PASSWORD}`);
  console.log('='.repeat(80) + '\n');
}

async function main() {
  try {
    console.log('🚀 Iniciando creación de usuarios de prueba...');
    console.log('⚠️  Este script respeta los datos existentes (no elimina nada)');
    console.log('⚠️  Solo crea usuarios que no existan previamente\n');

    await createDoctors();
    await createPatients();
    await createAssistants();

    printCredentials();

    console.log('✅ Proceso completado exitosamente!');
  } catch (error) {
    console.error('❌ Error durante la creación de usuarios:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });

