const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTables() {
  try {
    console.log('Verificando tablas existentes...');
    
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    console.log('Tablas encontradas:', tables);
    
    // Buscar tablas relacionadas con doctor
    const doctorTables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%doctor%';
    `;
    
    console.log('Tablas relacionadas con doctor:', doctorTables);
    
  } catch (error) {
    console.error('❌ Error verificando tablas:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables(); 