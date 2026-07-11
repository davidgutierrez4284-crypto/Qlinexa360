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
 * Expediente del paciente autenticado (misma ficha que usa el profesional: user, contactos de emergencia, etc.)
 * @returns {Promise<Object>}
 */
export const getMyProfile = async () => {
  try {
    const response = await axios.get(`${API_URL}/my/profile`, getAuthHeaders());
    return response.data;
  } catch (error) {
    console.error('Error al obtener perfil:', error.response?.data?.message || error.message);
    throw error;
  }
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

/** Paciente: colaboradores e invitaciones pendientes por caso clínico */
export const getMyCaseShareAccess = async (clinicalCaseId) => {
  const response = await axios.get(`${API_URL}/my/case-share-access`, {
    ...getAuthHeaders(),
    params: { clinicalCaseId }
  });
  return response.data;
};

/** Paciente: revocar acceso de un colaborador (o cancelar invitación pendiente) en un caso */
export const revokeMyCaseCollaborator = async (clinicalCaseId, doctorId) => {
  const response = await axios.delete(
    `${API_URL}/my/case-share-access/${encodeURIComponent(clinicalCaseId)}/collaborators/${encodeURIComponent(doctorId)}`,
    getAuthHeaders()
  );
  return response.data;
};

/** Paciente: invitar profesional ya registrado (flujo de consentimiento por correo) */
export const patientInviteRegisteredCollaborator = async (clinicalCaseId, doctorId) => {
  const auth = getAuthHeaders();
  const response = await axios.post(
    `${API_URL}/my/invite-collaborator-registered`,
    { clinicalCaseId, doctorId },
    { headers: { ...auth.headers, 'Content-Type': 'application/json' } }
  );
  return response.data;
};

/** Paciente: invitar por correo a profesional no registrado */
export const patientInviteExternalCollaborator = async (clinicalCaseId, email) => {
  const auth = getAuthHeaders();
  const response = await axios.post(
    `${API_URL}/my/invite-collaborator-external`,
    { clinicalCaseId, email },
    { headers: { ...auth.headers, 'Content-Type': 'application/json' } }
  );
  return response.data;
};

/** Paciente: recetas emitidas a su persona (solo lectura) */
export const getMyRecipes = async () => {
  const response = await axios.get(`${API_URL}/my/recipes`, getAuthHeaders());
  return response.data;
};

export const getMyRecipeById = async (recipeId) => {
  const response = await axios.get(`${API_URL}/my/recipes/${encodeURIComponent(recipeId)}`, getAuthHeaders());
  return response.data;
};

export const getMyRecipePdfViewUrl = async (recipeId) => {
  const response = await axios.get(
    `${API_URL}/my/recipes/${encodeURIComponent(recipeId)}/pdf-view-url`,
    getAuthHeaders()
  );
  return response.data;
};

/** Búsqueda de doctores en la plataforma (paciente u doctor) */
export const searchDoctorsForCollaboration = async (searchTerm) => {
  const response = await axios.get('/api/doctors', {
    ...getAuthHeaders(),
    params: { search: searchTerm }
  });
  return Array.isArray(response.data) ? response.data : [];
};
