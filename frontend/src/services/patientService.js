import axios from 'axios';

const API_URL = '/api/patients';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

/**
 * Obtiene los casos clínicos del paciente autenticado
 * @returns {Promise<Object>} - Los casos clínicos del paciente
 */
export const getMyClinicalCases = async () => {
  try {
    const response = await axios.get(`${API_URL}/my/clinical-cases`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error al obtener casos clínicos:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Obtiene las consultas del paciente autenticado
 * @param {Object} params - Parámetros de consulta (opcional)
 * @returns {Promise<Object>} - Las consultas del paciente
 */
export const getMyConsultations = async (params = {}) => {
  try {
    console.log('=== getMyConsultations ===');
    console.log('Parámetros recibidos:', params);
    
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${API_URL}/my/consultations?${queryString}` : `${API_URL}/my/consultations`;
    
    console.log('URL de la petición:', url);
    console.log('Headers:', getAuthHeaders());
    
    const response = await axios.get(url, getAuthHeaders());
    console.log('Respuesta del servidor:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Error al obtener consultas:', error.response?.data?.message || error.message);
    console.error('Error completo:', error);
    throw error;
  }
};

/**
 * Obtiene el historial fotográfico de un paciente
 * @param {string} patientId - El ID del paciente
 * @returns {Promise<Array>} - El historial fotográfico
 */
export const getPhotoHistory = async (patientId) => {
  try {
    const response = await axios.get(`${API_URL}/${patientId}/photo-history`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error al obtener historial fotográfico:', error.response?.data?.message || error.message);
    throw error;
  }
};
