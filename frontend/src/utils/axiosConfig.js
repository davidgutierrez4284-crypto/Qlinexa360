import axios from 'axios';
import { toast } from 'react-toastify';

// En producción, las peticiones /api deben ir a api.qlinexa360.com (no a S3)
const apiBase = import.meta.env.VITE_API_URL;
if (apiBase) {
  axios.defaults.baseURL = apiBase;
}

// Interceptor para agregar el header del doctor seleccionado automáticamente
axios.interceptors.request.use(
  (config) => {
    // NO enviar headers de autenticación para rutas públicas de pre-consulta
    const isPreConsultationRoute = config.url?.includes('/pre-consultations/token/');
    
    if (!isPreConsultationRoute) {
      // Obtener el doctorId seleccionado del localStorage
      const selectedDoctorId = localStorage.getItem('selectedDoctorId');
      
      if (selectedDoctorId) {
        config.headers['X-Selected-Doctor-Id'] = selectedDoctorId;
      }
      
      // Agregar token de autenticación si existe (para otras rutas)
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuesta para manejar errores de suscripción cancelada
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.message || '';
    if (
      error.response?.status === 403 &&
      (message.includes('Asistente no vinculado') ||
        message.includes('Doctor seleccionado requerido'))
    ) {
      localStorage.removeItem('selectedDoctorId');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('selectedDoctorId_')) {
          localStorage.removeItem(key);
        }
      });
    }

    // Si es un error 403 y el mensaje indica suscripción cancelada
    if (error.response?.status === 403 && error.response?.data?.readOnly) {
      const message = error.response.data.message || 'Tu suscripción está cancelada. Solo puedes consultar información.';
      toast.error(message, {
        autoClose: 5000,
        position: 'top-right'
      });
    }
    return Promise.reject(error);
  }
);

export default axios;

