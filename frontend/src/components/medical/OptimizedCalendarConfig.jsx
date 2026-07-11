import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { 
  ClockIcon, 
  BellIcon, 
  LinkIcon,
  CogIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl, getApiHeaders } from '../../utils/api';
import { CALENDAR_SYNC_CONFIG } from '../../config/calendarSync';
import {
  CheckCircleIcon as CheckCircleIconSync,
  XCircleIcon as XCircleIconSync,
  ArrowPathIcon as ArrowPathIconSync,
  LinkIcon as LinkIconSync,
  TrashIcon as TrashIconSync
} from '@heroicons/react/24/outline';
import { GlobeAmericasIcon } from '@heroicons/react/24/outline';
import CalendlyStyleScheduleConfig from './CalendlyStyleScheduleConfig';
import ReminderConfigSection from './ReminderConfigSection';
import TimezoneConfigSection from './TimezoneConfigSection';
import MercadoPagoSettings from '../payments/MercadoPagoSettings';

// Componente de gestión de calendarios externos (integrado para evitar problemas de importación)
const CalendarSyncManager = () => {
  const [syncStatus, setSyncStatus] = useState({
    google: { connected: false, lastSync: null, error: null },
    outlook: { connected: false, lastSync: null, error: null },
    apple: { connected: false, lastSync: null, error: null }
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState({});

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl('/api/calendar-sync/sync-status'), {
        headers: getApiHeaders()
      });

      if (response.data?.success) {
        const data = response.data.data || {};
        setSyncStatus({
          google: data.google || { connected: false, lastSync: null, error: null },
          outlook: data.outlook || { connected: false, lastSync: null, error: null },
          apple: data.apple || { connected: false, lastSync: null, error: null }
        });
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
      toast.error('Error al cargar el estado de sincronización');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (provider) => {
    try {
      // Obtener el doctorId del usuario autenticado
      let doctorId = null;
      
      try {
        const profileResponse = await axios.get(getApiUrl('/api/doctors/profile'), {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        // La respuesta tiene la estructura: { data: { id: ..., ... } }
        doctorId = profileResponse.data?.data?.id;
      } catch (error) {
        console.error('Error obteniendo perfil del doctor:', error);
        // Intentar obtener del localStorage como fallback
        doctorId = localStorage.getItem('selectedDoctorId');
      }
      
      if (!doctorId) {
        toast.error('No se pudo obtener el ID del doctor. Por favor, inicia sesión nuevamente.');
        return;
      }
      
      // Usar URL absoluta del API en producción (evita que la SPA intercepte y redirija a /dashboard/patients)
      const authUrl = getApiUrl(`/api/calendar-sync/auth/${provider}?doctorId=${doctorId}`);
      window.location.href = authUrl;
    } catch (error) {
      console.error(`Error connecting ${provider}:`, error);
      toast.error(`Error al conectar ${provider}`);
    }
  };

  const handleDisconnect = async (provider) => {
    if (!window.confirm(`¿Estás seguro de que quieres desconectar ${CALENDAR_SYNC_CONFIG[provider]?.name || provider}?`)) {
      return;
    }

    try {
      const response = await axios.post(getApiUrl(`/api/calendar-sync/disconnect/${provider}`), {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data?.success) {
        toast.success(`${CALENDAR_SYNC_CONFIG[provider]?.name || provider} desconectado exitosamente`);
        fetchSyncStatus();
      } else {
        toast.error(response.data?.message || 'Error al desconectar');
      }
    } catch (error) {
      console.error(`Error disconnecting ${provider}:`, error);
      toast.error(`Error al desconectar ${provider}`);
    }
  };

  const handleSync = async (provider) => {
    try {
      setSyncing(prev => ({ ...prev, [provider]: true }));
      const response = await axios.post(getApiUrl(`/api/calendar-sync/sync/${provider}`), {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data?.success) {
        toast.success(`${CALENDAR_SYNC_CONFIG[provider]?.name || provider} sincronizado exitosamente`);
        fetchSyncStatus();
      } else {
        toast.error(response.data?.message || 'Error al sincronizar');
      }
    } catch (error) {
      console.error(`Error syncing ${provider}:`, error);
      toast.error(`Error al sincronizar ${provider}`);
    } finally {
      setSyncing(prev => ({ ...prev, [provider]: false }));
    }
  };

  const formatLastSync = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Componente del logo de Apple
  const AppleLogo = () => (
    <svg 
      className="w-8 h-8" 
      viewBox="0 0 24 24" 
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.08-.4C1.79 15.25 4.23 5.95 9.03 5.88c1.11.07 2.01.67 3.01.67.95 0 2.09-.61 3.52-.55 1.5.05 2.76.9 3.49 2.12-3.06 1.85-2.57 5.66.54 7.01-.47 1.25-1.08 2.5-1.84 3.85zM12.03 5.78c-.15-2.23 1.66-4.1 3.74-4.41.43 2.54-1.95 4.97-3.74 4.41z"/>
    </svg>
  );

  const renderProviderCard = (provider) => {
    const config = CALENDAR_SYNC_CONFIG[provider];
    const status = syncStatus[provider];
    const isConnected = status?.connected || false;
    const isSyncing = syncing[provider] || false;

    if (!config) return null;

    return (
      <div key={provider} className="border rounded-lg p-4 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {provider === 'apple' ? (
              <div className="text-gray-900">
                <AppleLogo />
              </div>
            ) : (
              <span className="text-2xl">{config.icon}</span>
            )}
            <div>
              <h3 className="font-medium text-gray-900">{config.name}</h3>
              <p className="text-sm text-gray-500">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <CheckCircleIconSync className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIconSync className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        {isConnected && (
          <div className="mb-4 space-y-2">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Última actividad con Google:</span>{' '}
              {formatLastSync(status?.lastSync)}
              <span className="block text-xs text-gray-500 mt-0.5">
                Incluye citas enviadas al calendario, no solo importación masiva
              </span>
            </div>
            {status?.error && (
              <div className="text-sm text-red-600">
                <span className="font-medium">Error:</span> {status.error}
              </div>
            )}
          </div>
        )}

        <div className="flex space-x-2">
          {isConnected ? (
            <>
              <button
                onClick={() => handleSync(provider)}
                disabled={isSyncing}
                className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowPathIconSync className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button
                onClick={() => handleDisconnect(provider)}
                className="flex items-center justify-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                <TrashIconSync className="h-4 w-4 mr-2" />
                Desconectar
              </button>
            </>
          ) : (
            <button
              onClick={() => handleConnect(provider)}
              className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <LinkIconSync className="h-4 w-4 mr-2" />
              Conectar
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <ArrowPathIconSync className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Cargando estado de sincronización...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-2">
          Calendarios Externos
        </h2>
        <p className="text-sm text-gray-600">
          Conecta tus calendarios externos para sincronizar eventos automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderProviderCard('google')}
        {renderProviderCard('outlook')}
      </div>
    </div>
  );
};

// Estilos CSS para los toggles
const toggleStyles = `
  .toggle-checkbox:checked {
    right: 0;
    border-color: #3b82f6;
  }
  .toggle-checkbox:checked + .toggle-label {
    background-color: #3b82f6;
  }
  .toggle-label {
    transition: background-color 0.2s ease-in-out;
  }
`;

// Componente de carga optimizada para cada sección
const ConfigSection = ({ title, icon: Icon, children, isLoading, error }) => {
  if (isLoading) {
    return (
      <div className="bg-white shadow rounded-lg animate-pulse">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <div className="h-6 w-6 bg-gray-200 rounded mr-3"></div>
            <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg border border-red-200">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-500 mr-3" />
            <h3 className="text-lg leading-6 font-medium text-red-900">{title}</h3>
          </div>
          <div className="text-sm text-red-600">
            Error al cargar la configuración. 
            <button 
              onClick={() => window.location.reload()} 
              className="ml-2 text-red-800 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center mb-4">
          <Icon className="h-6 w-6 text-blue-600 mr-3" />
          <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  );
};

// Componente principal de configuración optimizada
const OptimizedCalendarConfig = () => {
  const [activeTab, setActiveTab] = useState('timezone');
  const [configData, setConfigData] = useState({
    timezone: { data: null, loading: false, error: null, loaded: false },
    linked: { data: null, loading: false, error: null, loaded: false },
    schedule: { data: null, loading: false, error: null, loaded: false },
    reminders: { data: null, loading: false, error: null, loaded: false },
    mercadopago: { data: null, loading: false, error: null, loaded: false },
  });
  const [overallLoading, setOverallLoading] = useState(false);

  // Tabs de configuración
  const configTabs = [
    { id: 'timezone', name: 'Zona horaria', icon: GlobeAmericasIcon, color: 'green' },
    { id: 'linked', name: 'Calendarios Vinculados', icon: LinkIcon, color: 'blue' },
    { id: 'schedule', name: 'Configuración de Horarios', icon: ClockIcon, color: 'purple' },
    { id: 'reminders', name: 'Configuración de Recordatorios', icon: BellIcon, color: 'orange' },
    { id: 'mercadopago', name: 'Cobros MP', icon: BanknotesIcon, color: 'sky' },
  ];

  // Cargar configuración de una sección específica
  const loadConfigSection = async (sectionId) => {
    if (configData[sectionId].loaded) return; // Ya cargado

    setConfigData(prev => ({
      ...prev,
      [sectionId]: { ...prev[sectionId], loading: true, error: null }
    }));

    try {
      let data = null;
      
      switch (sectionId) {
        case 'timezone':
          await new Promise(resolve => setTimeout(resolve, 50));
          data = { loaded: true };
          break;

        case 'linked':
          // Simular carga rápida para calendarios vinculados
          await new Promise(resolve => setTimeout(resolve, 100));
          data = { calendars: [] };
          break;
          
        case 'schedule':
          try {
            const scheduleResponse = await fetch(getApiUrl('/api/schedule/config'), {
              headers: getApiHeaders()
            });
            if (scheduleResponse.ok) {
              const responseData = await scheduleResponse.json();
              data = responseData.data || responseData || { 
                workingHours: [],
                availability: {},
                timeSlotDuration: 30
              };
            } else {
              // Si el endpoint no existe (404) o hay error, usar datos por defecto
              data = { 
                workingHours: [],
                availability: {},
                timeSlotDuration: 30,
                message: 'Configuración de horarios no disponible aún'
              };
            }
          } catch (err) {
            console.error('Error al cargar configuración de horarios:', err);
            data = { 
              workingHours: [],
              availability: {},
              timeSlotDuration: 30,
              message: 'Configuración de horarios no disponible aún'
            };
          }
          break;
          
        case 'reminders':
          try {
            const remindersResponse = await fetch(getApiUrl('/api/doctors/reminder-config'), {
              headers: getApiHeaders()
            });
            if (remindersResponse.ok) {
              const responseData = await remindersResponse.json();
              data = responseData.data || responseData || { 
                enabled: false,
                reminders: []
              };
            } else {
              // Si no hay configuración, usar datos por defecto
              data = { 
                enabled: false,
                reminders: []
              };
            }
          } catch (err) {
            console.error('Error al cargar configuración de recordatorios:', err);
            data = { 
              enabled: false,
              reminders: []
            };
          }
          break;

        case 'mercadopago':
          await new Promise(resolve => setTimeout(resolve, 50));
          data = { loaded: true };
          break;
      }

      setConfigData(prev => ({
        ...prev,
        [sectionId]: { 
          data, 
          loading: false, 
          error: null, 
          loaded: true 
        }
      }));

    } catch (error) {
      console.error(`Error loading ${sectionId} config:`, error);
      setConfigData(prev => ({
        ...prev,
        [sectionId]: { 
          data: null, 
          loading: false, 
          error: error.message, 
          loaded: false 
        }
      }));
    }
  };

  // Cargar configuración inicial cuando se cambia a la pestaña
  useEffect(() => {
    if (activeTab && !configData[activeTab].loaded && !configData[activeTab].loading) {
      loadConfigSection(activeTab);
    }
  }, [activeTab]);

  // Precargar la siguiente sección en segundo plano
  useEffect(() => {
    const currentIndex = configTabs.findIndex(tab => tab.id === activeTab);
    const nextTab = configTabs[(currentIndex + 1) % configTabs.length];
    
    if (nextTab && !configData[nextTab.id].loaded && !configData[nextTab.id].loading) {
      // Precargar en segundo plano después de un pequeño delay
      setTimeout(() => loadConfigSection(nextTab.id), 500);
    }
  }, [activeTab]);

  // Cargar todas las configuraciones en paralelo (para uso futuro)
  const loadAllConfigs = async () => {
    setOverallLoading(true);
    
    try {
      await Promise.allSettled([
        loadConfigSection('timezone'),
        loadConfigSection('linked'),
        loadConfigSection('schedule'),
        loadConfigSection('reminders')
      ]);
    } catch (error) {
      console.error('Error loading all configs:', error);
    } finally {
      setOverallLoading(false);
    }
  };

  // Renderizar contenido de cada sección
  const renderSectionContent = (sectionId) => {
    const section = configData[sectionId];
    
    if (!section.loaded) {
      return null; // Se renderizará cuando se cargue
    }

    switch (sectionId) {
      case 'timezone':
        return <TimezoneConfigSection />;

      case 'linked':
        return <CalendarSyncManager />;

      case 'schedule':
        return <CalendlyStyleScheduleConfig />;

      case 'reminders':
        return (
          <ReminderConfigSection
            data={section.data}
            onUpdate={(newData) => {
              setConfigData(prev => ({
                ...prev,
                reminders: {
                  ...prev.reminders,
                  data: newData
                }
              }));
            }}
          />
        );

      case 'mercadopago':
        return <MercadoPagoSettings compact />;

      default:
        return null;
    }
  };

  return (
    <>
      {/* Estilos CSS para los toggles */}
      <style dangerouslySetInnerHTML={{ __html: toggleStyles }} />
      
      <div className="space-y-6">
        {/* Header simplificado */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Configuración del Calendario</h2>
            <p className="text-gray-600 mt-1">Personaliza tu agenda y preferencias de citas</p>
          </div>
        </div>

        {/* Navegación por tabs - scroll horizontal en móvil */}
        <div className="border-b border-gray-200 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0 pb-px">
            {configTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const section = configData[tab.id];
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center flex-shrink-0 whitespace-nowrap ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.name}
                  {section.loaded && (
                    <CheckCircleIcon className="h-4 w-4 ml-2 text-green-500" />
                  )}
                  {section.loading && (
                    <div className="h-4 w-4 ml-2 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Contenido de la sección activa */}
        <ConfigSection
          title={configTabs.find(tab => tab.id === activeTab)?.name || ''}
          icon={configTabs.find(tab => tab.id === activeTab)?.icon || CogIcon}
          isLoading={configData[activeTab].loading}
          error={configData[activeTab].error}
        >
          {renderSectionContent(activeTab)}
        </ConfigSection>

        {/* Indicador de progreso general */}
        {overallLoading && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Cargando configuraciones...
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default OptimizedCalendarConfig;
