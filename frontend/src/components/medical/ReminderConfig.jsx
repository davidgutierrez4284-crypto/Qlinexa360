import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

const ReminderConfig = () => {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reminder24h, setReminder24h] = useState(false);
  const [reminder4h, setReminder4h] = useState(false);

  useEffect(() => {
    // Futuro: leer preferencia desde API por doctor
  }, []);

  const startCron = async () => {
    // Verificar que al menos un tipo de recordatorio esté seleccionado
    if (!reminder24h && !reminder4h) {
      toast.error('Debes seleccionar al menos un tipo de recordatorio');
      return;
    }

    try {
      setLoading(true);
      
      // Timeout de seguridad para evitar que se quede "trabado"
      const timeoutId = setTimeout(() => {
        setLoading(false);
        toast.error('Tiempo de espera agotado. Intenta nuevamente.');
      }, 10000); // 10 segundos máximo
      
      const res = await fetch('/api/notifications/reminders/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          enabled: true,
          reminder24h,
          reminder4h
        })
      });
      
      clearTimeout(timeoutId); // Limpiar timeout si la respuesta llega a tiempo
      
      if (res.ok) {
        setEnabled(true);
        toast.success('Recordatorios activados');
      } else {
        toast.error('No se pudieron activar');
      }
    } catch (e) {
      console.error('Error al activar recordatorios:', e);
      toast.error('Error al activar');
    } finally {
      setLoading(false);
    }
  };

  const stopCron = async () => {
    try {
      setLoading(true);
      
      // Timeout de seguridad para evitar que se quede "trabado"
      const timeoutId = setTimeout(() => {
        setLoading(false);
        toast.error('Tiempo de espera agotado. Intenta nuevamente.');
      }, 10000); // 10 segundos máximo
      
      const res = await fetch('/api/notifications/reminders/stop', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({
          enabled: false
        })
      });
      
      clearTimeout(timeoutId); // Limpiar timeout si la respuesta llega a tiempo
      
      if (res.ok) {
        setEnabled(false);
        setReminder24h(false);
        setReminder4h(false);
        toast.success('Recordatorios desactivados');
      } else {
        toast.error('No se pudieron desactivar');
      }
    } catch (e) {
      console.error('Error al desactivar recordatorios:', e);
      toast.error('Error al desactivar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Recordatorios de Citas</h3>
      <p className="text-sm text-gray-600 mb-4">Activa recordatorios automáticos por email</p>

      {/* Estado del sistema */}
      <div className="flex items-center gap-3 mb-6">
        <span className={`px-3 py-2 text-sm font-medium rounded-full ${
          enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
        }`}>
          {enabled ? '✅ Activado' : '❌ Desactivado'}
        </span>
        
        {enabled ? (
          <button 
            onClick={stopCron} 
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '⏳ Desactivando...' : '🛑 Desactivar'}
          </button>
        ) : (
          <button 
            onClick={startCron} 
            disabled={loading || (!reminder24h && !reminder4h)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? '⏳ Activando...' : '🚀 Activar'}
          </button>
        )}
      </div>

      {/* Selección de tipos de recordatorios */}
      <div className="mb-6">
        <h4 className="font-medium text-gray-900 mb-3">Tipos de recordatorios:</h4>
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reminder24h}
              onChange={(e) => setReminder24h(e.target.checked)}
              disabled={enabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">24 horas antes de la cita</span>
          </label>
          
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={reminder4h}
              onChange={(e) => setReminder4h(e.target.checked)}
              disabled={enabled}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="text-sm text-gray-700">4 horas antes de la cita</span>
          </label>
        </div>
        
        {enabled && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              <strong>Estado actual:</strong> 
              {reminder24h && reminder4h && ' Enviando ambos recordatorios'}
              {reminder24h && !reminder4h && ' Enviando solo recordatorio de 24h'}
              {!reminder24h && reminder4h && ' Enviando solo recordatorio de 4h'}
            </p>
          </div>
        )}
      </div>

      {/* Información de cómo funciona */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="font-medium text-blue-800 mb-3">¿Cómo funcionan los recordatorios?</h4>
        <p className="text-sm text-blue-700 mb-3">
          <strong>Ejemplo:</strong> Si tu paciente tiene cita a las 12:00 PM (medio día):
        </p>
        <ul className="text-sm text-blue-700 space-y-2 mb-3">
          <li className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">•</span>
            <span><strong>24 horas antes:</strong> Recibe recordatorio a las 12:00 PM del día anterior</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">•</span>
            <span><strong>4 horas antes:</strong> Recibe recordatorio a las 8:00 AM del día de la cita</span>
          </li>
        </ul>
        
        <div className="p-3 bg-white rounded border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>💡 Configuración:</strong> Selecciona los tipos de recordatorios que deseas enviar. 
            Una vez activado, el sistema enviará automáticamente los recordatorios seleccionados por email 
            a todos los pacientes con citas programadas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReminderConfig;