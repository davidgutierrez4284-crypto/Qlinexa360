const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTemplates() {
  try {
    const templates = await prisma.prescriptionTemplate.findMany();
    console.log('Templates encontrados:', templates.length);
    templates.forEach(t => {
      console.log('-', t.name, '(ID:', t.id, ')');
      console.log('  Contenido:', t.content.substring(0, 100) + '...');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTemplates(); 