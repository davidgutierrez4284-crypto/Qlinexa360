const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDividedConsultations() {
  try {
    console.log('🧪 Iniciando pruebas del sistema de consultas divididas...\n');

    // 0. Verificar datos existentes en la base de datos
    console.log('0. Verificando datos existentes en la base de datos...');
    
    const existingUsers = await prisma.user.findMany({
      take: 1,
      select: { id: true, firstName: true, lastName: true, role: true }
    });

    const existingPatients = await prisma.patient.findMany({
      take: 1,
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    const existingDoctors = await prisma.doctor.findMany({
      take: 1,
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    const existingClinicalCases = await prisma.clinicalCase.findMany({
      take: 1,
      select: { id: true, padecimiento: true }
    });

    console.log('📋 Datos encontrados:');
    console.log(`   - Usuarios: ${existingUsers.length}`);
    console.log(`   - Pacientes: ${existingPatients.length}`);
    console.log(`   - Doctores: ${existingDoctors.length}`);
    console.log(`   - Casos clínicos: ${existingClinicalCases.length}`);

    if (existingUsers.length === 0 || existingPatients.length === 0 || existingDoctors.length === 0 || existingClinicalCases.length === 0) {
      console.log('❌ No hay suficientes datos en la base de datos para realizar las pruebas.');
      console.log('   Por favor, asegúrate de tener al menos:');
      console.log('   - 1 usuario');
      console.log('   - 1 paciente');
      console.log('   - 1 doctor');
      console.log('   - 1 caso clínico');
      return;
    }

    // Usar los primeros registros encontrados
    const testUser = existingUsers[0];
    const testPatient = existingPatients[0];
    const testDoctor = existingDoctors[0];
    const testClinicalCase = existingClinicalCases[0];

    console.log('✅ Usando datos reales:');
    console.log(`   - Usuario: ${testUser.firstName} ${testUser.lastName} (${testUser.role})`);
    console.log(`   - Paciente: ${testPatient.user.firstName} ${testPatient.user.lastName}`);
    console.log(`   - Doctor: ${testDoctor.user.firstName} ${testDoctor.user.lastName}`);
    console.log(`   - Caso clínico: ${testClinicalCase.padecimiento}`);

    // Verificar si existe la relación doctor-paciente
    const doctorPatientLink = await prisma.doctorPatient.findFirst({
      where: {
        doctorId: testDoctor.id,
        patientId: testPatient.id
      }
    });

    if (!doctorPatientLink) {
      console.log('❌ No existe relación doctor-paciente. Creando...');
      const newDoctorPatientLink = await prisma.doctorPatient.create({
        data: {
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          status: 'ACTIVE',
          context: 'CONSULTATION',
          specialization: 'GENERAL',
          startDate: new Date()
        }
      });
      console.log('✅ Relación doctor-paciente creada:', newDoctorPatientLink.id);
    } else {
      console.log('✅ Relación doctor-paciente encontrada:', doctorPatientLink.id);
    }

    // 1. Crear una consulta básica (Parte 1)
    console.log('\n1. Creando consulta básica...');
    const basicConsultation = await prisma.medicalRecord.create({
      data: {
        clinicalCaseId: testClinicalCase.id,
        doctorPatientId: doctorPatientLink ? doctorPatientLink.id : (await prisma.doctorPatient.findFirst({
          where: { doctorId: testDoctor.id, patientId: testPatient.id }
        })).id,
        patientId: testPatient.id,
        diagnosis: 'Fractura de pierna derecha',
        treatment: 'Inmovilización con yeso por 6 semanas',
        notes: 'Paciente presenta dolor intenso en la pierna derecha',
        reason: 'Revisión de resultados',
        tags: ['fractura', 'trauma', 'inmovilización'],
        clinicalEvolution: 'FOLLOW_UP',
        formData: {
          fecha: '2025-07-27',
          motivoConsulta: 'Revisión de resultados',
          evolucionClinica: 'FOLLOW_UP',
          etiquetas: ['fractura', 'trauma', 'inmovilización'],
          notas: 'Paciente presenta dolor intenso en la pierna derecha',
          notaPublica: true
        },
        userId: testUser.id,
        autorConsultaId: testUser.id,
        realizadoPor: testUser.id,
        vinculadoADoctor: testUser.id,
        isPublic: true,
        date: new Date(),
        isComplete: false, // La consulta no está completa
        hasAttachments: false // No tiene archivos adjuntos
      }
    });
    console.log('✅ Consulta básica creada:', basicConsultation.id);

    // 2. Verificar el estado de la consulta
    console.log('\n2. Verificando estado de la consulta...');
    const consultation = await prisma.medicalRecord.findUnique({
      where: { id: basicConsultation.id },
      select: {
        id: true,
        diagnosis: true,
        isComplete: true,
        hasAttachments: true,
        createdAt: true,
        files: {
          select: {
            id: true,
            fileName: true
          }
        },
        links: {
          select: {
            id: true,
            url: true
          }
        }
      }
    });

    console.log('📋 Estado de la consulta:');
    console.log(`   - ID: ${consultation.id}`);
    console.log(`   - Diagnóstico: ${consultation.diagnosis}`);
    console.log(`   - Está completa: ${consultation.isComplete}`);
    console.log(`   - Tiene archivos: ${consultation.hasAttachments}`);
    console.log(`   - Archivos adjuntos: ${consultation.files.length}`);
    console.log(`   - Links asociados: ${consultation.links.length}`);

    // 3. Simular agregar archivos a la consulta (Parte 2)
    console.log('\n3. Simulando agregar archivos a la consulta...');
    
    // Crear algunos archivos de prueba
    const testFiles = await prisma.file.createMany({
      data: [
        {
          fileName: 'receta_medicamentos.pdf',
          fileType: 'application/pdf',
          url: 'https://example.com/receta_medicamentos.pdf',
          size: 1024000,
          category: 'PRESCRIPTION_REQUEST',
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          uploadedById: testUser.id
        },
        {
          fileName: 'foto_lesion.jpg',
          fileType: 'image/jpeg',
          url: 'https://example.com/foto_lesion.jpg',
          size: 512000,
          category: 'DOCTOR_PHOTO',
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          uploadedById: testUser.id
        },
        {
          fileName: 'resultados_laboratorio.pdf',
          fileType: 'application/pdf',
          url: 'https://example.com/resultados_laboratorio.pdf',
          size: 2048000,
          category: 'STUDY_RESULT',
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          uploadedById: testUser.id
        }
      ]
    });

    console.log('✅ Archivos de prueba creados:', testFiles.count);

    // Obtener los IDs de los archivos creados
    const files = await prisma.file.findMany({
      where: {
        fileName: {
          in: ['receta_medicamentos.pdf', 'foto_lesion.jpg', 'resultados_laboratorio.pdf']
        }
      },
      select: { id: true, fileName: true, category: true }
    });

    console.log('📁 Archivos disponibles:');
    files.forEach(file => {
      console.log(`   - ${file.fileName} (${file.category}) - ID: ${file.id}`);
    });

    // 4. Agregar archivos a la consulta
    console.log('\n4. Agregando archivos a la consulta...');
    const updatedConsultation = await prisma.medicalRecord.update({
      where: { id: basicConsultation.id },
      data: {
        hasAttachments: true,
        files: {
          connect: files.map(file => ({ id: file.id }))
        },
        links: {
          create: [
            {
              url: 'https://ejemplo.com/guia_fracturas',
              description: 'Guía de tratamiento para fracturas'
            },
            {
              url: 'https://ejemplo.com/ejercicios_rehabilitacion',
              description: 'Ejercicios de rehabilitación post-fractura'
            }
          ]
        }
      },
      include: {
        files: {
          select: {
            id: true,
            fileName: true,
            category: true
          }
        },
        links: {
          select: {
            id: true,
            url: true,
            description: true
          }
        }
      }
    });

    console.log('✅ Archivos agregados a la consulta');
    console.log(`   - Archivos adjuntos: ${updatedConsultation.files.length}`);
    console.log(`   - Links asociados: ${updatedConsultation.links.length}`);

    // 5. Marcar consulta como completa
    console.log('\n5. Marcando consulta como completa...');
    const completeConsultation = await prisma.medicalRecord.update({
      where: { id: basicConsultation.id },
      data: {
        isComplete: true
      },
      select: {
        id: true,
        diagnosis: true,
        isComplete: true,
        hasAttachments: true,
        files: {
          select: {
            fileName: true,
            category: true
          }
        },
        links: {
          select: {
            url: true,
            description: true
          }
        }
      }
    });

    console.log('✅ Consulta marcada como completa');
    console.log(`   - Está completa: ${completeConsultation.isComplete}`);
    console.log(`   - Tiene archivos: ${completeConsultation.hasAttachments}`);

    // 6. Obtener estadísticas
    console.log('\n6. Obteniendo estadísticas...');
    const stats = await prisma.medicalRecord.groupBy({
      by: ['isComplete', 'hasAttachments'],
      _count: {
        id: true
      }
    });

    console.log('📊 Estadísticas de consultas:');
    stats.forEach(stat => {
      console.log(`   - Completas: ${stat.isComplete}, Con archivos: ${stat.hasAttachments} - Cantidad: ${stat._count.id}`);
    });

    // 7. Obtener consultas pendientes
    console.log('\n7. Consultas pendientes...');
    const pendingConsultations = await prisma.medicalRecord.findMany({
      where: {
        hasAttachments: false
      },
      select: {
        id: true,
        diagnosis: true,
        createdAt: true,
        isComplete: true,
        hasAttachments: true
      }
    });

    console.log(`📋 Consultas pendientes de completar: ${pendingConsultations.length}`);
    pendingConsultations.forEach(consultation => {
      console.log(`   - ${consultation.diagnosis} (${consultation.id}) - ${consultation.createdAt.toLocaleDateString()}`);
    });

    console.log('\n🎉 ¡Pruebas del sistema de consultas divididas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testDividedConsultations(); 