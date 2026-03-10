import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { 
  BellIcon, 
  ClockIcon, 
  EnvelopeIcon, 
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const EnhancedReminderConfig = () => {
  const [config, setConfig] = useState({
    enabled: false,
    emailReminders: true,
    smsReminders: false,
    pushNotifications: true,
    reminder24h: true,
    reminder4h: true,
    reminder1h: false,
    reminder30min: false,
    reminder15min: false,
    customReminders: [],
    timezone: 'America/Mexico_City',
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00'
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReminderConfig();
  }, []);

  const loadReminderConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/doctors/reminder-config', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        setConfig(response.data.data);
      }
    } catch (error) {
      console.error('Error loading reminder config:', error);
      // Usar configuración por defecto si no se puede cargar
    } finally {
      setLoading(false);
    }
  };

  const saveReminderConfig = async () => {
    try {
      setSaving(true);
      const response = await axios.post('/api/doctors/reminder-config', config, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        toast.success('Configuración de recordatorios guardada exitosamente');
      } else {
        toast.error('Error al guardar la configuración');
      }
    } catch (error) {
      console.error('Error saving reminder config:', error);
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleNestedConfigChange = (parentKey, childKey, value) => {
    setConfig(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value
      }
    }));
  };

  const addCustomReminder = () => {
    const newReminder = {
      id: Date.now(),
      time: '24:00',
      enabled: true,
      type: 'email'
    };
    setConfig(prev => ({
      ...prev,
      customReminders: [...prev.customReminders, newReminder]
    }));
  };

  const removeCustomReminder = (id) => {
    setConfig(prev => ({
      ...prev,
      customReminders: prev.customReminders.filter(r => r.id !== id)
    }));
  };

  const updateCustomReminder = (id, field, value) => {
    setConfig(prev => ({
      ...prev,
      customReminders: prev.customReminders.map(r => 
        r.id === id ? { ...r, [field]: value } : r
      )
    }));
  };

  const getReminderTimeText = (minutes) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours} hora${hours > 1 ? 's' : ''} antes`;
    }
    return `${minutes} minuto${minutes > 1 ? 's' : ''} antes`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-6">
        <BellIcon className="h-8 w-8 text-blue-600 mr-3" />
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Configuración de Recordatorios</h3>
          <p className="text-sm text-gray-500">Personaliza cómo y cuándo recibir notificaciones de citas</p>
        </div>
      </div>

      {/* Estado General */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-medium text-gray-900">Estado del Sistema</h4>
            <p className="text-sm text-gray-500">Activa o desactiva todos los recordatorios</p>
          </div>
          <button
            onClick={() => handleConfigChange('enabled', !config.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              config.enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Tipos de Notificación */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Tipos de Notificación</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.emailReminders}
              onChange={(e) => handleConfigChange('emailReminders', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="flex items-center">
              <EnvelopeIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">Email</span>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.smsReminders}
              onChange={(e) => handleConfigChange('smsReminders', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="flex items-center">
              <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">SMS</span>
            </div>
          </label>

          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={config.pushNotifications}
              onChange={(e) => handleConfigChange('pushNotifications', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <div className="flex items-center">
              <BellIcon className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-700">Notificaciones Push</span>
            </div>
          </label>
        </div>
      </div>

      {/* Recordatorios Estándar */}
      <div className="mb-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Recordatorios Estándar</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'reminder24h', time: 1440, label: '24 horas antes' },
            { key: 'reminder4h', time: 240, label: '4 horas antes' },
            { key: 'reminder1h', time: 60, label: '1 hora antes' },
            { key: 'reminder30min', time: 30, label: '30 minutos antes' },
            { key: 'reminder15min', time: 15, label: '15 minutos antes' }
          ].map((reminder) => (
            <label key={reminder.key} className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={config[reminder.key]}
                onChange={(e) => handleConfigChange(reminder.key, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <div className="flex items-center">
                <ClockIcon className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-700">{reminder.label}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Recordatorios Personalizados */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-gray-900">Recordatorios Personalizados</h4>
          <button
            onClick={addCustomReminder}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Agregar Recordatorio
          </button>
        </div>
        
        {config.customReminders.length > 0 && (
          <div className="space-y-3">
            {config.customReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={reminder.enabled}
                  onChange={(e) => updateCustomReminder(reminder.id, 'enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <input
                  type="time"
                  value={reminder.time}
                  onChange={(e) => updateCustomReminder(reminder.id, 'time', e.target.value)}
                  className="border-gray-300 rounded-md text-sm"
                />
                <select
                  value={reminder.type}
                  onChange={(e) => updateCustomReminder(reminder.id, 'type', e.target.value)}
                  className="border-gray-300 rounded-md text-sm"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                </select>
                <button
                  onClick={() => removeCustomReminder(reminder.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Horas Silenciosas */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-lg font-medium text-gray-900">Horas Silenciosas</h4>
            <p className="text-sm text-gray-500">No enviar notificaciones durante estas horas</p>
          </div>
          <button
            onClick={() => handleNestedConfigChange('quietHours', 'enabled', !config.quietHours.enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              config.quietHours.enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                config.quietHours.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        
        {config.quietHours.enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
              <input
                type="time"
                value={config.quietHours.start}
                onChange={(e) => handleNestedConfigChange('quietHours', 'start', e.target.value)}
                className="border-gray-300 rounded-md w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input
                type="time"
                value={config.quietHours.end}
                onChange={(e) => handleNestedConfigChange('quietHours', 'end', e.target.value)}
                className="border-gray-300 rounded-md w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Zona Horaria */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Zona Horaria</label>
        <select
          value={config.timezone}
          onChange={(e) => handleConfigChange('timezone', e.target.value)}
          className="border-gray-300 rounded-md w-full md:w-64"
        >
          <option value="America/Mexico_City">Ciudad de México (GMT-6)</option>
          <option value="America/Monterrey">Monterrey (GMT-6)</option>
          <option value="America/Tijuana">Tijuana (GMT-8)</option>
          <option value="America/Merida">Mérida (GMT-6)</option>
          <option value="America/Chihuahua">Chihuahua (GMT-7)</option>
        </select>
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={loadReminderConfig}
          disabled={loading}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Restaurar
        </button>
        <button
          onClick={saveReminderConfig}
          disabled={saving || !config.enabled}
          className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>

      {/* Estado del Sistema */}
      {config.enabled && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Sistema de Recordatorios Activo
              </p>
              <p className="text-sm text-green-700">
                Los pacientes recibirán notificaciones según tu configuración
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedReminderConfig;
