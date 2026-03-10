import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FaGoogle, FaMicrosoft, FaSync, FaTrash, FaPlus } from 'react-icons/fa';

const ExternalCalendarConfig = () => {
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState({});

  useEffect(() => {
    fetchCalendars();
    
    // Verificar parámetros de URL para mostrar mensajes de éxito/error
    const urlParams = new URLSearchParams(window.location.search);
    const calendarSuccess = urlParams.get('calendar_success');
    const calendarError = urlParams.get('calendar_error');
    
    if (calendarSuccess) {
      if (calendarSuccess === 'google_connected') {
        toast.success('Google Calendar conectado exitosamente');
      } else if (calendarSuccess === 'outlook_connected') {
        toast.success('Outlook Calendar conectado exitosamente');
      }
      // Limpiar parámetros de URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (calendarError) {
      let errorMessage = 'Error al conectar calendario';
      if (calendarError === 'access_denied') {
        errorMessage = 'Acceso denegado. Inténtalo de nuevo.';
      } else if (calendarError === 'invalid_request') {
        errorMessage = 'Solicitud inválida. Inténtalo de nuevo.';
      } else if (calendarError === 'server_error') {
        errorMessage = 'Error del servidor. Inténtalo más tarde.';
      }
      toast.error(errorMessage);
      // Limpiar parámetros de URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchCalendars = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/external-calendars', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCalendars(data.data || []);
      } else {
        toast.error('Error al cargar calendarios externos');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/external-calendars/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Redirigir a la URL de autorización de Google
        window.location.href = data.data.authUrl;
      } else {
        toast.error('Error al conectar Google Calendar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const connectOutlookCalendar = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/external-calendars/outlook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Redirigir a la URL de autorización de Outlook
        window.location.href = data.data.authUrl;
      } else {
        toast.error('Error al conectar Outlook Calendar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const disconnectCalendar = async (calendarId) => {
    try {
      const response = await fetch(`/api/external-calendars/${calendarId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        toast.success('Calendario desconectado exitosamente');
        fetchCalendars();
      } else {
        toast.error('Error al desconectar calendario');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    }
  };

  const syncCalendar = async (calendarId) => {
    try {
      setSyncing(prev => ({ ...prev, [calendarId]: true }));
      
      const response = await fetch(`/api/external-calendars/${calendarId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Sincronización completada: ${data.data.eventsAdded} eventos agregados`);
      } else {
        toast.error('Error en la sincronización');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error de conexión');
    } finally {
      setSyncing(prev => ({ ...prev, [calendarId]: false }));
    }
  };

  const getCalendarIcon = (type) => {
    return type === 'GOOGLE' ? <FaGoogle className="text-red-500" /> : <FaMicrosoft className="text-blue-500" />;
  };

  const getCalendarName = (type) => {
    return type === 'GOOGLE' ? 'Google Calendar' : 'Outlook Calendar';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-6">Calendarios Externos</h3>
      
      {/* Botones de conexión */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={connectGoogleCalendar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
        >
          <FaGoogle />
          Conectar Google Calendar
        </button>
        
        <button
          onClick={connectOutlookCalendar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          <FaMicrosoft />
          Conectar Outlook Calendar
        </button>
      </div>

      {/* Lista de calendarios conectados */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando calendarios...</p>
        </div>
      ) : calendars.length === 0 ? (
        <div className="text-center py-8">
          <FaPlus className="text-gray-400 text-4xl mx-auto mb-4" />
          <p className="text-gray-600">No hay calendarios conectados</p>
          <p className="text-sm text-gray-500 mt-2">
            Conecta tu Google Calendar o Outlook para sincronizar eventos
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {calendars.map((calendar) => (
            <div key={calendar.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getCalendarIcon(calendar.tipoConexion)}
                  <div>
                    <h4 className="font-medium">
                      {getCalendarName(calendar.tipoConexion)}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Conectado el {new Date(calendar.fechaVinculacion).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => syncCalendar(calendar.id)}
                    disabled={syncing[calendar.id]}
                    className="flex items-center gap-1 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                  >
                    <FaSync className={syncing[calendar.id] ? 'animate-spin' : ''} />
                    {syncing[calendar.id] ? 'Sincronizando...' : 'Sincronizar'}
                  </button>
                  
                  <button
                    onClick={() => disconnectCalendar(calendar.id)}
                    className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                  >
                    <FaTrash />
                    Desconectar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Información adicional */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">¿Cómo funciona?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Los eventos de tus calendarios externos se sincronizan automáticamente</li>
          <li>• Las citas agendadas desde el link público se crean en tus calendarios</li>
          <li>• Los horarios ocupados en calendarios externos se bloquean automáticamente</li>
          <li>• Puedes sincronizar manualmente en cualquier momento</li>
        </ul>
      </div>
    </div>
  );
};

export default ExternalCalendarConfig; 