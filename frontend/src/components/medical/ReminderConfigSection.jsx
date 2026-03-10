import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getApiUrl, getApiHeaders } from '../../utils/api';

const ReminderConfigSection = ({ data, onUpdate }) => {
  const [reminderState, setReminderState] = useState({
    enabled: data?.enabled || false,
    reminder1Week: data?.reminder1Week || false,
    reminder48h: data?.reminder48h || false,
    reminder24h: data?.reminder24h || false,
    reminder4h: data?.reminder4h || false,
    loading: false
  });

  // Actualizar estado cuando cambian los datos
  useEffect(() => {
    if (data) {
      setReminderState(prev => ({
        ...prev,
        enabled: data.enabled || false,
        reminder1Week: data.reminder1Week || false,
        reminder48h: data.reminder48h || false,
        reminder24h: data.reminder24h || false,
        reminder4h: data.reminder4h || false
      }));
    }
  }, [data]);

  const handleToggleEnabled = async () => {
    if (reminderState.loading) return;
    
    setReminderState(prev => ({ ...prev, loading: true }));
    
    try {
      const newEnabled = !reminderState.enabled;
      const response = await fetch(getApiUrl('/api/doctors/reminder-config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders()
        },
        body: JSON.stringify({
          enabled: newEnabled,
          reminder1Week: reminderState.reminder1Week,
          reminder48h: reminderState.reminder48h,
          reminder24h: reminderState.reminder24h,
          reminder4h: reminderState.reminder4h
        })
      });

      let responseData = null;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        }
      } catch (parseErr) {
        console.error('Error parseando respuesta:', parseErr);
      }

      if (response.ok && responseData?.success) {
        const newData = responseData.data;
        const wasEnabled = reminderState.enabled;
        const nowEnabled = newData.enabled || false;

        setReminderState({
          enabled: nowEnabled,
          reminder1Week: newData.reminder1Week || false,
          reminder48h: newData.reminder48h || false,
          reminder24h: newData.reminder24h || false,
          reminder4h: newData.reminder4h || false,
          loading: false
        });

        if (onUpdate) {
          onUpdate(newData);
        }

        // Mostrar mensaje correcto basado en el cambio real
        if (nowEnabled && !wasEnabled) {
          toast.success('✅ Recordatorios activados correctamente');
        } else if (!nowEnabled && wasEnabled) {
          toast.success('Recordatorios desactivados');
        } else {
          toast.info(nowEnabled ? 'Configuración actualizada' : 'Configuración actualizada');
        }
      } else {
        const errorMsg = responseData?.error || (response.status === 404 ? 'Servicio no disponible. Verifica la conexión.' : 'Error al actualizar configuración');
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error al actualizar configuración de recordatorios:', error);
      toast.error(error.message || 'Error al actualizar configuración');
      setReminderState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleReminderChange = (reminderKey, value) => {
    const newState = {
      ...reminderState,
      [reminderKey]: value
    };
    setReminderState(newState);
    
    // Guardar automáticamente después de 500ms (debounce)
    setTimeout(async () => {
      try {
        const response = await fetch(getApiUrl('/api/doctors/reminder-config'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getApiHeaders()
          },
          body: JSON.stringify({
            enabled: newState.enabled,
            reminder1Week: newState.reminder1Week,
            reminder48h: newState.reminder48h,
            reminder24h: newState.reminder24h,
            reminder4h: newState.reminder4h
          })
        });

        const contentType = response.headers.get('content-type');
        const isJson = contentType && contentType.includes('application/json');
        const responseData = isJson ? await response.json() : null;

        if (response.ok && responseData?.success && onUpdate) {
          onUpdate(responseData.data);
        } else if (!response.ok) {
          toast.error(responseData?.error || 'Error al guardar configuración');
        }
      } catch (error) {
        console.error('Error al guardar recordatorio:', error);
        toast.error(error.message || 'Error al guardar configuración');
      }
    }, 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Sistema de recordatorios</span>
        <div className="flex items-center">
          <span className={`mr-2 text-sm ${reminderState.enabled ? 'text-green-600' : 'text-gray-500'}`}>
            {reminderState.enabled ? 'Activado' : 'Desactivado'}
          </span>
          <button
            onClick={handleToggleEnabled}
            disabled={reminderState.loading}
            type="button"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              reminderState.enabled ? 'bg-blue-600' : 'bg-gray-300'
            } ${reminderState.loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {reminderState.loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </span>
            )}
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                reminderState.enabled ? 'translate-x-6' : 'translate-x-1'
              } ${reminderState.loading ? 'opacity-0' : 'opacity-100'}`}
            />
          </button>
        </div>
      </div>

      {reminderState.enabled && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md mb-4">
          <p className="text-sm text-green-700">
            ✅ El sistema de recordatorios está activado
          </p>
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={reminderState.reminder1Week}
            onChange={(e) => handleReminderChange('reminder1Week', e.target.checked)}
            disabled={!reminderState.enabled}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm font-medium ${reminderState.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
            Recordatorio 1 semana antes
          </span>
        </label>

        <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={reminderState.reminder48h}
            onChange={(e) => handleReminderChange('reminder48h', e.target.checked)}
            disabled={!reminderState.enabled}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm font-medium ${reminderState.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
            Recordatorio 48 horas antes
          </span>
        </label>

        <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={reminderState.reminder24h}
            onChange={(e) => handleReminderChange('reminder24h', e.target.checked)}
            disabled={!reminderState.enabled}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm font-medium ${reminderState.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
            Recordatorio 24 horas antes
          </span>
        </label>

        <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={reminderState.reminder4h}
            onChange={(e) => handleReminderChange('reminder4h', e.target.checked)}
            disabled={!reminderState.enabled}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className={`text-sm font-medium ${reminderState.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
            Recordatorio 4 horas antes
          </span>
        </label>
      </div>

      {!reminderState.enabled && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            ⚠️ Activa el sistema de recordatorios para configurar los recordatorios individuales
          </p>
        </div>
      )}
    </div>
  );
};

export default ReminderConfigSection;

