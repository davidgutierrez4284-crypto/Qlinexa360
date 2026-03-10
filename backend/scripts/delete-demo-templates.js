const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const demoTemplates = [
  'Evaluación Ortopédica',
  'Evaluación Cardiológica',
  'Evaluación Dermatológica',
];

async function deleteDemoTemplates() {
  try {
    for (const name of demoTemplates) {
      const template = await prisma.formTemplate.findFirst({ where: { name } });
      if (!template) {
        console.log(`⏭️  No existe: ${name}`);
        continue;
      }
      // Cambia aquí el campo a templateId
      await prisma.templateField.deleteMany({ where: { templateId: template.id } });
      await prisma.formTemplate.delete({ where: { id: template.id } });
      console.log(`✅ Eliminada: ${name}`);
    }
    console.log('\n🎉 Plantillas de prueba eliminadas.');
  } catch (error) {
    console.error('❌ Error al eliminar plantillas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteDemoTemplates();