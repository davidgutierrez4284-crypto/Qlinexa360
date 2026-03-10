#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

// Configuración
const API_BASE_URL = 'http://localhost:3000';
const TEST_FILES_DIR = path.join(__dirname, '../test-files');

// Colores para console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testUpload(filename, expectedResult = 'success') {
  const filePath = path.join(TEST_FILES_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    log(`❌ Archivo no encontrado: ${filename}`, 'red');
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('category', 'MEDICAL_RECORD');

    log(`🔄 Probando upload: ${filename}`, 'blue');
    
    const response = await axios.post(`${API_BASE_URL}/api/files/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer test-token' // Token de prueba
      },
      timeout: 10000
    });

    if (expectedResult === 'success') {
      log(`✅ Upload exitoso: ${filename}`, 'green');
      log(`   Response: ${JSON.stringify(response.data, null, 2)}`, 'green');
      return true;
    } else {
      log(`❌ Upload debería haber fallado: ${filename}`, 'red');
      return false;
    }

  } catch (error) {
    if (expectedResult === 'blocked') {
      log(`✅ Upload bloqueado correctamente: ${filename}`, 'green');
      log(`   Error: ${error.response?.data?.message || error.message}`, 'yellow');
      return true;
    } else {
      log(`❌ Upload falló inesperadamente: ${filename}`, 'red');
      log(`   Error: ${error.response?.data?.message || error.message}`, 'red');
      return false;
    }
  }
}

async function runTests() {
  log('🧪 Iniciando pruebas de seguridad de upload...', 'blue');
  log('', 'reset');

  const tests = [
    // Archivos válidos (deben pasar)
    { filename: 'test-image.jpg', expected: 'success' },
    { filename: 'test-document.pdf', expected: 'success' },
    { filename: 'test-image.png', expected: 'success' },
    
    // Archivos maliciosos (deben ser bloqueados)
    { filename: 'malicious.js', expected: 'blocked' },
    { filename: 'test.exe', expected: 'blocked' },
    { filename: 'suspicious.pdf', expected: 'blocked' }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await testUpload(test.filename, test.expected);
    if (result) {
      passed++;
    } else {
      failed++;
    }
    log('', 'reset');
  }

  log('📊 Resultados de las pruebas:', 'blue');
  log(`✅ Exitosas: ${passed}`, 'green');
  log(`❌ Fallidas: ${failed}`, 'red');
  log(`📈 Total: ${passed + failed}`, 'blue');

  if (failed === 0) {
    log('🎉 ¡Todas las pruebas pasaron! Las medidas de seguridad están funcionando correctamente.', 'green');
  } else {
    log('⚠️  Algunas pruebas fallaron. Revisar la configuración de seguridad.', 'yellow');
  }
}

// Verificar que el servidor esté funcionando
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    log('✅ Servidor funcionando correctamente', 'green');
    return true;
  } catch (error) {
    log('❌ Servidor no está funcionando. Ejecuta: npm run dev', 'red');
    return false;
  }
}

async function main() {
  log('🔍 Verificando servidor...', 'blue');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    process.exit(1);
  }

  log('', 'reset');
  await runTests();
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(error => {
    log(`❌ Error en las pruebas: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testUpload, runTests }; 