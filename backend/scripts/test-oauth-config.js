const fs = require('fs');
const path = require('path');

function testOAuthConfig() {
  console.log('🔧 Verificando configuración de OAuth...\n');

  // Verificar archivo .env
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.log('❌ Archivo .env no encontrado');
    console.log('📝 Crea un archivo .env en la carpeta backend con las siguientes variables:');
    console.log('');
    console.log('ENCRYPTION_KEY="tu-clave-de-32-caracteres"');
    console.log('GOOGLE_CLIENT_ID="tu-id-de-cliente-google"');
    console.log('GOOGLE_CLIENT_SECRET="tu-secreto-de-cliente-google"');
    console.log('GOOGLE_REDIRECT_URI="http://localhost:3000/api/calendar/external/callback/google"');
    console.log('');
    console.log('📖 Revisa el archivo GOOGLE_OAUTH_SETUP.md para instrucciones detalladas');
    return;
  }

  // Leer variables de entorno
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim().replace(/"/g, '');
    }
  });

  console.log('✅ Archivo .env encontrado');

  // Verificar variables requeridas
  const requiredVars = [
    'ENCRYPTION_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI'
  ];

  let allConfigured = true;
  requiredVars.forEach(varName => {
    if (envVars[varName] && envVars[varName] !== 'your-value-here') {
      console.log(`✅ ${varName}: Configurado`);
    } else {
      console.log(`❌ ${varName}: No configurado o valor por defecto`);
      allConfigured = false;
    }
  });

  console.log('');

  if (allConfigured) {
    console.log('🎉 ¡Configuración completa!');
    console.log('📋 Próximos pasos:');
    console.log('1. Reinicia el servidor backend: npm run dev');
    console.log('2. Inicia el frontend: cd ../frontend && npm run dev');
    console.log('3. Ve al perfil del doctor y prueba vincular Google Calendar');
  } else {
    console.log('⚠️  Configuración incompleta');
    console.log('📖 Revisa GOOGLE_OAUTH_SETUP.md para completar la configuración');
  }

  // Verificar variables opcionales
  console.log('\n📊 Variables opcionales:');
  const optionalVars = [
    'MICROSOFT_CLIENT_ID',
    'MICROSOFT_CLIENT_SECRET',
    'APPLE_CLIENT_ID',
    'NOTION_CLIENT_ID'
  ];

  optionalVars.forEach(varName => {
    if (envVars[varName] && envVars[varName] !== 'your-value-here') {
      console.log(`✅ ${varName}: Configurado`);
    } else {
      console.log(`⏭️  ${varName}: No configurado (opcional)`);
    }
  });
}

// Ejecutar verificación
testOAuthConfig(); 