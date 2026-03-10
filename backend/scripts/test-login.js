const axios = require('axios');

/**
 * Script para probar el endpoint de login directamente
 */

async function testLogin() {
  try {
    const email = 'test.doctor1@medilink360.com';
    const password = 'password123';
    
    console.log('🧪 Probando login...');
    console.log('Email:', email);
    console.log('URL:', 'http://localhost:3000/api/auth/login');
    
    const response = await axios.post('http://localhost:3000/api/auth/login', {
      email,
      password
    });
    
    console.log('\n✅ Login exitoso!');
    console.log('Status:', response.status);
    console.log('Usuario:', response.data.user);
    console.log('Token recibido:', response.data.token ? 'Sí' : 'No');
    
  } catch (error) {
    console.error('\n❌ Error en login:');
    
    if (error.response) {
      // El servidor respondió con un código de estado de error
      console.error('Status:', error.response.status);
      console.error('Mensaje:', error.response.data?.message || error.response.data);
      console.error('Datos completos:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // La petición fue hecha pero no se recibió respuesta
      console.error('No se recibió respuesta del servidor');
      console.error('¿El servidor backend está corriendo en http://localhost:3000?');
    } else {
      // Algo más causó el error
      console.error('Error:', error.message);
    }
    
    console.error('\nStack:', error.stack);
  }
}

testLogin();

