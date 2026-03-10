const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRecipeSystem() {
  console.log('🧪 Iniciando pruebas del sistema de recetas...\n');

  try {
    // 1. Obtener un doctor de prueba
    const doctor = await prisma.doctor.findFirst({
      include: { user: true }
    });

    if (!doctor) {
      console.log('❌ No se encontró ningún doctor para las pruebas');
      return;
    }

    console.log(`✅ Doctor encontrado: ${doctor.user.firstName} ${doctor.user.lastName}`);

    // 2. Obtener un paciente de prueba
    const patient = await prisma.patient.findFirst({
      include: { user: true }
    });

    if (!patient) {
      console.log('❌ No se encontró ningún paciente para las pruebas');
      return;
    }

    console.log(`✅ Paciente encontrado: ${patient.user.firstName} ${patient.user.lastName}`);

    // 3. Crear un template de receta de prueba
    console.log('\n📝 Creando template de receta...');
    const template = await prisma.doctorRecipeTemplate.create({
      data: {
        doctorId: doctor.id,
        pdfUrl: 'https://example.com/template-test.pdf',
        camposEditables: {
          nombrePaciente: { x: 100, y: 150, width: 200, height: 30 },
          fechaEmision: { x: 100, y: 200, width: 150, height: 30 },
          medicamentos: { x: 100, y: 250, width: 400, height: 200 },
          observaciones: { x: 100, y: 500, width: 400, height: 100 },
          firmaMedico: { x: 100, y: 650, width: 200, height: 50 }
        }
      }
    });

    console.log(`✅ Template creado con ID: ${template.id}`);

    // 4. Crear una receta de medicamentos de prueba
    console.log('\n💊 Creando receta de medicamentos...');
    const recetaMedicamentos = await prisma.recetaMedica.create({
      data: {
        doctorId: doctor.id,
        pacienteId: patient.id,
        archivoPdf: 'receta_medicamentos_test.pdf',
        observaciones: 'Paciente debe tomar medicamento con las comidas',
        esRecetaMedicamento: true,
        esSolicitudEstudios: false,
        realizadoPor: doctor.userId,
        vinculadoADoctor: doctor.id,
        detalleMedicamentos: {
          create: [
            {
              medicamento: 'Paracetamol 500mg',
              dosis: '1 tableta',
              frecuencia: 'Cada 8 horas',
              duracion: '5 días'
            },
            {
              medicamento: 'Ibuprofeno 400mg',
              dosis: '1 tableta',
              frecuencia: 'Cada 12 horas',
              duracion: '3 días'
            }
          ]
        }
      },
      include: {
        detalleMedicamentos: true,
        paciente: { include: { user: true } },
        doctor: { include: { user: true } }
      }
    });

    console.log(`✅ Receta de medicamentos creada con ID: ${recetaMedicamentos.id}`);
    console.log(`   - Medicamentos: ${recetaMedicamentos.detalleMedicamentos.length}`);

    // 5. Crear una receta de estudios de prueba
    console.log('\n🔬 Creando receta de estudios...');
    const recetaEstudios = await prisma.recetaMedica.create({
      data: {
        doctorId: doctor.id,
        pacienteId: patient.id,
        archivoPdf: 'receta_estudios_test.pdf',
        observaciones: 'Estudios para diagnóstico completo',
        esRecetaMedicamento: false,
        esSolicitudEstudios: true,
        realizadoPor: doctor.userId,
        vinculadoADoctor: doctor.id,
        estudiosSolicitados: {
          create: [
            {
              nombreEstudio: 'Hemograma completo',
              indicaciones: 'Ayuno de 8 horas'
            },
            {
              nombreEstudio: 'Química sanguínea',
              indicaciones: 'Ayuno de 12 horas'
            },
            {
              nombreEstudio: 'Radiografía de tórax',
              indicaciones: 'Sin preparación especial'
            }
          ]
        }
      },
      include: {
        estudiosSolicitados: true,
        paciente: { include: { user: true } },
        doctor: { include: { user: true } }
      }
    });

    console.log(`✅ Receta de estudios creada con ID: ${recetaEstudios.id}`);
    console.log(`   - Estudios: ${recetaEstudios.estudiosSolicitados.length}`);

    // 6. Consultar recetas del paciente
    console.log('\n📋 Consultando recetas del paciente...');
    const recetasPaciente = await prisma.recetaMedica.findMany({
      where: { pacienteId: patient.id },
      include: {
        detalleMedicamentos: true,
        estudiosSolicitados: true,
        doctor: { include: { user: true } }
      },
      orderBy: { fechaEmision: 'desc' }
    });

    console.log(`✅ Recetas del paciente: ${recetasPaciente.length}`);
    recetasPaciente.forEach((receta, index) => {
      console.log(`   ${index + 1}. ${receta.esRecetaMedicamento ? 'Medicamentos' : 'Estudios'} - ${new Date(receta.fechaEmision).toLocaleDateString()}`);
    });

    // 7. Consultar recetas del doctor
    console.log('\n👨‍⚕️ Consultando recetas del doctor...');
    const recetasDoctor = await prisma.recetaMedica.findMany({
      where: { doctorId: doctor.id },
      include: {
        detalleMedicamentos: true,
        estudiosSolicitados: true,
        paciente: { include: { user: true } }
      },
      orderBy: { fechaEmision: 'desc' }
    });

    console.log(`✅ Recetas del doctor: ${recetasDoctor.length}`);

    // 8. Obtener estadísticas
    console.log('\n📊 Generando estadísticas...');
    
    const totalRecetas = await prisma.recetaMedica.count({
      where: { doctorId: doctor.id }
    });

    const recetasMedicamentos = await prisma.recetaMedica.count({
      where: { 
        doctorId: doctor.id,
        esRecetaMedicamento: true 
      }
    });

    const solicitudesEstudios = await prisma.recetaMedica.count({
      where: { 
        doctorId: doctor.id,
        esSolicitudEstudios: true 
      }
    });

    const medicamentosMasUsados = await prisma.recetaDetalleMedicamento.groupBy({
      by: ['medicamento'],
      where: {
        receta: {
          doctorId: doctor.id
        }
      },
      _count: {
        medicamento: true
      },
      orderBy: {
        _count: {
          medicamento: 'desc'
        }
      },
      take: 5
    });

    const estudiosMasSolicitados = await prisma.recetaEstudioSolicitado.groupBy({
      by: ['nombreEstudio'],
      where: {
        receta: {
          doctorId: doctor.id
        }
      },
      _count: {
        nombreEstudio: true
      },
      orderBy: {
        _count: {
          nombreEstudio: 'desc'
        }
      },
      take: 5
    });

    console.log('📈 Estadísticas generadas:');
    console.log(`   - Total recetas: ${totalRecetas}`);
    console.log(`   - Recetas medicamentos: ${recetasMedicamentos}`);
    console.log(`   - Solicitudes estudios: ${solicitudesEstudios}`);
    console.log(`   - Medicamentos más usados: ${medicamentosMasUsados.length}`);
    console.log(`   - Estudios más solicitados: ${estudiosMasSolicitados.length}`);

    // 9. Limpiar datos de prueba
    console.log('\n🧹 Limpiando datos de prueba...');
    
    await prisma.recetaDetalleMedicamento.deleteMany({
      where: {
        recetaId: { in: [recetaMedicamentos.id, recetaEstudios.id] }
      }
    });

    await prisma.recetaEstudioSolicitado.deleteMany({
      where: {
        recetaId: { in: [recetaMedicamentos.id, recetaEstudios.id] }
      }
    });

    await prisma.recetaMedica.deleteMany({
      where: {
        id: { in: [recetaMedicamentos.id, recetaEstudios.id] }
      }
    });

    await prisma.doctorRecipeTemplate.delete({
      where: { id: template.id }
    });

    console.log('✅ Datos de prueba eliminados');

    console.log('\n🎉 ¡Todas las pruebas del sistema de recetas fueron exitosas!');
    console.log('\n✅ Funcionalidades verificadas:');
    console.log('   - Creación de templates personalizados');
    console.log('   - Creación de recetas de medicamentos');
    console.log('   - Creación de recetas de estudios');
    console.log('   - Consulta de recetas por paciente');
    console.log('   - Consulta de recetas por doctor');
    console.log('   - Generación de estadísticas');
    console.log('   - Relaciones entre tablas');

  } catch (error) {
    console.error('❌ Error durante las pruebas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar las pruebas
testRecipeSystem(); 