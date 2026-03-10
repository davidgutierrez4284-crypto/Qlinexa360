const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

async function testPatientEndpoints() {
  try {
    console.log('🧪 Probando endpoints de pacientes...\n');

    // 1. Primero necesitamos obtener un token de autenticación para el paciente
    console.log('1️⃣ Intentando autenticar al paciente...');
    
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'new.test.patient@example.com',
      password: 'password123' // Asumiendo que esta es la contraseña
    });

    if (loginResponse.data.token) {
      console.log('✅ Autenticación exitosa');
      const token = loginResponse.data.token;
      const headers = { Authorization: `Bearer ${token}` };

      // 2. Probar endpoint de casos clínicos
      console.log('\n2️⃣ Probando endpoint de casos clínicos...');
      try {
        const clinicalCasesResponse = await axios.get(`${API_BASE_URL}/patients/my/clinical-cases`, { headers });
        console.log('✅ Casos clínicos obtenidos:', clinicalCasesResponse.data.length);
        clinicalCasesResponse.data.forEach((case_, index) => {
          console.log(`   Caso ${index + 1}: ${case_.padecimiento}`);
          console.log(`   Consultas: ${case_.consultations.length}`);
          case_.consultations.forEach((consultation, consultIndex) => {
            console.log(`     Consulta ${consultIndex + 1}: ${consultation.isContentVisible ? '✅ Visible' : '🔒 Privada'}`);
          });
        });
      } catch (error) {
        console.log('❌ Error al obtener casos clínicos:', error.response?.data?.message || error.message);
      }

      // 3. Probar endpoint de consultas
      console.log('\n3️⃣ Probando endpoint de consultas...');
      try {
        const consultationsResponse = await axios.get(`${API_BASE_URL}/patients/my/consultations`, { headers });
        console.log('✅ Consultas obtenidas:', consultationsResponse.data.length);
        consultationsResponse.data.forEach((consultation, index) => {
          console.log(`   Consulta ${index + 1}: ${consultation.isContentVisible ? '✅ Visible' : '🔒 Privada'}`);
          console.log(`   Diagnóstico: ${consultation.diagnosis}`);
          console.log(`   Fecha: ${new Date(consultation.createdAt).toLocaleDateString('es-ES')}`);
        });
      } catch (error) {
        console.log('❌ Error al obtener consultas:', error.response?.data?.message || error.message);
      }

    } else {
      console.log('❌ No se pudo obtener token de autenticación');
    }

  } catch (error) {
    console.error('❌ Error general:', error.response?.data?.message || error.message);
  }
}

testPatientEndpoints();
