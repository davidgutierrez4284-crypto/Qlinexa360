const axios = require('axios');

// Configuración
const BASE_URL = 'http://localhost:3000';
const DOCTOR_EMAIL = 'doctor1@qlinexa.com';
const DOCTOR_PASSWORD = 'password123';

async function testPatientCreation() {
  try {
    console.log('🔍 Iniciando prueba de creación de paciente...');
    
    // Paso 1: Login del doctor
    console.log('1. Haciendo login del doctor...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: DOCTOR_EMAIL,
      password: DOCTOR_PASSWORD
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login exitoso, token obtenido');
    
    // Paso 2: Crear un paciente
    console.log('2. Intentando crear un paciente...');
    const patientData = {
      firstName: 'Test',
      lastName: 'Patient',
      email: 'test.patient@example.com',
      phone: '123456789',
      dateOfBirth: '1990-01-01'
    };
    
    const createResponse = await axios.post(`${BASE_URL}/api/doctors/patients`, patientData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Paciente creado exitosamente:', createResponse.data);
    
    // Paso 3: Verificar que el paciente aparece en la búsqueda
    console.log('3. Verificando búsqueda de pacientes...');
    const searchResponse = await axios.get(`${BASE_URL}/api/doctors/search-patients?term=Test`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Búsqueda exitosa:', searchResponse.data);
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', error.response.data);
    }
  }
}

testPatientCreation(); 