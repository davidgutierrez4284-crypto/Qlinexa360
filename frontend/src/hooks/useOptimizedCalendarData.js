import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiUrl, getApiHeaders } from '../utils/api';

// Caché en memoria para evitar llamadas repetidas a la API
const dataCache = new Map();
const cacheExpiry = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useOptimizedCalendarData = () => {
  const [data, setData] = useState({
    events: [],
    patients: [],
    configs: {}
  });
  const [loading, setLoading] = useState({
    events: false,
    patients: false,
    configs: false
  });
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  // Función para verificar si el caché es válido
  const isCacheValid = useCallback((key) => {
    const expiry = cacheExpiry.get(key);
    return expiry && Date.now() < expiry;
  }, []);

  // Función para obtener datos del caché
  const getFromCache = useCallback((key) => {
    if (isCacheValid(key)) {
      return dataCache.get(key);
    }
    // Limpiar caché expirado
    dataCache.delete(key);
    cacheExpiry.delete(key);
    return null;
  }, [isCacheValid]);

  // Función para guardar datos en caché
  const setCache = useCallback((key, value) => {
    dataCache.set(key, value);
    cacheExpiry.set(key, Date.now() + CACHE_DURATION);
  }, []);

  // Función para limpiar caché específico
  const clearCache = useCallback((key) => {
    if (key) {
      dataCache.delete(key);
      cacheExpiry.delete(key);
    } else {
      dataCache.clear();
      cacheExpiry.clear();
    }
  }, []);

  // Función para cargar eventos del calendario
  const loadEvents = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'calendar_events';
    
    if (!forceRefresh) {
      const cachedEvents = getFromCache(cacheKey);
      if (cachedEvents) {
        setData(prev => ({ ...prev, events: cachedEvents }));
        return;
      }
    }

    setLoading(prev => ({ ...prev, events: true }));
    
    try {
      // Cancelar petición anterior si existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(getApiUrl('/api/calendar/events'), {
        headers: getApiHeaders(),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Error al cargar eventos');
      
      const events = await response.json();
      
      setData(prev => ({ ...prev, events }));
      setCache(cacheKey, events);
      setError(null);
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading events:', err);
        setError(err.message);
      }
    } finally {
      setLoading(prev => ({ ...prev, events: false }));
    }
  }, [getFromCache, setCache]);

  // Función para cargar pacientes
  const loadPatients = useCallback(async (forceRefresh = false) => {
    const cacheKey = 'calendar_patients';
    
    if (!forceRefresh) {
      const cachedPatients = getFromCache(cacheKey);
      if (cachedPatients) {
        setData(prev => ({ ...prev, patients: cachedPatients }));
        return;
      }
    }

    setLoading(prev => ({ ...prev, patients: true }));
    
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(getApiUrl('/api/doctors/my-patients'), {
        headers: getApiHeaders(),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Error al cargar pacientes');
      
      const patients = await response.json();
      
      setData(prev => ({ ...prev, patients }));
      setCache(cacheKey, patients);
      setError(null);
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading patients:', err);
        setError(err.message);
      }
    } finally {
      setLoading(prev => ({ ...prev, patients: false }));
    }
  }, [getFromCache, setCache]);

  // Función para cargar configuraciones específicas
  const loadConfig = useCallback(async (configType, forceRefresh = false) => {
    const cacheKey = `calendar_config_${configType}`;
    
    if (!forceRefresh) {
      const cachedConfig = getFromCache(cacheKey);
      if (cachedConfig) {
        setData(prev => ({ 
          ...prev, 
          configs: { ...prev.configs, [configType]: cachedConfig } 
        }));
        return;
      }
    }

    setLoading(prev => ({ ...prev, configs: true }));
    
    try {
      let configData = null;
      
      switch (configType) {
        case 'agenda':
          const agendaResponse = await fetch(getApiUrl('/api/agenda-pacientes/config'), {
            headers: getApiHeaders()
          });
          if (agendaResponse.ok) {
            configData = await agendaResponse.json();
          }
          break;
          
        case 'schedule':
          const scheduleResponse = await fetch(getApiUrl('/api/schedule/config'), {
            headers: getApiHeaders()
          });
          if (scheduleResponse.ok) {
            configData = await scheduleResponse.json();
          }
          break;
          
        case 'reminders':
          const remindersResponse = await fetch(getApiUrl('/api/doctors/reminder-config'), {
            headers: getApiHeaders()
          });
          if (remindersResponse.ok) {
            configData = await remindersResponse.json();
          }
          break;
          
        default:
          throw new Error(`Tipo de configuración no soportado: ${configType}`);
      }
      
      if (configData) {
        setData(prev => ({ 
          ...prev, 
          configs: { ...prev.configs, [configType]: configData } 
        }));
        setCache(cacheKey, configData);
        setError(null);
      }
      
    } catch (err) {
      console.error(`Error loading ${configType} config:`, err);
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, configs: false }));
    }
  }, [getFromCache, setCache]);

  // Función para precargar datos en segundo plano
  const preloadData = useCallback(async () => {
    // Precargar eventos y pacientes en paralelo
    Promise.allSettled([
      loadEvents(false), // Usar caché si está disponible
      loadPatients(false) // Usar caché si está disponible
    ]);
  }, [loadEvents, loadPatients]);

  // Función para refrescar todos los datos
  const refreshAllData = useCallback(async () => {
    setLoading({
      events: true,
      patients: true,
      configs: true
    });
    
    try {
      await Promise.allSettled([
        loadEvents(true),
        loadPatients(true)
      ]);
    } catch (error) {
      console.error('Error refreshing all data:', error);
    } finally {
      setLoading({
        events: false,
        patients: false,
        configs: false
      });
    }
  }, [loadEvents, loadPatients]);

  // Limpiar caché cuando el componente se desmonta
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Función para invalidar caché específico
  const invalidateCache = useCallback((key) => {
    clearCache(key);
  }, [clearCache]);

  // Función para obtener estado de carga general
  const isAnyLoading = Object.values(loading).some(Boolean);

  return {
    data,
    loading,
    error,
    isAnyLoading,
    loadEvents,
    loadPatients,
    loadConfig,
    preloadData,
    refreshAllData,
    clearCache,
    invalidateCache
  };
};
