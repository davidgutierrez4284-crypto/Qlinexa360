// Configuración para sincronización de calendarios externos

// Función segura para acceder a variables de entorno en el navegador
const getEnvVar = (key) => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }

  if (typeof window !== 'undefined' && window.ENV && window.ENV[key]) {
    return window.ENV[key];
  }

  return '';
};

const getRedirectUri = (envKey, fallback) => {
  const value = getEnvVar(envKey);
  return value || fallback;
};

export const CALENDAR_SYNC_CONFIG = {
  // Microsoft Outlook / Office 365
  outlook: {
    name: 'Microsoft Outlook',
    description: 'Sincroniza con tu calendario de Outlook/Office 365',
    icon: '📧',
    color: 'blue',
    authUrl: 'http://localhost:3000/api/calendar-sync/auth/outlook',
    features: [
      'Sincronización bidireccional',
      'Eventos recurrentes', 
      'Recordatorios automáticos',
      'Integración con Teams'
    ],
    oauth: {
      clientId: getEnvVar('VITE_OUTLOOK_CLIENT_ID'),
      redirectUri: getRedirectUri('VITE_OUTLOOK_REDIRECT_URI', 'http://localhost:3000/api/calendar-sync/auth/outlook/callback'),
      scope: 'Calendars.ReadWrite offline_access',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
    }
  },

  // Google Calendar
  google: {
    name: 'Google Calendar',
    description: 'Conecta con tu calendario de Google',
    icon: '📅',
    color: 'red',
    authUrl: 'http://localhost:3000/api/calendar-sync/auth/google',
    features: [
      'Sincronización en tiempo real',
      'Múltiples calendarios',
      'Integración con Meet',
      'Eventos de Google Workspace'
    ],
    oauth: {
      clientId: getEnvVar('VITE_GOOGLE_CLIENT_ID'),
      redirectUri: getRedirectUri('VITE_GOOGLE_REDIRECT_URI', 'http://localhost:3000/api/calendar-sync/auth/google/callback'),
      scope: 'https://www.googleapis.com/auth/calendar',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth'
    }
  },

  // Apple Calendar / iCloud
  apple: {
    name: 'Apple Calendar',
    description: 'Conecta con tu calendario de Apple iCloud',
    icon: '🍎',
    color: 'black',
    authUrl: 'http://localhost:3000/api/calendar-sync/auth/apple',
    features: [
      'Sincronización iCloud',
      'Eventos familiares',
      'Ubicaciones automáticas',
      'Integración con Siri'
    ],
    oauth: {
      clientId: getEnvVar('VITE_APPLE_CLIENT_ID'),
      redirectUri: getRedirectUri('VITE_APPLE_REDIRECT_URI', 'http://localhost:3000/api/calendar-sync/auth/apple/callback'),
      scope: 'calendar',
      authUrl: 'https://appleid.apple.com/auth/authorize'
    }
  }
};

export const getProviderConfig = (providerId) => {
  return CALENDAR_SYNC_CONFIG[providerId] || null;
};

export const getAllProviders = () => {
  return Object.keys(CALENDAR_SYNC_CONFIG).map(id => ({
    id,
    ...CALENDAR_SYNC_CONFIG[id]
  }));
};

export const isProviderConfigured = (providerId) => {
  const config = getProviderConfig(providerId);
  if (!config) return false;
  return !!config.oauth.clientId;
};

export const generateOAuthUrl = (providerId, state = '') => {
  const config = getProviderConfig(providerId);
  if (!config || !isProviderConfigured(providerId)) {
    return config?.authUrl || '#';
  }

  const params = new URLSearchParams({
    client_id: config.oauth.clientId,
    redirect_uri: config.oauth.redirectUri,
    scope: config.oauth.scope,
    response_type: 'code',
    state: state
  });

  if (providerId === 'google') {
    params.append('access_type', 'offline');
    params.append('prompt', 'consent');
    params.append('include_granted_scopes', 'true');
  }

  if (providerId === 'outlook') {
    params.append('response_mode', 'query');
  }

  return `${config.oauth.authUrl}?${params.toString()}`;
};

export const SYNC_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  SYNCING: 'syncing',
  ERROR: 'error'
};

export const SYNC_EVENT_TYPES = {
  AUTH_SUCCESS: 'CALENDAR_AUTH_SUCCESS',
  AUTH_ERROR: 'CALENDAR_AUTH_ERROR',
  SYNC_START: 'CALENDAR_SYNC_START',
  SYNC_COMPLETE: 'CALENDAR_SYNC_COMPLETE',
  SYNC_ERROR: 'CALENDAR_SYNC_ERROR'
};

export const AUTO_SYNC_CONFIG = {
  interval: 15 * 60 * 1000,
  retryAttempts: 3,
  retryDelay: 5000,
  maxEventsPerSync: 100
};

export default CALENDAR_SYNC_CONFIG;
