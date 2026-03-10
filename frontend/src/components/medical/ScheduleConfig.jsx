import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const ScheduleConfig = () => {
  const [config, setConfig] = useState({
    blockWeekends: true,
    appointmentDuration: 30,
    bufferTime: 15,
    weeklySchedule: {
      monday: [
        { startTime: "09:00", endTime: "12:00", isAvailable: true },
        { startTime: "14:00", endTime: "18:00", isAvailable: true }
      ],
      tuesday: [
        { startTime: "09:00", endTime: "12:00", isAvailable: true },
        { startTime: "14:00", endTime: "18:00", isAvailable: true }
      ],
      wednesday: [
        { startTime: "09:00", endTime: "12:00", isAvailable: true },
        { startTime: "14:00", endTime: "18:00", isAvailable: true }
      ],
      thursday: [
        { startTime: "09:00", endTime: "12:00", isAvailable: true },
        { startTime: "14:00", endTime: "18:00", isAvailable: true }
      ],
      friday: [
        { startTime: "09:00", endTime: "12:00", isAvailable: true },
        { startTime: "14:00", endTime: "18:00", isAvailable: true }
      ],
      saturday: [],
      sunday: []
    }
  });

  const [loading, setLoading] = useState(false);

  const days = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
  ];

  const addTimeSlot = (day) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: [
          ...prev.weeklySchedule[day],
          { startTime: "09:00", endTime: "10:00", isAvailable: true }
        ]
      }
    }));
  };

  const removeTimeSlot = (day, index) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: prev.weeklySchedule[day].filter((_, i) => i !== index)
      }
    }));
  };

  const updateTimeSlot = (day, index, field, value) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: prev.weeklySchedule[day].map((slot, i) => 
          i === index ? { ...slot, [field]: value } : slot
        )
      }
    }));
  };

  const toggleDayAvailability = (day) => {
    setConfig(prev => ({
      ...prev,
      weeklySchedule: {
        ...prev.weeklySchedule,
        [day]: prev.weeklySchedule[day].map(slot => ({
          ...slot,
          isAvailable: !slot.isAvailable
        }))
      }
    }));
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/schedule/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Configuración de horarios guardada');
      } else {
        toast.error('Error al guardar configuración');
      }
    } catch (error) {
      toast.error('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-6">Configuración de Horarios</h3>
      
      {/* Configuración general */}
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-4">Configuración General</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Duración de cita (minutos)
            </label>
            <input
              type="number"
              value={config.appointmentDuration}
              onChange={(e) => setConfig(prev => ({ ...prev, appointmentDuration: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="15"
              max="120"
              step="15"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiempo entre citas (minutos)
            </label>
            <input
              type="number"
              value={config.bufferTime}
              onChange={(e) => setConfig(prev => ({ ...prev, bufferTime: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="60"
              step="5"
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="blockWeekends"
              checked={config.blockWeekends}
              onChange={(e) => setConfig(prev => ({ ...prev, blockWeekends: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="blockWeekends" className="ml-2 block text-sm text-gray-900">
              Bloquear fines de semana
            </label>
          </div>
        </div>
      </div>

      {/* Horarios semanales */}
      <div className="mb-6">
        <h4 className="text-lg font-medium mb-4">Horarios Semanales</h4>
        
        <div className="space-y-4">
          {days.map(({ key, label }) => (
            <div key={key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium">{label}</h5>
                <button
                  onClick={() => addTimeSlot(key)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Agregar horario
                </button>
              </div>
              
              {config.weeklySchedule[key].length === 0 ? (
                <p className="text-gray-500 text-sm">No hay horarios configurados</p>
              ) : (
                <div className="space-y-2">
                  {config.weeklySchedule[key].map((slot, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={slot.isAvailable}
                        onChange={() => updateTimeSlot(key, index, 'isAvailable', !slot.isAvailable)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => updateTimeSlot(key, index, 'startTime', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      
                      <span className="text-gray-500">a</span>
                      
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => updateTimeSlot(key, index, 'endTime', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      
                      <button
                        onClick={() => removeTimeSlot(key, index)}
                        className="px-2 py-1 text-sm text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <button
          onClick={saveConfig}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
};

export default ScheduleConfig; 