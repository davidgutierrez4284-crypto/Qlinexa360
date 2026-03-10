const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Datos de plantillas de especialidad
const especialidades = [
  {
    name: 'Alergología e Inmunología',
    specialty: 'ALERGOLOGIA_INMUNOLOGIA',
    fields: [
      { label: 'Alergeno principal', fieldType: 'TEXT', placeholder: 'Ej: Polen, polvo, alimentos', isRequired: true },
      { label: 'Tipo de reacción', fieldType: 'SELECT', options: ['Anafilaxia', 'Urticaria', 'Rinitis', 'Asma', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Pruebas realizadas', fieldType: 'TEXT', placeholder: 'Ej: Prick test, IgE', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Anestesiología',
    specialty: 'ANESTESIOLOGIA',
    fields: [
      { label: 'Tipo de anestesia', fieldType: 'SELECT', options: ['General', 'Regional', 'Local', 'Sedación'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Fármacos utilizados', fieldType: 'TEXT', placeholder: 'Ej: Propofol, Fentanilo', isRequired: true },
      { label: 'Complicaciones', fieldType: 'TEXTAREA', placeholder: 'Describir complicaciones', isRequired: false },
      { label: 'Monitorización', fieldType: 'TEXT', placeholder: 'Ej: ECG, SatO2, TA', isRequired: false },
      { label: 'Recuperación', fieldType: 'TEXTAREA', placeholder: 'Describir recuperación', isRequired: false },
    ]
  },
  {
    name: 'Cardiología',
    specialty: 'CARDIOLOGIA',
    fields: [
      { label: 'Presión arterial', fieldType: 'TEXT', placeholder: 'Ej: 120/80 mmHg', isRequired: true },
      { label: 'Frecuencia cardíaca', fieldType: 'NUMBER', placeholder: 'Latidos por minuto', isRequired: true },
      { label: 'Síntomas principales', fieldType: 'SELECT', options: ['Dolor torácico', 'Disnea', 'Palpitaciones', 'Edema', 'Síncope'], placeholder: 'Seleccionar síntoma', isRequired: true },
      { label: 'Electrocardiograma', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Cirugía General',
    specialty: 'CIRUGIA_GENERAL',
    fields: [
      { label: 'Diagnóstico preoperatorio', fieldType: 'TEXT', placeholder: 'Ej: Apendicitis aguda', isRequired: true },
      { label: 'Procedimiento realizado', fieldType: 'TEXT', placeholder: 'Ej: Apendicectomía', isRequired: true },
      { label: 'Hallazgos intraoperatorios', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Complicaciones', fieldType: 'TEXTAREA', placeholder: 'Describir complicaciones', isRequired: false },
      { label: 'Evolución postoperatoria', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Dermatología',
    specialty: 'DERMATOLOGIA',
    fields: [
      { label: 'Tipo de lesión', fieldType: 'SELECT', options: ['Erupción', 'Lunar', 'Acné', 'Psoriasis', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Localización', fieldType: 'TEXT', placeholder: 'Ej: Cara, brazos', isRequired: true },
      { label: 'Tiempo de evolución', fieldType: 'TEXT', placeholder: 'Ej: 2 semanas', isRequired: false },
      { label: 'Síntomas asociados', fieldType: 'TEXTAREA', placeholder: 'Picazón, dolor, ardor', isRequired: false },
      { label: 'Tratamiento previo', fieldType: 'TEXT', placeholder: 'Ej: Cremas, antibióticos', isRequired: false },
    ]
  },
  {
    name: 'Endocrinología',
    specialty: 'ENDOCRINOLOGIA',
    fields: [
      { label: 'Diagnóstico endocrino', fieldType: 'TEXT', placeholder: 'Ej: Diabetes tipo 2', isRequired: true },
      { label: 'Glucosa en ayunas', fieldType: 'NUMBER', placeholder: 'mg/dL', isRequired: true },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Complicaciones', fieldType: 'TEXTAREA', placeholder: 'Describir complicaciones', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Gastroenterología',
    specialty: 'GASTROENTEROLOGIA',
    fields: [
      { label: 'Síntoma principal', fieldType: 'SELECT', options: ['Dolor abdominal', 'Náusea', 'Vómito', 'Diarrea', 'Estreñimiento'], placeholder: 'Seleccionar síntoma', isRequired: true },
      { label: 'Duración de síntomas', fieldType: 'TEXT', placeholder: 'Ej: 3 días', isRequired: true },
      { label: 'Antecedentes digestivos', fieldType: 'TEXTAREA', placeholder: 'Ej: Gastritis, úlcera', isRequired: false },
      { label: 'Estudios realizados', fieldType: 'TEXT', placeholder: 'Ej: Endoscopía, colonoscopía', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Geriatría',
    specialty: 'GERIATRIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Caídas, deterioro cognitivo', isRequired: true },
      { label: 'Escala de Barthel', fieldType: 'NUMBER', placeholder: '0-100', isRequired: false },
      { label: 'Comorbilidades', fieldType: 'TEXTAREA', placeholder: 'Ej: Diabetes, hipertensión', isRequired: false },
      { label: 'Medicamentos actuales', fieldType: 'TEXT', placeholder: 'Listar medicamentos', isRequired: false },
      { label: 'Evaluación cognitiva', fieldType: 'TEXTAREA', placeholder: 'Describir evaluación', isRequired: false },
    ]
  },
  {
    name: 'Ginecología y Obstetricia',
    specialty: 'GINECOLOGIA_OBSTETRICIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Control prenatal, dolor pélvico', isRequired: true },
      { label: 'FUM (Fecha última menstruación)', fieldType: 'TEXT', placeholder: 'DD/MM/AAAA', isRequired: false },
      { label: 'Gestas/Partos/Abortos', fieldType: 'TEXT', placeholder: 'Ej: G2P1A0', isRequired: false },
      { label: 'Antecedentes ginecológicos', fieldType: 'TEXTAREA', placeholder: 'Describir antecedentes', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Neurología',
    specialty: 'NEUROLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Dolor de cabeza, convulsiones', isRequired: true },
      { label: 'Síntomas neurológicos', fieldType: 'SELECT', options: ['Cefalea', 'Convulsiones', 'Parestesias', 'Paresia', 'Otro'], placeholder: 'Seleccionar síntoma', isRequired: true },
      { label: 'Examen neurológico', fieldType: 'TEXTAREA', placeholder: 'Describir examen', isRequired: false },
      { label: 'Estudios realizados', fieldType: 'TEXT', placeholder: 'Ej: TAC, RMN, EEG', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Oftalmología',
    specialty: 'OFTALMOLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Dolor ocular, visión borrosa', isRequired: true },
      { label: 'Agudeza visual', fieldType: 'TEXT', placeholder: 'Ej: 20/20, 20/40', isRequired: true },
      { label: 'Presión intraocular', fieldType: 'NUMBER', placeholder: 'mmHg', isRequired: false },
      { label: 'Examen oftalmológico', fieldType: 'TEXTAREA', placeholder: 'Describir examen', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Ortopedia',
    specialty: 'ORTOPEDIA',
    fields: [
      { label: 'Tipo de lesión', fieldType: 'SELECT', options: ['Fractura', 'Esguince', 'Luxación', 'Tendinitis', 'Artritis'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Localización', fieldType: 'TEXT', placeholder: 'Ej: Brazo derecho, rodilla', isRequired: true },
      { label: 'Mecanismo de lesión', fieldType: 'TEXTAREA', placeholder: 'Describir cómo ocurrió', isRequired: false },
      { label: 'Radiografías', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
    ]
  },
  {
    name: 'Pediatría',
    specialty: 'PEDIATRIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Fiebre, dolor abdominal', isRequired: true },
      { label: 'Edad del paciente', fieldType: 'NUMBER', placeholder: 'Años', isRequired: true },
      { label: 'Peso', fieldType: 'NUMBER', placeholder: 'kg', isRequired: false },
      { label: 'Talla', fieldType: 'NUMBER', placeholder: 'cm', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Psiquiatría',
    specialty: 'PSIQUIATRIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Alucinaciones, insomnio', isRequired: true },
      { label: 'Diagnóstico', fieldType: 'TEXT', placeholder: 'Ej: Esquizofrenia, depresión', isRequired: false },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Medicamentos', fieldType: 'TEXT', placeholder: 'Ej: Antipsicóticos, antidepresivos', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Enfermería (heridas, estomas y quemaduras)',
    specialty: 'ENFERMERIA',
    fields: [
      { label: 'Tipo de herida/estoma/quemadura', fieldType: 'SELECT', options: ['Herida', 'Estoma', 'Quemadura'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Localización', fieldType: 'TEXT', placeholder: 'Ej: Abdomen, brazo', isRequired: true },
      { label: 'Tamaño', fieldType: 'TEXT', placeholder: 'Ej: 5x3 cm', isRequired: false },
      { label: 'Tratamiento realizado', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  }
];

// Datos de prueba para doctores
const doctorsData = [
  {
    user: {
      email: 'dr.garcia@test.com',
      password: 'password123',
      firstName: 'Dr. María',
      lastName: 'García',
      role: 'DOCTOR'
    },
    doctor: {
      specialization: 'Cardiología',
      licenseNumber: 'CARD-001-2024',
      officeAddress: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX',
      officePhone: '+52 55 1234 5678',
      professionalTitle: 'Cardiólogo',
      taxId: 'CARD001001',
      taxName: 'Dr. María García',
      taxAddress: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX',
      taxCertificateUrl: 'https://example.com/cert.pdf',
      dataConsent: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      accessType: 'PREMIUM'
    },
    subscription: {
      status: 'ACTIVE',
      paypalSubscriptionId: 'test_sub_001',
      paypalPlanId: 'plan_premium_001'
    }
  },
  {
    user: {
      email: 'dr.rodriguez@test.com',
      password: 'password123',
      firstName: 'Dr. Carlos',
      lastName: 'Rodríguez',
      role: 'DOCTOR'
    },
    doctor: {
      specialization: 'Pediatría',
      licenseNumber: 'PED-002-2024',
      officeAddress: 'Calle Reforma 567, Col. Centro, CDMX',
      officePhone: '+52 55 2345 6789',
      professionalTitle: 'Pediatra',
      taxId: 'PED002002',
      taxName: 'Dr. Carlos Rodríguez',
      taxAddress: 'Calle Reforma 567, Col. Centro, CDMX',
      taxCertificateUrl: 'https://example.com/cert.pdf',
      dataConsent: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      accessType: 'PREMIUM'
    },
    subscription: {
      status: 'ACTIVE',
      paypalSubscriptionId: 'test_sub_002',
      paypalPlanId: 'plan_premium_002'
    }
  },
  {
    user: {
      email: 'dr.martinez@test.com',
      password: 'password123',
      firstName: 'Dra. Ana',
      lastName: 'Martínez',
      role: 'DOCTOR'
    },
    doctor: {
      specialization: 'Dermatología',
      licenseNumber: 'DERM-003-2024',
      officeAddress: 'Blvd. Ávila Camacho 890, Col. Lomas, CDMX',
      officePhone: '+52 55 3456 7890',
      professionalTitle: 'Dermatóloga',
      taxId: 'DERM003003',
      taxName: 'Dra. Ana Martínez',
      taxAddress: 'Blvd. Ávila Camacho 890, Col. Lomas, CDMX',
      taxCertificateUrl: 'https://example.com/cert.pdf',
      dataConsent: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      accessType: 'PREMIUM'
    },
    subscription: {
      status: 'ACTIVE',
      paypalSubscriptionId: 'test_sub_003',
      paypalPlanId: 'plan_premium_003'
    }
  },
  {
    user: {
      email: 'dr.lopez@test.com',
      password: 'password123',
      firstName: 'Dr. Juan',
      lastName: 'López',
      role: 'DOCTOR'
    },
    doctor: {
      specialization: 'Ortopedia',
      licenseNumber: 'ORT-004-2024',
      officeAddress: 'Calle Tuxpan 234, Col. Roma Norte, CDMX',
      officePhone: '+52 55 4567 8901',
      professionalTitle: 'Ortopedista',
      taxId: 'ORT004004',
      taxName: 'Dr. Juan López',
      taxAddress: 'Calle Tuxpan 234, Col. Roma Norte, CDMX',
      taxCertificateUrl: 'https://example.com/cert.pdf',
      dataConsent: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      accessType: 'PREMIUM'
    },
    subscription: {
      status: 'ACTIVE',
      paypalSubscriptionId: 'test_sub_004',
      paypalPlanId: 'plan_premium_004'
    }
  },
  {
    user: {
      email: 'dr.hernandez@test.com',
      password: 'password123',
      firstName: 'Dra. Patricia',
      lastName: 'Hernández',
      role: 'DOCTOR'
    },
    doctor: {
      specialization: 'Ginecología',
      licenseNumber: 'GIN-005-2024',
      officeAddress: 'Av. Universidad 456, Col. Coyoacán, CDMX',
      officePhone: '+52 55 5678 9012',
      professionalTitle: 'Ginecóloga',
      taxId: 'GIN005005',
      taxName: 'Dra. Patricia Hernández',
      taxAddress: 'Av. Universidad 456, Col. Coyoacán, CDMX',
      taxCertificateUrl: 'https://example.com/cert.pdf',
      dataConsent: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      accessType: 'PREMIUM'
    },
    subscription: {
      status: 'ACTIVE',
      paypalSubscriptionId: 'test_sub_005',
      paypalPlanId: 'plan_premium_005'
    }
  }
];

// Datos de prueba para asistentes
const assistantsData = [
  {
    user: {
      email: 'asistente.garcia@test.com',
      password: 'password123',
      firstName: 'Sofía',
      lastName: 'García',
      role: 'ASISTENTE'
    },
    assistant: {
      phone: '+52 55 1111 2222',
      address: 'Calle Morelos 123, Col. Centro, CDMX',
      experience: '3 años en administración médica'
    }
  },
  {
    user: {
      email: 'asistente.rodriguez@test.com',
      password: 'password123',
      firstName: 'Miguel',
      lastName: 'Rodríguez',
      role: 'ASISTENTE'
    },
    assistant: {
      phone: '+52 55 2222 3333',
      address: 'Av. Juárez 456, Col. Centro, CDMX',
      experience: '5 años en atención al paciente'
    }
  },
  {
    user: {
      email: 'asistente.martinez@test.com',
      password: 'password123',
      firstName: 'Carmen',
      lastName: 'Martínez',
      role: 'ASISTENTE'
    },
    assistant: {
      phone: '+52 55 3333 4444',
      address: 'Calle Hidalgo 789, Col. Centro, CDMX',
      experience: '2 años en coordinación médica'
    }
  },
  {
    user: {
      email: 'asistente.lopez@test.com',
      password: 'password123',
      firstName: 'Roberto',
      lastName: 'López',
      role: 'ASISTENTE'
    },
    assistant: {
      phone: '+52 55 4444 5555',
      address: 'Blvd. Miguel Alemán 321, Col. Centro, CDMX',
      experience: '4 años en gestión de citas'
    }
  },
  {
    user: {
      email: 'asistente.hernandez@test.com',
      password: 'password123',
      firstName: 'Lucía',
      lastName: 'Hernández',
      role: 'ASISTENTE'
    },
    assistant: {
      phone: '+52 55 5555 6666',
      address: 'Calle Allende 654, Col. Centro, CDMX',
      experience: '6 años en administración clínica'
    }
  }
];

// Datos de prueba para pacientes
const patientsData = [
  {
    user: {
      email: 'paciente.garcia@test.com',
      password: 'password123',
      firstName: 'Roberto',
      lastName: 'García',
      role: 'PATIENT'
    },
    patient: {
      dateOfBirth: new Date('1985-03-15'),
      gender: 'Masculino',
      phone: '+52 55 7777 8888',
      address: 'Calle Guerrero 123, Col. Centro, CDMX',
      dataConsent: true,
      emergencyContact: {
        firstName: 'María',
        lastName: 'García',
        phone: '+52 55 8888 9999',
        email: 'maria.garcia@email.com',
        relationship: 'Esposa'
      }
    }
  },
  {
    user: {
      email: 'paciente.rodriguez@test.com',
      password: 'password123',
      firstName: 'Isabel',
      lastName: 'Rodríguez',
      role: 'PATIENT'
    },
    patient: {
      dateOfBirth: new Date('1990-07-22'),
      gender: 'Femenino',
      phone: '+52 55 9999 0000',
      address: 'Av. Madero 456, Col. Centro, CDMX',
      dataConsent: true,
      emergencyContact: {
        firstName: 'Carlos',
        lastName: 'Rodríguez',
        phone: '+52 55 0000 1111',
        email: 'carlos.rodriguez@email.com',
        relationship: 'Hermano'
      }
    }
  },
  {
    user: {
      email: 'paciente.martinez@test.com',
      password: 'password123',
      firstName: 'Fernando',
      lastName: 'Martínez',
      role: 'PATIENT'
    },
    patient: {
      dateOfBirth: new Date('1988-11-08'),
      gender: 'Masculino',
      phone: '+52 55 1111 2222',
      address: 'Calle 5 de Mayo 789, Col. Centro, CDMX',
      dataConsent: true,
      emergencyContact: {
        firstName: 'Ana',
        lastName: 'Martínez',
        phone: '+52 55 2222 3333',
        email: 'ana.martinez@email.com',
        relationship: 'Madre'
      }
    }
  },
  {
    user: {
      email: 'paciente.lopez@test.com',
      password: 'password123',
      firstName: 'Diana',
      lastName: 'López',
      role: 'PATIENT'
    },
    patient: {
      dateOfBirth: new Date('1992-04-12'),
      gender: 'Femenino',
      phone: '+52 55 3333 4444',
      address: 'Blvd. Constitución 321, Col. Centro, CDMX',
      dataConsent: true,
      emergencyContact: {
        firstName: 'Juan',
        lastName: 'López',
        phone: '+52 55 4444 5555',
        email: 'juan.lopez@email.com',
        relationship: 'Padre'
      }
    }
  },
  {
    user: {
      email: 'paciente.hernandez@test.com',
      password: 'password123',
      firstName: 'Alejandro',
      lastName: 'Hernández',
      role: 'PATIENT'
    },
    patient: {
      dateOfBirth: new Date('1987-09-30'),
      gender: 'Masculino',
      phone: '+52 55 5555 6666',
      address: 'Calle Independencia 654, Col. Centro, CDMX',
      dataConsent: true,
      emergencyContact: {
        firstName: 'Patricia',
        lastName: 'Hernández',
        phone: '+52 55 6666 7777',
        email: 'patricia.hernandez@email.com',
        relationship: 'Hermana'
      }
    }
  }
];

// Función para crear plantillas de formulario de especialidad
async function seedSpecialtyTemplates() {
  try {
    console.log('🌱 Creando plantillas de especialidad...');
    // Ordenar alfabéticamente por nombre
    especialidades.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    for (const esp of especialidades) {
      // Evitar duplicados
      const exists = await prisma.formTemplate.findFirst({ where: { name: esp.name } });
      if (exists) {
        console.log(`⏭️  Ya existe: ${esp.name}`);
        continue;
      }
      const template = await prisma.formTemplate.create({
        data: {
          name: esp.name,
          specialty: esp.specialty,
          description: `Formulario para ${esp.name.toLowerCase()}`,
          fields: {
            create: esp.fields.map((f, idx) => ({
              label: f.label,
              fieldType: f.fieldType,
              placeholder: f.placeholder || '',
              options: f.options || [],
              isRequired: f.isRequired,
              order: idx + 1
            }))
          }
        }
      });
      console.log(`✅ Creada: ${template.name}`);
    }
    console.log('\n🎉 ¡Plantillas de especialidad creadas y listas!');
  } catch (error) {
    console.error('❌ Error al crear plantillas:', error);
  }
}

async function seedTestUsers() {
  try {
    console.log('🚀 Iniciando migración de usuarios de prueba...');

    // Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    // Eliminar en orden correcto para respetar las restricciones de clave foránea
    try {
      await prisma.doctorPatient.deleteMany();
      console.log('✅ Relaciones doctor-paciente eliminadas');
    } catch (e) {
      console.log('⚠️ No hay relaciones doctor-paciente para eliminar');
    }
    
    try {
      await prisma.emergencyContact.deleteMany();
      console.log('✅ Contactos de emergencia eliminados');
    } catch (e) {
      console.log('⚠️ No hay contactos de emergencia para eliminar');
    }
    
    try {
      await prisma.patient.deleteMany();
      console.log('✅ Pacientes eliminados');
    } catch (e) {
      console.log('⚠️ No hay pacientes para eliminar');
    }
    
    try {
      await prisma.asistenteDoctorVinculo.deleteMany();
      console.log('✅ Vínculos asistente-doctor eliminados');
    } catch (e) {
      console.log('⚠️ No hay vínculos asistente-doctor para eliminar');
    }
    
    try {
      await prisma.subscription.deleteMany();
      console.log('✅ Suscripciones eliminadas');
    } catch (e) {
      console.log('⚠️ No hay suscripciones para eliminar');
    }
    
    try {
      await prisma.doctor.deleteMany();
      console.log('✅ Doctores eliminados');
    } catch (e) {
      console.log('⚠️ No hay doctores para eliminar');
    }
    
    try {
      await prisma.user.deleteMany();
      console.log('✅ Usuarios eliminados');
    } catch (e) {
      console.log('⚠️ No hay usuarios para eliminar');
    }

    console.log('✅ Datos limpiados exitosamente');

    // Crear doctores con suscripciones
    console.log('👨‍⚕️ Creando doctores con suscripciones...');
    for (const doctorData of doctorsData) {
      // Crear usuario
      const hashedPassword = await bcrypt.hash(doctorData.user.password, 10);
      const user = await prisma.user.create({
        data: {
          ...doctorData.user,
          password: hashedPassword
        }
      });

      // Crear perfil de doctor
      const doctor = await prisma.doctor.create({
        data: {
          userId: user.id,
          ...doctorData.doctor
        }
      });

      // Crear suscripción activa
      const subscription = await prisma.subscription.create({
        data: {
          doctorId: doctor.id,
          ...doctorData.subscription,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 año
        }
      });

      console.log(`✅ Doctor creado: ${user.firstName} ${user.lastName} - ${doctor.specialization}`);
    }

    // Crear asistentes
    console.log('👩‍💼 Creando asistentes...');
    for (const assistantData of assistantsData) {
      const hashedPassword = await bcrypt.hash(assistantData.user.password, 10);
      const user = await prisma.user.create({
        data: {
          ...assistantData.user,
          password: hashedPassword
        }
      });

      console.log(`✅ Asistente creado: ${user.firstName} ${user.lastName}`);
    }

    // Crear pacientes
    console.log('👥 Creando pacientes...');
    for (const patientData of patientsData) {
      const hashedPassword = await bcrypt.hash(patientData.user.password, 10);
      const user = await prisma.user.create({
        data: {
          ...patientData.user,
          password: hashedPassword
        }
      });

      const patient = await prisma.patient.create({
        data: {
          userId: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          dateOfBirth: patientData.patient.dateOfBirth,
          gender: patientData.patient.gender,
          phone: patientData.patient.phone,
          address: patientData.patient.address,
          dataConsent: patientData.patient.dataConsent
        }
      });

      // Crear contacto de emergencia
      await prisma.emergencyContact.create({
        data: {
          patientId: patient.id,
          ...patientData.patient.emergencyContact
        }
      });

      console.log(`✅ Paciente creado: ${user.firstName} ${user.lastName}`);
    }

    // Asignar algunos pacientes a doctores para pruebas
    console.log('🔗 Asignando pacientes a doctores...');
    const doctors = await prisma.doctor.findMany();
    const patients = await prisma.patient.findMany();

    // Asignar 2-3 pacientes a cada doctor
    for (let i = 0; i < doctors.length; i++) {
      const doctor = doctors[i];
      const startIndex = i * 2;
      const endIndex = Math.min(startIndex + 2, patients.length);
      
      for (let j = startIndex; j < endIndex; j++) {
        if (patients[j]) {
          await prisma.doctorPatient.create({
            data: {
              doctorId: doctor.id,
              patientId: patients[j].id,
              startDate: new Date(),
              status: 'ACTIVE',
              context: 'Asignación automática para pruebas',
              specialization: 'General'
            }
          });
        }
      }
    }

    // Crear plantillas de formulario de especialidad
    console.log('\n🌱 Creando plantillas de formulario de especialidad...');
    await seedSpecialtyTemplates();

    console.log('🎉 Migración de usuarios de prueba completada exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   👨‍⚕️ Doctores: ${doctorsData.length} (todos con suscripción activa)`);
    console.log(`   👩‍💼 Asistentes: ${assistantsData.length}`);
    console.log(`   👥 Pacientes: ${patientsData.length}`);
    console.log(`   📋 Plantillas de formulario: ${especialidades.length} especialidades`);
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Todos los usuarios usan: password123');
    console.log('\n📧 Emails de doctores:');
    doctorsData.forEach(d => console.log(`   - ${d.user.email}`));
    console.log('\n📧 Emails de asistentes:');
    assistantsData.forEach(a => console.log(`   - ${a.user.email}`));
    console.log('\n📧 Emails de pacientes:');
    patientsData.forEach(p => console.log(`   - ${p.user.email}`));

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
seedTestUsers();
