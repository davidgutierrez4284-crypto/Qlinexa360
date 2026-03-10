import axios from 'axios';

const API_URL = '/api/doctors'; // La URL base para las rutas de doctor

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`
    }
  };
};

/**
 * Busca profesionales de la salud registrados (para colaboración en expedientes).
 * Solo disponible para doctores autenticados.
 * @param {string} searchTerm - El término para buscar (nombre, apellido o email).
 * @returns {Promise<Array>} - Una lista de profesionales que coinciden.
 */
export const searchHealthProfessionals = async (searchTerm) => {
  try {
    const response = await axios.get('/api/doctors', {
      ...getAuthHeaders(),
      params: { search: searchTerm }
    });
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error('Error al buscar profesionales de la salud:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Busca pacientes asignados a un doctor por un término de búsqueda.
 * @param {string} searchTerm - El término para buscar.
 * @returns {Promise<Array>} - Una lista de pacientes que coinciden.
 */
export const searchPatients = async (searchTerm) => {
  try {
    const response = await axios.get('/api/doctors/search-patients', {
      ...getAuthHeaders(),
      params: {
        term: searchTerm,
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error al buscar pacientes:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Obtiene los detalles completos de un paciente, incluyendo su historial de consultas.
 * @param {string} patientId - El ID del paciente.
 * @returns {Promise<Object>} - Una promesa que resuelve al objeto del paciente con sus detalles.
 */
export const getPatientDetails = async (patientId) => {
  if (!patientId) {
    throw new Error('El ID del paciente es requerido');
  }
  try {
    const response = await axios.get(`${API_URL}/patients/${patientId}`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error(`Error al obtener los detalles del paciente ${patientId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Crea una nueva consulta para un paciente.
 * @param {string} patientId - El ID del paciente.
 * @param {Object} consultationData - Los datos de la consulta.
 * @param {string} consultationData.date - Fecha de la consulta.
 * @param {string} consultationData.reason - Motivo de la consulta.
 * @param {string} [consultationData.diagnosis] - Diagnóstico.
 * @param {string} [consultationData.notes] - Notas adicionales.
 * @param {boolean} [consultationData.isPublic] - Si la nota es visible para el paciente.
 * @returns {Promise<Object>} - La nueva consulta creada.
 */
export const createConsultation = async (patientId, consultationData) => {
  if (!patientId) {
    throw new Error('El ID del paciente es requerido para crear una consulta');
  }
  try {
    const response = await axios.post(`${API_URL}/patients/${patientId}/medical-records`, consultationData, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error(`Error al crear la consulta para el paciente ${patientId}:`, error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Sube un archivo al servidor.
 * @param {File} file - El archivo a subir.
 * @param {string} category - La categoría del archivo (ej: 'PRESCRIPTION_REQUEST').
 * @param {Function} [onUploadProgress] - Callback para el progreso de la subida.
 * @returns {Promise<Object>} - El objeto del archivo subido desde el backend.
 */
export const uploadFile = async (file, category, onUploadProgress) => {
  if (!file) {
    throw new Error('No se ha proporcionado ningún archivo');
  }

  if (!category) {
    throw new Error('La categoría del archivo es requerida');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  try {
    const response = await axios.post('/api/files/upload', formData, {
      ...getAuthHeaders(),
      headers: {
        ...getAuthHeaders().headers,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onUploadProgress && progressEvent.total) {
          onUploadProgress(progressEvent);
        }
      },
      timeout: 30000, // 30 segundos de timeout
    });

    // Verificar que la respuesta contiene los datos esperados
    if (!response.data || !response.data.file) {
      throw new Error('Respuesta inesperada del servidor');
    }

    return response.data.file;
  } catch (error) {
    // Manejar diferentes tipos de errores
    if (error.code === 'ECONNABORTED') {
      throw new Error('La subida del archivo tardó demasiado tiempo');
    }
    
    if (error.response) {
      // Error de respuesta del servidor
      const errorMessage = error.response.data?.message || 'Error del servidor';
      throw new Error(errorMessage);
    } else if (error.request) {
      // Error de red
      throw new Error('Error de conexión. Verifica tu conexión a internet');
    } else {
      // Otros errores
      throw new Error(error.message || 'Error desconocido al subir el archivo');
    }
  }
};

/**
 * Registra un nuevo paciente desde la cuenta de un doctor.
 * @param {Object} patientData - Los datos del nuevo paciente.
 * @returns {Promise<Object>} - El objeto del paciente creado.
 */
export const createPatient = async (patientData) => {
  try {
    const response = await axios.post('/api/doctors/patients', patientData, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error al registrar al paciente:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Obtiene las plantillas de formulario para la especialidad del doctor autenticado.
 * @returns {Promise<Array>} - Una lista de plantillas de formulario.
 */
export const getFormTemplates = async () => {
  try {
    const response = await axios.get('/api/form-templates', getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error al obtener las plantillas de formulario:', error.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Actualiza los datos adicionales de un paciente.
 * @param {string} patientId - El ID del paciente.
 * @param {Object} data - Los datos a actualizar.
 * @returns {Promise<Object>} - El paciente actualizado.
 */
export const updatePatient = async (patientId, data) => {
  if (!patientId) throw new Error('El ID del paciente es requerido para actualizar.');
  try {
    const response = await axios.put(`/api/doctors/patients/${patientId}`, data, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error(`Error al actualizar los datos del paciente ${patientId}:`, error.response?.data?.message || error.message);
    throw error;
  }
}; 

/**
 * Obtiene todos los pacientes asignados al doctor actual.
 * @param {Object} params - Parámetros de búsqueda y ordenamiento.
 * @returns {Promise<Array>} - Lista de pacientes con sus casos clínicos.
 */
export const getAllMyPatients = async (params = {}) => {
  try {
    const response = await axios.get('/api/doctors/my-patients', {
      ...getAuthHeaders(),
      params
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener pacientes:', error.response?.data?.message || error.message);
    throw error;
  }
}; 