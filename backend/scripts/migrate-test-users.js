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
    name: 'Ginecología y Obstetricia',
    specialty: 'GINECOLOGIA_OBSTETRICIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Control prenatal, dolor pélvico', isRequired: true },
      { label: 'FUM (Fecha última menstruación)', fieldType: 'TEXT', placeholder: 'DD/MM/AAAA', isRequired: false },
      { label: 'Gestas/Partos/Abortos', fieldType: 'TEXT', placeholder: 'Ej: G2P1A0', isRequired: false },
      { label: 'Exploración ginecológica', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
    ]
  },
  {
    name: 'Hematología',
    specialty: 'HEMATOLOGIA',
    fields: [
      { label: 'Diagnóstico hematológico', fieldType: 'TEXT', placeholder: 'Ej: Anemia ferropénica', isRequired: true },
      { label: 'Hemoglobina', fieldType: 'NUMBER', placeholder: 'g/dL', isRequired: true },
      { label: 'Leucocitos', fieldType: 'NUMBER', placeholder: 'x10^3/µL', isRequired: false },
      { label: 'Plaquetas', fieldType: 'NUMBER', placeholder: 'x10^3/µL', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
    ]
  },
  {
    name: 'Infectología',
    specialty: 'INFECTOLOGIA',
    fields: [
      { label: 'Diagnóstico infeccioso', fieldType: 'TEXT', placeholder: 'Ej: Neumonía, VIH', isRequired: true },
      { label: 'Agente etiológico', fieldType: 'TEXT', placeholder: 'Ej: Streptococcus pneumoniae', isRequired: false },
      { label: 'Antibióticos indicados', fieldType: 'TEXT', placeholder: 'Ej: Amoxicilina, ceftriaxona', isRequired: false },
      { label: 'Duración del tratamiento', fieldType: 'TEXT', placeholder: 'Ej: 7 días', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Medicina Interna',
    specialty: 'MEDICINA_INTERNA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Fiebre, dolor abdominal', isRequired: true },
      { label: 'Signos vitales', fieldType: 'TEXT', placeholder: 'Ej: TA, FC, FR, Temp', isRequired: false },
      { label: 'Diagnóstico principal', fieldType: 'TEXT', placeholder: 'Ej: Diabetes, hipertensión', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Nefrología',
    specialty: 'NEFROLOGIA',
    fields: [
      { label: 'Diagnóstico renal', fieldType: 'TEXT', placeholder: 'Ej: Insuficiencia renal crónica', isRequired: true },
      { label: 'Creatinina', fieldType: 'NUMBER', placeholder: 'mg/dL', isRequired: true },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Diálisis', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Neumología',
    specialty: 'NEUMOLOGIA',
    fields: [
      { label: 'Diagnóstico respiratorio', fieldType: 'TEXT', placeholder: 'Ej: Asma, EPOC', isRequired: true },
      { label: 'Espirometría', fieldType: 'TEXT', placeholder: 'Resultado de espirometría', isRequired: false },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Oxigenoterapia', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Neurología',
    specialty: 'NEUROLOGIA',
    fields: [
      { label: 'Motivo neurológico', fieldType: 'TEXT', placeholder: 'Ej: Cefalea, convulsiones', isRequired: true },
      { label: 'Exploración neurológica', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Estudios realizados', fieldType: 'TEXT', placeholder: 'Ej: TAC, RMN', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXT', placeholder: 'Ej: Migraña, epilepsia', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
    ]
  },
  {
    name: 'Odontología',
    specialty: 'ODONTOLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Dolor dental, limpieza', isRequired: true },
      { label: 'Diente afectado', fieldType: 'TEXT', placeholder: 'Ej: Molar superior derecho', isRequired: false },
      { label: 'Antecedentes dentales', fieldType: 'TEXTAREA', placeholder: 'Ej: Extracciones, tratamientos', isRequired: false },
      { label: 'Examen bucal', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Tratamiento realizado', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
    ]
  },
  {
    name: 'Oftalmología',
    specialty: 'OFTALMOLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Disminución de agudeza visual', isRequired: true },
      { label: 'Agudeza visual', fieldType: 'TEXT', placeholder: 'Ej: 20/20, 20/40', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXT', placeholder: 'Ej: Catarata, glaucoma', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Oncología',
    specialty: 'ONCOLOGIA',
    fields: [
      { label: 'Diagnóstico oncológico', fieldType: 'TEXT', placeholder: 'Ej: Carcinoma de mama', isRequired: true },
      { label: 'Estadio', fieldType: 'TEXT', placeholder: 'Ej: I, II, III, IV', isRequired: false },
      { label: 'Tratamiento actual', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Metástasis', fieldType: 'CHECKBOX', isRequired: false },
      { label: 'Evolución clínica', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Ortopedia y Traumatología',
    specialty: 'ORTOPEDIA_TRAUMATOLOGIA',
    fields: [
      { label: 'Tipo de lesión', fieldType: 'SELECT', options: ['Fractura', 'Esguince', 'Luxación', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Localización', fieldType: 'TEXT', placeholder: 'Ej: Hombro, rodilla', isRequired: true },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Estudios realizados', fieldType: 'TEXT', placeholder: 'Ej: Radiografía, TAC', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Otorrinolaringología',
    specialty: 'OTORRINOLARINGOLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Dolor de oído, disfonía', isRequired: true },
      { label: 'Exploración ORL', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXT', placeholder: 'Ej: Otitis, sinusitis', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
  {
    name: 'Pediatría',
    specialty: 'PEDIATRIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Fiebre, tos', isRequired: true },
      { label: 'Peso', fieldType: 'NUMBER', placeholder: 'kg', isRequired: false },
      { label: 'Talla', fieldType: 'NUMBER', placeholder: 'cm', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXT', placeholder: 'Ej: Infección respiratoria', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
    ]
  },
  {
    name: 'Psicología',
    specialty: 'PSICOLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Ansiedad, depresión', isRequired: true },
      { label: 'Evaluación inicial', fieldType: 'TEXTAREA', placeholder: 'Describir evaluación', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXT', placeholder: 'Ej: Trastorno de ansiedad', isRequired: false },
      { label: 'Terapia recomendada', fieldType: 'TEXT', placeholder: 'Ej: Cognitivo-conductual', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
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
    name: 'Radiología',
    specialty: 'RADIOLOGIA',
    fields: [
      { label: 'Tipo de estudio', fieldType: 'SELECT', options: ['Rayos X', 'Tomografía', 'Resonancia', 'Ultrasonido', 'Otro'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Área estudiada', fieldType: 'TEXT', placeholder: 'Ej: Tórax, abdomen, cráneo', isRequired: true },
      { label: 'Indicación clínica', fieldType: 'TEXTAREA', placeholder: 'Motivo del estudio', isRequired: false },
      { label: 'Hallazgos radiológicos', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Conclusión', fieldType: 'TEXTAREA', placeholder: 'Conclusión del estudio', isRequired: false },
    ]
  },
  {
    name: 'Traumatología',
    specialty: 'TRAUMATOLOGIA',
    fields: [
      { label: 'Mecanismo de lesión', fieldType: 'TEXT', placeholder: 'Ej: Caída, accidente, deporte', isRequired: true },
      { label: 'Área afectada', fieldType: 'TEXT', placeholder: 'Ej: Brazo derecho, rodilla', isRequired: true },
      { label: 'Síntomas', fieldType: 'TEXTAREA', placeholder: 'Ej: Dolor, inflamación, limitación', isRequired: false },
      { label: 'Examen físico', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Tratamiento', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
    ]
  },
  {
    name: 'Urología',
    specialty: 'UROLOGIA',
    fields: [
      { label: 'Motivo de consulta', fieldType: 'TEXT', placeholder: 'Ej: Dolor al orinar, sangre en orina', isRequired: true },
      { label: 'Síntomas urinarios', fieldType: 'TEXTAREA', placeholder: 'Describir síntomas', isRequired: false },
      { label: 'Examen urológico', fieldType: 'TEXTAREA', placeholder: 'Describir hallazgos', isRequired: false },
      { label: 'Estudios realizados', fieldType: 'TEXT', placeholder: 'Ej: PSA, ecografía', isRequired: false },
      { label: 'Diagnóstico', fieldType: 'TEXTAREA', placeholder: 'Describir diagnóstico', isRequired: false },
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

// Datos de doctores de prueba
const doctores = [
  {
    email: 'dr.garcia@test.com',
    firstName: 'Carlos',
    lastName: 'García',
    phone: '5512345678',
    licenseNumber: 'MED001',
    specialization: 'Cardiología',
    officeAddress: 'Av. Insurgentes Sur 1234, CDMX',
    officePhone: '5512345678',
    professionalTitle: 'Cardiólogo',
    taxId: 'GARC800101ABC',
    taxName: 'Dr. Carlos García López',
    taxAddress: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX'
  },
  {
    email: 'dra.martinez@test.com',
    firstName: 'Ana',
    lastName: 'Martínez',
    phone: '5512345679',
    licenseNumber: 'MED002',
    specialization: 'Dermatología',
    officeAddress: 'Av. Reforma 567, CDMX',
    officePhone: '5512345679',
    professionalTitle: 'Dermatóloga',
    taxId: 'MART850215DEF',
    taxName: 'Dra. Ana Martínez Rodríguez',
    taxAddress: 'Av. Reforma 567, Col. Juárez, CDMX'
  },
  {
    email: 'dr.rodriguez@test.com',
    firstName: 'Miguel',
    lastName: 'Rodríguez',
    phone: '5512345680',
    licenseNumber: 'MED003',
    specialization: 'Gastroenterología',
    officeAddress: 'Av. Chapultepec 890, CDMX',
    officePhone: '5512345680',
    professionalTitle: 'Gastroenterólogo',
    taxId: 'RODR780330GHI',
    taxName: 'Dr. Miguel Rodríguez Pérez',
    taxAddress: 'Av. Chapultepec 890, Col. Condesa, CDMX'
  },
  {
    email: 'dra.lopez@test.com',
    firstName: 'Patricia',
    lastName: 'López',
    phone: '5512345681',
    licenseNumber: 'MED004',
    specialization: 'Ginecología y Obstetricia',
    officeAddress: 'Av. Universidad 234, CDMX',
    officePhone: '5512345681',
    professionalTitle: 'Ginecóloga',
    taxId: 'LOPE820425JKL',
    taxName: 'Dra. Patricia López González',
    taxAddress: 'Av. Universidad 234, Col. Coyoacán, CDMX'
  },
  {
    email: 'dr.hernandez@test.com',
    firstName: 'Roberto',
    lastName: 'Hernández',
    phone: '5512345682',
    licenseNumber: 'MED005',
    specialization: 'Neurología',
    officeAddress: 'Av. Tláhuac 456, CDMX',
    officePhone: '5512345682',
    professionalTitle: 'Neurólogo',
    taxId: 'HERN790512MNO',
    taxName: 'Dr. Roberto Hernández Silva',
    taxAddress: 'Av. Tláhuac 456, Col. Tláhuac, CDMX'
  }
];

// Datos de asistentes de prueba
const asistentes = [
  {
    email: 'asistente1@test.com',
    firstName: 'María',
    lastName: 'González',
    phone: '5512345683'
  },
  {
    email: 'asistente2@test.com',
    firstName: 'Juan',
    lastName: 'Pérez',
    phone: '5512345684'
  },
  {
    email: 'asistente3@test.com',
    firstName: 'Carmen',
    lastName: 'Sánchez',
    phone: '5512345685'
  },
  {
    email: 'asistente4@test.com',
    firstName: 'Luis',
    lastName: 'Fernández',
    phone: '5512345686'
  },
  {
    email: 'asistente5@test.com',
    firstName: 'Isabel',
    lastName: 'Ramírez',
    phone: '5512345687'
  }
];

// Datos de pacientes de prueba
const pacientes = [
  {
    email: 'paciente1@test.com',
    firstName: 'Roberto',
    lastName: 'Gutiérrez',
    phone: '5512345688',
    gender: 'male',
    birthDate: '1985-03-15',
    bloodType: 'O+',
    allergies: 'Penicilina',
    chronicDiseases: 'Hipertensión arterial'
  },
  {
    email: 'paciente2@test.com',
    firstName: 'Laura',
    lastName: 'Morales',
    phone: '5512345689',
    gender: 'female',
    birthDate: '1990-07-22',
    bloodType: 'A+',
    allergies: 'Ninguna',
    chronicDiseases: 'Diabetes tipo 2'
  },
  {
    email: 'paciente3@test.com',
    firstName: 'Fernando',
    lastName: 'Castro',
    phone: '5512345690',
    gender: 'male',
    birthDate: '1978-11-08',
    bloodType: 'B+',
    allergies: 'Sulfas',
    chronicDiseases: 'Artritis reumatoide'
  },
  {
    email: 'paciente4@test.com',
    firstName: 'Sofía',
    lastName: 'Vargas',
    phone: '5512345691',
    gender: 'female',
    birthDate: '1995-04-30',
    bloodType: 'AB+',
    allergies: 'Ninguna',
    chronicDiseases: 'Ninguna'
  },
  {
    email: 'paciente5@test.com',
    firstName: 'Diego',
    lastName: 'Reyes',
    phone: '5512345692',
    gender: 'male',
    birthDate: '1982-09-12',
    bloodType: 'O-',
    allergies: 'Ibuprofeno',
    chronicDiseases: 'Asma'
  }
];

async function main() {
  console.log('🚀 Iniciando migración de usuarios de prueba...');
  
  try {
    // 1. Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    
    // Eliminar en orden de dependencias (hijos primero, padres después)
    await prisma.patientInsurance.deleteMany();
    await prisma.emergencyContact.deleteMany();
    await prisma.doctorPatient.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.doctor.deleteMany();
    await prisma.templateField.deleteMany();
    await prisma.formTemplate.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('✅ Datos limpiados exitosamente');

    // 2. Crear plantillas de especialidad
    console.log('📋 Creando plantillas de especialidad...');
    for (const especialidad of especialidades) {
      const template = await prisma.formTemplate.create({
        data: {
          name: especialidad.name,
          specialty: especialidad.specialty,
          description: `Formulario de consulta para ${especialidad.name}`
        }
      });

      for (let i = 0; i < especialidad.fields.length; i++) {
        const field = especialidad.fields[i];
        await prisma.templateField.create({
          data: {
            templateId: template.id,
            label: field.label,
            fieldType: field.fieldType,
            placeholder: field.placeholder,
            isRequired: field.isRequired,
            order: i + 1,
            options: field.options || []
          }
        });
      }
    }
    console.log(`✅ ${especialidades.length} plantillas de especialidad creadas`);

    // 3. Crear doctores
    console.log('👨‍⚕️ Creando doctores...');
    const doctoresCreados = [];
    for (const doctorData of doctores) {
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      
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
          taxCertificateUrl: 'https://example.com/certificate.pdf', // URL temporal para pruebas
          dataConsent: true,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          accessType: 'SUBSCRIPTION'
        }
      });

      // Crear suscripción activa
      await prisma.subscription.create({
        data: {
          doctorId: doctor.id,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
          paypalSubscriptionId: `test_sub_${doctor.id}`, // ID temporal para pruebas
          paypalPlanId: 'test_plan_monthly' // ID temporal para pruebas
        }
      });

      doctoresCreados.push(doctor);
      console.log(`✅ Doctor creado: ${doctorData.email}`);
    }

    // 4. Crear asistentes
    console.log('👩‍💼 Creando asistentes...');
    for (const asistenteData of asistentes) {
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      
      await prisma.user.create({
        data: {
          email: asistenteData.email,
          password: hashedPassword,
          firstName: asistenteData.firstName,
          lastName: asistenteData.lastName,
          phone: asistenteData.phone,
          role: 'ASISTENTE'
        }
      });

      console.log(`✅ Asistente creado: ${asistenteData.email}`);
    }

    // 5. Crear pacientes
    console.log('👥 Creando pacientes...');
    for (const pacienteData of pacientes) {
      const hashedPassword = await bcrypt.hash('Test123!', 10);
      
      const user = await prisma.user.create({
        data: {
          email: pacienteData.email,
          password: hashedPassword,
          firstName: pacienteData.firstName,
          lastName: pacienteData.lastName,
          phone: pacienteData.phone,
          role: 'PATIENT'
        }
      });

      await prisma.patient.create({
        data: {
          userId: user.id,
          gender: pacienteData.gender,
          dateOfBirth: new Date(pacienteData.birthDate),
          bloodType: pacienteData.bloodType,
          allergies: pacienteData.allergies,
          chronicDiseases: pacienteData.chronicDiseases,
          dataConsent: true,
          firstName: pacienteData.firstName,
          lastName: pacienteData.lastName
        }
      });

      console.log(`✅ Paciente creado: ${pacienteData.email}`);
    }

    // 6. Vincular pacientes con doctores
    console.log('🔗 Vinculando pacientes con doctores...');
    for (let i = 0; i < pacientes.length; i++) {
      const doctorIndex = i % doctoresCreados.length;
      const doctor = doctoresCreados[doctorIndex];
      
      // Obtener el paciente
      const patient = await prisma.patient.findFirst({
        where: { 
          user: { 
            email: pacientes[i].email 
          } 
        }
      });

      if (patient) {
        await prisma.doctorPatient.create({
          data: {
            doctorId: doctor.id,
            patientId: patient.id,
            status: 'ACTIVE',
            context: 'Consulta general',
            specialization: doctor.specialization,
            startDate: new Date()
          }
        });
        console.log(`✅ Paciente ${pacientes[i].email} vinculado con doctor ${doctores[doctorIndex].email}`);
      }
    }

    console.log('\n🎉 ¡Migración completada exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   • ${doctores.length} doctores creados con suscripciones activas`);
    console.log(`   • ${asistentes.length} asistentes creados`);
    console.log(`   • ${pacientes.length} pacientes creados`);
    console.log(`   • ${especialidades.length} plantillas de especialidad creadas`);
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Contraseña para todos los usuarios: Test123!');
    console.log('\n👨‍⚕️ Doctores:');
    doctores.forEach(d => console.log(`   • ${d.email}`));
    console.log('\n👩‍💼 Asistentes:');
    asistentes.forEach(a => console.log(`   • ${a.email}`));
    console.log('\n👥 Pacientes:');
    pacientes.forEach(p => console.log(`   • ${p.email}`));

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('\n✅ Script ejecutado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error ejecutando el script:', error);
    process.exit(1);
  });
