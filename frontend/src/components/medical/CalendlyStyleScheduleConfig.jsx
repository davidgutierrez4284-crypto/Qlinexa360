import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getApiUrl, getApiHeaders } from '../../utils/api';
import { 
  ClockIcon, 
  PlusIcon, 
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  CalendarDaysIcon
} from '@heroicons/react/24/outline';

const CalendlyStyleScheduleConfig = () => {
  const [config, setConfig] = useState({
    appointmentDuration: 30,
    bufferTime: 15,
    weeklySchedule: {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: []
    }
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const days = [
    { key: 'monday', label: 'Lunes', short: 'L', full: 'Mon' },
    { key: 'tuesday', label: 'Martes', short: 'M', full: 'Tue' },
    { key: 'wednesday', label: 'Miércoles', short: 'X', full: 'Wed' },
    { key: 'thursday', label: 'Jueves', short: 'J', full: 'Thu' },
    { key: 'friday', label: 'Viernes', short: 'V', full: 'Fri' },
    { key: 'saturday', label: 'Sábado', short: 'S', full: 'Sat' },
    { key: 'sunday', label: 'Domingo', short: 'D', full: 'Sun' }
  ];

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/schedule/config'), {
        headers: getApiHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const oldSchedule = data.data.weeklySchedule || {};
          const newSchedule = {};
          
          days.forEach(({ key }) => {
            const dayData = oldSchedule[key];
            if (Array.isArray(dayData)) {
              // Formato: array de rangos { startTime, endTime }
              newSchedule[key] = dayData.map(slot => ({
                startTime: slot.startTime || '09:00',
                endTime: slot.endTime || '17:00'
              }));
            } else if (dayData && typeof dayData === 'object' && 'timeSlots' in dayData) {
              // Convertir formato con timeSlots a rangos
              const timeSlots = dayData.timeSlots || [];
              const ranges = [];
              let currentRange = null;
              
              timeSlots
                .filter(s => s.available)
                .sort((a, b) => a.time.localeCompare(b.time))
                .forEach(slot => {
                  if (!currentRange) {
                    currentRange = { startTime: slot.time, endTime: slot.time };
                  } else {
                    // Verificar si es continuo (30 min después)
                    const currentEnd = new Date(`2000-01-01T${currentRange.endTime}`);
                    const nextTime = new Date(`2000-01-01T${slot.time}`);
                    const diffMinutes = (nextTime - currentEnd) / 60000;
                    
                    if (diffMinutes === 30) {
                      currentRange.endTime = slot.time;
                    } else {
                      ranges.push(currentRange);
                      currentRange = { startTime: slot.time, endTime: slot.time };
                    }
                  }
                });
              
              if (currentRange) {
                // Agregar 30 minutos al endTime para completar el rango
                const endTime = new Date(`2000-01-01T${currentRange.endTime}`);
                endTime.setMinutes(endTime.getMinutes() + 30);
                currentRange.endTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                ranges.push(currentRange);
              }
              
              newSchedule[key] = ranges.length > 0 ? ranges : [];
            } else {
              newSchedule[key] = [];
            }
          });

          setConfig({
            appointmentDuration: data.data.appointmentDuration ?? 30,
            bufferTime: data.data.bufferTime ?? 15,
            weeklySchedule: newSchedule
          });
        }
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch(getApiUrl('/api/schedule/config'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders()
        },
        body: JSON.stringify(config)
      });

      // Verificar si la respuesta es JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Respuesta no es JSON:', text.substring(0, 500));
        console.error('Status:', response.status, response.statusText);
        console.error('URL:', response.url);
        
        // Si es un error 404, probablemente la ruta no existe
        if (response.status === 404) {
          throw new Error('Ruta no encontrada. Verifica que el backend esté corriendo y la ruta /api/schedule/config exista.');
        }
        
        throw new Error(`Error del servidor (${response.status}): El servidor devolvió HTML en lugar de JSON. Verifica que el backend esté corriendo en el puerto 3000.`);
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
      }
      
      if (data.success) {
        toast.success('✅ Configuración de horarios guardada correctamente');
      } else {
        throw new Error(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      if (error.message.includes('JSON')) {
        toast.error('Error de conexión con el servidor. Verifica que el backend esté corriendo.');
      } else {
        toast.error(error.message || 'Error al guardar configuración');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleDayEnabled = (day) => {
    const dayRanges = config.weeklySchedule[day] || [];
    const isEnabled = dayRanges.length > 0;
    
    if (isEnabled) {
      // Deshabilitar día - eliminar todos los rangos
      setConfig(prev => ({
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: []
        }
      }));
    } else {
      // Habilitar día - agregar un rango por defecto
      setConfig(prev => ({
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: [
            { startTime: '09:00', endTime: '17:00' }
          ]
        }
      }));
    }
  };

  const addTimeRange = (day) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: [
          ...(prev.weeklySchedule[day] || []),
          { startTime: '09:00', endTime: '17:00' }
        ]
      }
    }));
  };

  const removeTimeRange = (day, index) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: prev.weeklySchedule[day].filter((_, i) => i !== index)
      }
    }));
  };

  const duplicateTimeRange = (day, index) => {
    const dayRanges = config.weeklySchedule[day] || [];
    const rangeToDuplicate = dayRanges[index];
    
    if (rangeToDuplicate) {
      setConfig(prev => ({
        ...prev,
        weeklySchedule: {
          ...prev.weeklySchedule,
          [day]: [
            ...prev.weeklySchedule[day].slice(0, index + 1),
            { ...rangeToDuplicate },
            ...prev.weeklySchedule[day].slice(index + 1)
          ]
        }
      }));
    }
  };

  const updateTimeRange = (day, index, field, value) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: prev.weeklySchedule[day].map((range, i) =>
          i === index ? { ...range, [field]: value } : range
        )
      }
    }));
  };

  const isDayEnabled = (day) => {
    const dayRanges = config.weeklySchedule[day] || [];
    return dayRanges.length > 0;
  };

  const formatTimeForDisplay = (time) => {
    // Convertir formato 24h a 12h con AM/PM
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuración General */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <ClockIcon className="h-5 w-5 mr-2 text-blue-600" />
          Configuración General
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración de cita (minutos)
            </label>
            <select
              value={config.appointmentDuration}
              onChange={(e) => setConfig(prev => ({ ...prev, appointmentDuration: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">60 minutos</option>
              <option value="90">90 minutos</option>
              <option value="120">120 minutos</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiempo de buffer entre citas (minutos)
            </label>
            <select
              value={config.bufferTime}
              onChange={(e) => setConfig(prev => ({ ...prev, bufferTime: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="0">Sin buffer</option>
              <option value="5">5 minutos</option>
              <option value="10">10 minutos</option>
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Horarios Semanales - Estilo Calendly */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-blue-600" />
            Horarios Disponibles
          </h3>
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <CheckIcon className="h-4 w-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>
        </div>

        {/* Selector de días - Estilo Google Calendar */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Disponibilidad
          </label>
          <p className="text-xs text-gray-500 mb-4">
            Configura cuándo estás disponible para citas. El calendario evitará conflictos en el mismo calendario.
          </p>
          
          {/* Botones circulares de días - scroll horizontal en móvil */}
          <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-1">
            {days.map(({ key, short }) => {
              const isEnabled = isDayEnabled(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleDayEnabled(key)}
                  className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-medium text-sm transition-all ${
                    isEnabled
                      ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                  }`}
                  title={days.find(d => d.key === key)?.label}
                >
                  {short}
                </button>
              );
            })}
          </div>

          {/* Lista de días seleccionados con rangos de horarios */}
          <div className="space-y-3">
            {days
              .filter(({ key }) => isDayEnabled(key))
              .map(({ key, full, label }) => {
                const dayRanges = config.weeklySchedule[key] || [];
                
                return (
                  <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900">{full}</span>
                      <button
                        onClick={() => addTimeRange(key)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="Agregar otro rango de horarios"
                      >
                        <PlusIcon className="h-5 w-5" />
                      </button>
                    </div>
                    
                    {dayRanges.length === 0 ? (
                      <div className="text-center py-2">
                        <button
                          onClick={() => addTimeRange(key)}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Agregar horario
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayRanges.map((range, index) => (
                          <div
                            key={index}
                            className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2 bg-gray-50 rounded-md"
                          >
                            <input
                              type="time"
                              value={range.startTime}
                              onChange={(e) => updateTimeRange(key, index, 'startTime', e.target.value)}
                              className="flex-shrink-0 min-w-0 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-gray-500 font-medium flex-shrink-0">a</span>
                            <input
                              type="time"
                              value={range.endTime}
                              onChange={(e) => updateTimeRange(key, index, 'endTime', e.target.value)}
                              className="flex-shrink-0 min-w-0 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                              onClick={() => duplicateTimeRange(key, index)}
                              className="flex-shrink-0 p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                              title="Duplicar este rango"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            {dayRanges.length > 1 && (
                              <button
                                onClick={() => removeTimeRange(key, index)}
                                className="flex-shrink-0 p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Eliminar este rango"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          
          {days.filter(({ key }) => isDayEnabled(key)).length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Selecciona al menos un día de la semana</p>
            </div>
          )}
        </div>

        {/* Información adicional */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>💡 Tip:</strong> Activa los días de la semana en los que estás disponible. 
            Puedes agregar múltiples bloques de horarios por día (por ejemplo, mañana y tarde).
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalendlyStyleScheduleConfig;

