const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createTestTemplates() {
  try {
    // Buscar el primer doctor disponible
    const doctor = await prisma.doctor.findFirst();
    
    if (!doctor) {
      console.log('No se encontró ningún doctor en la base de datos');
      return;
    }

    console.log(`Creando templates para el doctor: ${doctor.name} ${doctor.lastName}`);

    // Crear templates de prueba
    const templates = [
      {
        name: 'Receta Antibiótico',
        content: `Medicamento: {{medicamento}}
Dosis: {{dosis}}
Frecuencia: {{frecuencia}}
Duración: {{duracion}}
Instrucciones: {{instrucciones}}

Observaciones: {{observaciones}}`
      },
      {
        name: 'Receta Analgésico',
        content: `Medicamento: {{medicamento}}
Dosis: {{dosis}}
Frecuencia: {{frecuencia}}
Duración: {{duracion}}
Instrucciones: {{instrucciones}}

Observaciones: {{observaciones}}`
      },
      {
        name: 'Receta Antiinflamatorio',
        content: `Medicamento: {{medicamento}}
Dosis: {{dosis}}
Frecuencia: {{frecuencia}}
Duración: {{duracion}}
Instrucciones: {{instrucciones}}

Observaciones: {{observaciones}}`
      }
    ];

    for (const template of templates) {
      const created = await prisma.prescriptionTemplate.create({
        data: {
          doctorId: doctor.id,
          name: template.name,
          content: template.content
        }
      });
      console.log(`Template creado: ${created.name} (ID: ${created.id})`);
    }

    console.log('Templates de prueba creados exitosamente');
  } catch (error) {
    console.error('Error al crear templates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestTemplates(); 