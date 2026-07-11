import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl } from '../../utils/api';
import { CALENDAR_SYNC_CONFIG } from '../../config/calendarSync';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  LinkIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

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
      const response = await axios.get('/api/calendar-sync/sync-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
      // Obtener doctorId y usar URL absoluta del API (evita redirección incorrecta a /dashboard/patients en producción)
      let doctorId = null;
      try {
        const profileResponse = await axios.get('/api/doctors/profile', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        doctorId = profileResponse.data?.data?.id;
      } catch (e) {
        doctorId = localStorage.getItem('selectedDoctorId');
      }
      if (!doctorId) {
        toast.error('No se pudo obtener el ID del doctor. Inicia sesión nuevamente.');
        return;
      }
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
      const response = await axios.post(`/api/calendar-sync/disconnect/${provider}`, {}, {
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
      const response = await axios.post(`/api/calendar-sync/sync/${provider}`, {}, {
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
            <span className="text-2xl">{config.icon}</span>
            <div>
              <h3 className="font-medium text-gray-900">{config.name}</h3>
              <p className="text-sm text-gray-500">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 text-gray-400" />
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
                <ArrowPathIcon className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
              </button>
              <button
                onClick={() => handleDisconnect(provider)}
                className="flex items-center justify-center px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Desconectar
              </button>
            </>
          ) : (
            <button
              onClick={() => handleConnect(provider)}
              className="flex-1 flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <LinkIcon className="h-4 w-4 mr-2" />
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
        <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-400" />
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

export default CalendarSyncManager;
