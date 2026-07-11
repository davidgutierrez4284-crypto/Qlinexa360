/**
 * 1) Windows: intenta cerrar node del backend medilink360 (libera query_engine DLL).
 * 2) Borra node_modules/.prisma/client
 */
require('./prisma-unlock-backend-node.js');

const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
try {
  fs.rmSync(p, { recursive: true, force: true });
  console.log('OK: eliminado', p);
} catch (e) {
  console.error('\nNo se pudo borrar .prisma/client (archivo en uso).');
  console.error('Prueba: cierra todas las terminales con "npm run dev", cierra Cursor y vuelve a ejecutar npm run db:prisma:clean');
  console.error('O en el Administrador de tareas finaliza procesos "Node.js JavaScript Runtime".\n');
  console.error(e);
  process.exit(1);
}
