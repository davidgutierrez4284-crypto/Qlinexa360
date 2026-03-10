/**
 * Obtiene DATABASE_URL de Secrets Manager y ejecuta la validación.
 * Evita problemas de escape en PowerShell con caracteres como # en la contraseña.
 * Ejecutar: node scripts/validate-prod-from-secrets.js
 * Requiere: AWS CLI configurado (aws configure)
 */

const { execSync } = require('child_process');

function main() {
  try {
    const cmd = 'aws secretsmanager get-secret-value --secret-id qlinexa360-prod-database-url --region us-east-2 --query SecretString --output text';
    let databaseUrl = execSync(cmd, { encoding: 'utf8' }).trim();
    databaseUrl = databaseUrl.replace(/^"|"$/g, ''); // quitar comillas si las hay
    try {
      const parsed = JSON.parse(databaseUrl);
      databaseUrl = typeof parsed === 'string' ? parsed : parsed.DATABASE_URL || parsed.database_url || databaseUrl;
    } catch (_) {
      // SecretString es la URL directa
    }
    
    // Codificar caracteres especiales en la contraseña (#, @, etc.) que rompen el parseo
    const match = databaseUrl.match(/^(.+?:\/\/[^:]+:)([^@]+)(@.+)$/);
    if (match) {
      const encodedPassword = encodeURIComponent(match[2]);
      databaseUrl = match[1] + encodedPassword + match[3];
    }
    
    if (!databaseUrl) {
      console.error('❌ No se encontró DATABASE_URL en el secreto.');
      process.exit(1);
    }

    process.env.DATABASE_URL = databaseUrl;
    execSync('npx ts-node scripts/validate-prod-data.ts', {
      stdio: 'inherit',
      cwd: __dirname + '/..'
    });
  } catch (err) {
    const errStr = String(err.message || err.stderr || err);
    if (errStr.includes('SecretNotFound')) {
      console.error('❌ No se encontró el secreto qlinexa360-prod-database-url');
    } else if (errStr.includes("Can't reach database server")) {
      console.error('\n❌ No se puede conectar a RDS desde tu máquina.');
      console.error('   RDS está en una subred privada y solo es accesible desde la VPC (ECS).');
      console.error('\n   Alternativa: Usa el endpoint del API (tras redesplegar el backend):');
      console.error('   Invoke-RestMethod -Uri "https://api.qlinexa360.com/api/admin/db-stats"');
    } else if (err.code === 'ENOENT' || errStr.includes('ts-node')) {
      console.error('❌ Ejecuta desde la carpeta backend: node scripts/validate-prod-from-secrets.js');
    } else {
      console.error('❌ Error:', err.message || err);
    }
    process.exit(1);
  }
}

main();
