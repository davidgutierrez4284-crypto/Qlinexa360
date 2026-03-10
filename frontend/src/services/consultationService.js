import axios from 'axios';
import { getApiUrl } from '../utils/api';

// Usar rutas relativas para aprovechar el proxy de Vite; en producción getApiUrl apunta a api.qlinexa360.com
const getApiPath = (path) => getApiUrl(path) || path;

// Configuración de headers de autenticación
const getAuthHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json'
});

// --- Servicios de Consultas Divididas ---

/**
 * Crear consulta básica (Parte 1)
 */
export const createBasicConsultation = async (data) => {
  try {
    const response = await axios.post(getApiPath('/api/consultations/basic'), data, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error al crear consulta básica:', error);
    throw error;
  }
};

/**
 * Agregar archivos a una consulta existente (Parte 2)
 */
export const addAttachmentsToConsultation = async (consultationId, data) => {
  try {
    const response = await axios.post(getApiPath(`/api/consultations/${consultationId}/attachments`), data, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error al agregar archivos a consulta:', error);
    throw error;
  }
};

/**
 * Marcar consulta como completa
 */
export const markConsultationComplete = async (consultationId) => {
  try {
    const response = await axios.put(getApiPath(`/api/consultations/${consultationId}/complete`), {}, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error al marcar consulta como completa:', error);
    throw error;
  }
};

/**
 * Obtener consultas pendientes
 */
export const getPendingConsultations = async (patientId, clinicalCaseId = null) => {
  try {
    const params = clinicalCaseId ? { clinicalCaseId } : {};
    const response = await axios.get(getApiPath(`/api/consultations/pending/${patientId}`), {
      headers: getAuthHeaders(),
      params
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener consultas pendientes:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas de consultas
 */
export const getConsultationStats = async (patientId, clinicalCaseId = null) => {
  try {
    const params = clinicalCaseId ? { clinicalCaseId } : {};
    const response = await axios.get(getApiPath(`/api/consultations/stats/${patientId}`), {
      headers: getAuthHeaders(),
      params
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener estadísticas de consultas:', error);
    throw error;
  }
};

/**
 * Obtener consulta por ID
 */
export const getConsultationById = async (consultationId) => {
  try {
    const response = await axios.get(getApiPath(`/api/consultations/${consultationId}`), {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error al obtener consulta:', error);
    throw error;
  }
};

/**
 * Actualizar consulta
 */
export const updateConsultation = async (consultationId, data) => {
  try {
    const response = await axios.put(getApiPath(`/api/consultations/${consultationId}`), data, {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error al actualizar consulta:', error);
    throw error;
  }
};

/**
 * Eliminar consulta
 */
export const deleteConsultation = async (consultationId) => {
  try {
    const response = await axios.delete(getApiPath(`/api/consultations/${consultationId}`), {
      headers: getAuthHeaders()
    });
    return response.data;
  } catch (error) {
    console.error('Error al eliminar consulta:', error);
    throw error;
  }
};

// --- Utilidades ---

/**
 * Obtener el estado de una consulta
 */
export const getConsultationStatus = (consultation) => {
  if (consultation.isComplete) {
    return {
      status: 'complete',
      label: 'Completa',
      color: 'green',
      icon: 'check-circle'
    };
  } else if (consultation.hasAttachments) {
    return {
      status: 'with-attachments',
      label: 'Con archivos',
      color: 'blue',
      icon: 'document'
    };
  } else {
    return {
      status: 'pending',
      label: 'Pendiente',
      color: 'yellow',
      icon: 'clock'
    };
  }
};

/**
 * Validar datos de consulta básica
 */
export const validateBasicConsultation = (data) => {
  const errors = [];

  if (!data.clinicalEvolution) {
    errors.push('La evolución clínica es obligatoria');
  }

  if (!data.reason) {
    errors.push('El motivo de la consulta es obligatorio');
  }

  if (!data.notes) {
    errors.push('Las notas o diagnóstico son obligatorias');
  }

  return errors;
};

/**
 * Validar datos de archivos
 */
export const validateAttachments = (data) => {
  const errors = [];

  // Verificar que al menos hay algún archivo o link
  const hasFiles = Object.values(data.files || {}).some(files => files && files.length > 0);
  const hasLinks = data.links && data.links.length > 0;

  if (!hasFiles && !hasLinks) {
    errors.push('Debe agregar al menos un archivo o link');
  }

  return errors;
};

/**
 * Formatear fecha para mostrar
 */
export const formatConsultationDate = (date) => {
  if (!date) return 'No especificada';
  
  try {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Fecha inválida';
  }
};

/**
 * Obtener resumen de archivos
 */
export const getFilesSummary = (consultation) => {
  const files = consultation.files || [];
  const summary = {
    total: files.length,
    byCategory: {}
  };

  files.forEach(file => {
    const category = file.category || 'OTHER';
    summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
  });

  return summary;
};

export default {
  createBasicConsultation,
  addAttachmentsToConsultation,
  markConsultationComplete,
  getPendingConsultations,
  getConsultationStats,
  getConsultationById,
  updateConsultation,
  deleteConsultation,
  getConsultationStatus,
  validateBasicConsultation,
  validateAttachments,
  formatConsultationDate,
  getFilesSummary
}; 