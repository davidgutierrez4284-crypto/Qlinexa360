const { execSync } = require('child_process');
const path = require('path');

process.chdir(path.join(__dirname));

console.log('Running database migrations...');
try {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
}

console.log('Starting server...');
require('./dist/server.js');
