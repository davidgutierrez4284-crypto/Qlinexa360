const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDoctorTable() {
  try {
    console.log('Verificando estructura de la tabla Doctor...');
    
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'Doctor'
      ORDER BY ordinal_position;
    `;
    
    console.log('Columnas de la tabla Doctor:', columns);
    
  } catch (error) {
    console.error('❌ Error verificando tabla Doctor:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDoctorTable(); 