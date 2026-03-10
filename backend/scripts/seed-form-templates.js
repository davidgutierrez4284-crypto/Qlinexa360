const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedFormTemplates() {
  try {
    console.log('🌱 Creando plantillas de formulario de ejemplo...');

    // Plantilla 1: Evaluación Ortopédica
    const ortopediaTemplate = await prisma.formTemplate.create({
      data: {
        name: 'Evaluación Ortopédica',
        description: 'Formulario para evaluación de lesiones ortopédicas',
        specialty: 'ORTHOPEDICS',
        fields: {
          create: [
            {
              label: 'Tipo de Lesión',
              fieldType: 'SELECT',
              placeholder: 'Seleccionar tipo de lesión',
              options: ['Fractura', 'Esguince', 'Luxación', 'Tendinitis', 'Artritis', 'Otro'],
              isRequired: true,
              order: 1
            },
            {
              label: 'Localización',
              fieldType: 'TEXT',
              placeholder: 'Ej: Brazo derecho, rodilla izquierda',
              isRequired: true,
              order: 2
            },
            {
              label: 'Mecanismo de Lesión',
              fieldType: 'TEXTAREA',
              placeholder: 'Describir cómo ocurrió la lesión',
              isRequired: false,
              order: 3
            },
            {
              label: 'Dolor (Escala 1-10)',
              fieldType: 'NUMBER',
              placeholder: '1-10',
              isRequired: true,
              order: 4
            },
            {
              label: 'Rango de Movimiento',
              fieldType: 'TEXT',
              placeholder: 'Ej: Flexión 90°, Extensión completa',
              isRequired: false,
              order: 5
            },
            {
              label: 'Radiografías Realizadas',
              fieldType: 'CHECKBOX',
              isRequired: false,
              order: 6
            }
          ]
        }
      }
    });

    // Plantilla 2: Evaluación Cardiológica
    const cardiologiaTemplate = await prisma.formTemplate.create({
      data: {
        name: 'Evaluación Cardiológica',
        description: 'Formulario para evaluación cardiovascular',
        specialty: 'CARDIOLOGY',
        fields: {
          create: [
            {
              label: 'Presión Arterial',
              fieldType: 'TEXT',
              placeholder: 'Ej: 120/80 mmHg',
              isRequired: true,
              order: 1
            },
            {
              label: 'Frecuencia Cardíaca',
              fieldType: 'NUMBER',
              placeholder: 'Latidos por minuto',
              isRequired: true,
              order: 2
            },
            {
              label: 'Síntomas Principales',
              fieldType: 'SELECT',
              placeholder: 'Seleccionar síntomas',
              options: ['Dolor de pecho', 'Falta de aire', 'Palpitaciones', 'Fatiga', 'Mareos', 'Otro'],
              isRequired: true,
              order: 3
            },
            {
              label: 'Historial Familiar',
              fieldType: 'TEXTAREA',
              placeholder: 'Antecedentes familiares de problemas cardíacos',
              isRequired: false,
              order: 4
            },
            {
              label: 'Electrocardiograma',
              fieldType: 'CHECKBOX',
              isRequired: false,
              order: 5
            }
          ]
        }
      }
    });

    // Plantilla 3: Evaluación Dermatológica
    const dermatologiaTemplate = await prisma.formTemplate.create({
      data: {
        name: 'Evaluación Dermatológica',
        description: 'Formulario para evaluación de problemas de piel',
        specialty: 'DERMATOLOGY',
        fields: {
          create: [
            {
              label: 'Tipo de Lesión',
              fieldType: 'SELECT',
              placeholder: 'Seleccionar tipo de lesión',
              options: ['Erupción', 'Verruga', 'Lunar', 'Acné', 'Eczema', 'Psoriasis', 'Otro'],
              isRequired: true,
              order: 1
            },
            {
              label: 'Localización',
              fieldType: 'TEXT',
              placeholder: 'Ej: Brazo, cara, espalda',
              isRequired: true,
              order: 2
            },
            {
              label: 'Tiempo de Evolución',
              fieldType: 'TEXT',
              placeholder: 'Ej: 2 semanas, 1 mes',
              isRequired: false,
              order: 3
            },
            {
              label: 'Síntomas Asociados',
              fieldType: 'TEXTAREA',
              placeholder: 'Picazón, dolor, ardor, etc.',
              isRequired: false,
              order: 4
            },
            {
              label: 'Fotografía de la Lesión',
              fieldType: 'CHECKBOX',
              isRequired: false,
              order: 5
            }
          ]
        }
      }
    });

    console.log('✅ Plantillas creadas exitosamente:');
    console.log(`- ${ortopediaTemplate.name} (ID: ${ortopediaTemplate.id})`);
    console.log(`- ${cardiologiaTemplate.name} (ID: ${cardiologiaTemplate.id})`);
    console.log(`- ${dermatologiaTemplate.name} (ID: ${dermatologiaTemplate.id})`);

    console.log('\n🎉 ¡Plantillas de formulario creadas!');
    console.log('📋 Ahora puedes probar la funcionalidad de formularios por especialidad.');

  } catch (error) {
    console.error('❌ Error al crear plantillas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
seedFormTemplates(); 