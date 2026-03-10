/**
 * Devuelve la URL completa para peticiones a la API.
 * En producción: usa api.qlinexa360.com (VITE_API_URL o fallback por hostname)
 * En desarrollo: devuelve path relativo para que el proxy de Vite funcione
 */
const PROD_API = 'https://api.qlinexa360.com';

/**
 * Headers para peticiones de API (incluye X-Selected-Doctor-Id para asistentes).
 * Usar en fetch() para schedule/config, reminder-config, etc.
 */
export const getApiHeaders = () => {
  const headers = { 'Authorization': `Bearer ${localStorage.getItem('token')}` };
  const selectedDoctorId = localStorage.getItem('selectedDoctorId');
  if (selectedDoctorId) headers['X-Selected-Doctor-Id'] = selectedDoctorId;
  return headers;
};

export const getApiUrl = (path) => {
  let base = import.meta.env.VITE_API_URL;
  if (!base && typeof window !== 'undefined') {
    const h = window.location?.hostname || '';
    if (h.includes('qlinexa360.com') && !h.startsWith('api.')) {
      base = PROD_API;
    }
  }
  if (base) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base.replace(/\/$/, '')}${cleanPath}`;
  }
  return path;
};
