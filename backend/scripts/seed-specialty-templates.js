const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
    name: 'Enfermería (heridas, estomas y quemaduras)',
    specialty: 'ENFERMERIA',
    fields: [
      { label: 'Tipo de herida/estoma/quemadura', fieldType: 'SELECT', options: ['Herida', 'Estoma', 'Quemadura'], placeholder: 'Seleccionar tipo', isRequired: true },
      { label: 'Localización', fieldType: 'TEXT', placeholder: 'Ej: Abdomen, brazo', isRequired: true },
      { label: 'Tamaño', fieldType: 'TEXT', placeholder: 'Ej: 5x3 cm', isRequired: false },
      { label: 'Tratamiento realizado', fieldType: 'TEXTAREA', placeholder: 'Describir tratamiento', isRequired: false },
      { label: 'Evolución', fieldType: 'TEXTAREA', placeholder: 'Describir evolución', isRequired: false },
    ]
  },
];

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
  } finally {
    await prisma.$disconnect();
  }
}

seedSpecialtyTemplates(); 