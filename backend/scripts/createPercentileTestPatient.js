const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Script para crear un paciente de prueba con datos para verificar gráficas de percentiles OMS
 * 
 * Este script crea:
 * - Un paciente de 8 años (masculino)
 * - Un caso clínico
 * - Varias consultas con datos de peso, talla e IMC
 * 
 * Uso: node backend/scripts/createPercentileTestPatient.js [doctorEmail]
 */

async function createPercentileTestPatient(doctorEmail = null) {
  try {
    console.log('🚀 Iniciando creación de paciente de prueba para percentiles...\n');

    // 1. Obtener o buscar un doctor
    let doctor;
    if (doctorEmail) {
      const user = await prisma.user.findUnique({
        where: { email: doctorEmail },
        include: { doctorProfile: true }
      });
      if (!user || !user.doctorProfile) {
        throw new Error(`No se encontró un doctor con el email: ${doctorEmail}`);
      }
      doctor = user.doctorProfile;
    } else {
      // Buscar el primer doctor disponible
      doctor = await prisma.doctor.findFirst({
        include: { user: true }
      });
      if (!doctor) {
        throw new Error('No se encontró ningún doctor en la base de datos. Por favor, crea un doctor primero.');
      }
    }

    console.log(`✅ Doctor encontrado: ${doctor.user.firstName} ${doctor.user.lastName} (${doctor.user.email})`);

    // 2. Crear usuario para el paciente de prueba
    const testEmail = `test.percentiles.${Date.now()}@medilink360.test`;
    const testPassword = await bcrypt.hash('Test123456!', 10);

    const patientUser = await prisma.user.create({
      data: {
        email: testEmail,
        password: testPassword,
        firstName: 'Juan',
        lastName: 'Pérez Percentiles',
        role: 'PATIENT',
        phone: '5551234567'
      }
    });

    console.log(`✅ Usuario paciente creado: ${patientUser.email}`);

    // 3. Crear perfil de paciente (8 años, nacido en 2015)
    const birthDate = new Date('2015-05-15'); // 8 años de edad aproximadamente
    const patient = await prisma.patient.create({
      data: {
        userId: patientUser.id,
        firstName: 'Juan',
        lastName: 'Pérez Percentiles',
        gender: 'Masculino',
        dateOfBirth: birthDate,
        bloodType: 'O+',
        allergies: null,
        chronicDiseases: null,
        dataConsent: true
      }
    });

    console.log(`✅ Perfil de paciente creado: ${patient.id}`);
    console.log(`   Fecha de nacimiento: ${birthDate.toLocaleDateString('es-ES')} (${Math.floor((Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25))} años)`);

    // 4. Crear relación doctor-paciente
    const doctorPatient = await prisma.doctorPatient.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        status: 'activo',
        specialization: doctor.specialization || 'Medicina General',
        context: `Paciente de prueba para gráficas de percentiles OMS`
      }
    });

    console.log(`✅ Relación doctor-paciente creada: ${doctorPatient.id}`);

    // 5. Crear caso clínico
    const clinicalCase = await prisma.clinicalCase.create({
      data: {
        patientId: patient.id,
        padecimiento: 'Control de crecimiento y desarrollo',
        status: 'ACTIVO'
      }
    });

    console.log(`✅ Caso clínico creado: ${clinicalCase.id}`);

    // 6. Obtener los IDs de los campos de formulario (peso, talla, IMC, sexo biológico)
    // Necesitamos buscar en las plantillas de formulario para obtener los IDs reales
    const templates = await prisma.formTemplate.findMany({
      include: {
        fields: true
      }
    });

    // Buscar campos que contengan peso, talla, IMC, sexo biológico
    let pesoFieldId = null;
    let tallaFieldId = null;
    let imcFieldId = null;
    let sexoBiologicoFieldId = null;

    templates.forEach(template => {
      template.fields.forEach(field => {
        const labelLower = field.label.toLowerCase();
        if (!pesoFieldId && (labelLower.includes('peso') && !labelLower.includes('ideal'))) {
          pesoFieldId = field.id;
        }
        if (!tallaFieldId && (labelLower.includes('talla') || labelLower.includes('altura'))) {
          tallaFieldId = field.id;
        }
        if (!imcFieldId && (labelLower.includes('imc') || labelLower.includes('índice de masa corporal'))) {
          imcFieldId = field.id;
        }
        if (!sexoBiologicoFieldId && (labelLower.includes('sexo') && (labelLower.includes('biológico') || labelLower.includes('biologico')))) {
          sexoBiologicoFieldId = field.id;
        }
      });
    });

    console.log('\n📋 Campos encontrados:');
    console.log(`   Peso: ${pesoFieldId || 'NO ENCONTRADO'}`);
    console.log(`   Talla: ${tallaFieldId || 'NO ENCONTRADO'}`);
    console.log(`   IMC: ${imcFieldId || 'NO ENCONTRADO'}`);
    console.log(`   Sexo biológico: ${sexoBiologicoFieldId || 'NO ENCONTRADO'}\n`);

    // Si no se encuentran los campos, usar IDs genéricos (el frontend los mapeará)
    if (!pesoFieldId) pesoFieldId = 'peso-field-id';
    if (!tallaFieldId) tallaFieldId = 'talla-field-id';
    if (!imcFieldId) imcFieldId = 'imc-field-id';
    if (!sexoBiologicoFieldId) sexoBiologicoFieldId = 'sexo-biologico-field-id';

    // 7. Crear consultas con datos de peso y talla
    // Consulta 1: hace 6 meses
    const consulta1Date = new Date();
    consulta1Date.setMonth(consulta1Date.getMonth() - 6);
    
    const formData1 = {};
    if (pesoFieldId) formData1[pesoFieldId] = '25'; // 25 kg
    if (tallaFieldId) formData1[tallaFieldId] = '125'; // 125 cm
    if (sexoBiologicoFieldId) formData1[sexoBiologicoFieldId] = 'Masculino';
    if (imcFieldId) formData1[imcFieldId] = '16.0'; // IMC aproximado

    const consulta1 = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        clinicalCaseId: clinicalCase.id,
        doctorPatientId: doctorPatient.id,
        diagnosis: 'Control de crecimiento - Primer registro',
        treatment: 'Seguimiento de crecimiento según percentiles OMS',
        notes: 'Paciente en percentil 50 para peso y talla según edad',
        clinicalEvolution: 'INITIAL_EVALUATION',
        formData: formData1,
        userId: doctor.user.id,
        autorConsultaId: doctor.user.id,
        date: consulta1Date,
        createdAt: consulta1Date
      }
    });

    console.log(`✅ Consulta 1 creada (${consulta1Date.toLocaleDateString('es-ES')}):`);
    console.log(`   Peso: 25 kg, Talla: 125 cm, IMC: 16.0`);

    // Consulta 2: hace 3 meses
    const consulta2Date = new Date();
    consulta2Date.setMonth(consulta2Date.getMonth() - 3);
    
    const formData2 = {};
    if (pesoFieldId) formData2[pesoFieldId] = '26.5'; // 26.5 kg
    if (tallaFieldId) formData2[tallaFieldId] = '127'; // 127 cm
    if (sexoBiologicoFieldId) formData2[sexoBiologicoFieldId] = 'Masculino';
    if (imcFieldId) formData2[imcFieldId] = '16.4'; // IMC aproximado

    const consulta2 = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        clinicalCaseId: clinicalCase.id,
        doctorPatientId: doctorPatient.id,
        diagnosis: 'Control de crecimiento - Seguimiento',
        treatment: 'Seguimiento de crecimiento según percentiles OMS',
        notes: 'Crecimiento adecuado. Paciente mantiene percentil 50-75',
        clinicalEvolution: 'FOLLOW_UP',
        formData: formData2,
        userId: doctor.user.id,
        autorConsultaId: doctor.user.id,
        date: consulta2Date,
        createdAt: consulta2Date
      }
    });

    console.log(`✅ Consulta 2 creada (${consulta2Date.toLocaleDateString('es-ES')}):`);
    console.log(`   Peso: 26.5 kg, Talla: 127 cm, IMC: 16.4`);

    // Consulta 3: hoy
    const consulta3Date = new Date();
    
    const formData3 = {};
    if (pesoFieldId) formData3[pesoFieldId] = '28'; // 28 kg
    if (tallaFieldId) formData3[tallaFieldId] = '129'; // 129 cm
    if (sexoBiologicoFieldId) formData3[sexoBiologicoFieldId] = 'Masculino';
    if (imcFieldId) formData3[imcFieldId] = '16.8'; // IMC aproximado

    const consulta3 = await prisma.medicalRecord.create({
      data: {
        patientId: patient.id,
        clinicalCaseId: clinicalCase.id,
        doctorPatientId: doctorPatient.id,
        diagnosis: 'Control de crecimiento - Control actual',
        treatment: 'Seguimiento de crecimiento según percentiles OMS',
        notes: 'Crecimiento continuo adecuado. Valores dentro de percentiles normales.',
        clinicalEvolution: 'FOLLOW_UP',
        formData: formData3,
        userId: doctor.user.id,
        autorConsultaId: doctor.user.id,
        date: consulta3Date,
        createdAt: consulta3Date
      }
    });

    console.log(`✅ Consulta 3 creada (${consulta3Date.toLocaleDateString('es-ES')}):`);
    console.log(`   Peso: 28 kg, Talla: 129 cm, IMC: 16.8`);

    console.log('\n✅ Paciente de prueba creado exitosamente!');
    console.log('\n📊 Resumen:');
    console.log(`   Email del paciente: ${testEmail}`);
    console.log(`   Contraseña: Test123456!`);
    console.log(`   Paciente ID: ${patient.id}`);
    console.log(`   Caso clínico ID: ${clinicalCase.id}`);
    console.log(`   Doctor: ${doctor.user.firstName} ${doctor.user.lastName}`);
    console.log('\n💡 Para probar los percentiles:');
    console.log('   1. Ve al Dashboard');
    console.log('   2. Selecciona este paciente desde el dropdown');
    console.log('   3. Selecciona "Peso", "Talla" o "IMC" en el selector de parámetros');
    console.log('   4. Deberías ver las curvas de percentiles OMS (P3, P10, P25, P50, P75, P90, P97)');

  } catch (error) {
    console.error('❌ Error al crear paciente de prueba:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
const doctorEmail = process.argv[2] || null;
createPercentileTestPatient(doctorEmail)
  .then(() => {
    console.log('\n✅ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error en el script:', error);
    process.exit(1);
  });

