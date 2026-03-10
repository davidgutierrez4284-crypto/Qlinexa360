const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAgendaTable() {
  try {
    console.log('Creando tabla agenda_pacientes_links...');
    
    // Crear la tabla manualmente
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS agenda_pacientes_links (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        doctor_id TEXT NOT NULL,
        link TEXT UNIQUE NOT NULL,
        esta_activo BOOLEAN DEFAULT false,
        mensaje_custom TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_doctor FOREIGN KEY (doctor_id) REFERENCES "Doctor"(id) ON DELETE CASCADE
      );
    `;

    // Crear índice
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_agenda_pacientes_links_doctor_id ON agenda_pacientes_links(doctor_id);
    `;

    console.log('✅ Tabla agenda_pacientes_links creada exitosamente');
    
    // Verificar que la tabla existe
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'agenda_pacientes_links';
    `;
    
    console.log('Tablas encontradas:', tables);
    
  } catch (error) {
    console.error('❌ Error creando tabla:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAgendaTable(); 