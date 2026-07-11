import React, { useState, useEffect } from 'react';
import { 
  ClockIcon, 
  UserIcon, 
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';
import Loader from '../common/Loader';

const WaitlistManager = () => {
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableSlots, setAvailableSlots] = useState({});
  const [selectedDates, setSelectedDates] = useState({});
  const [selectedSlots, setSelectedSlots] = useState({});
  const [loadingSlots, setLoadingSlots] = useState({});

  useEffect(() => {
    fetchWaitlist();
  }, []);

  const fetchWaitlist = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await axios.get('/api/appointment-confirmation/waitlist', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 segundos timeout
      });
      
      if (response.data.success) {
        setWaitlistEntries(response.data.data || []);
      } else {
        throw new Error(response.data.error || 'Error al cargar lista de espera');
      }
    } catch (error) {
      console.error('Error al cargar lista de espera:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      const errorMessage = error.response?.data?.error || 
                           error.response?.data?.message || 
                           error.message || 
                           'Error al cargar lista de espera';
      
      toast.error(errorMessage);
      setWaitlistEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (entryId, date) => {
    try {
      setLoadingSlots(prev => ({ ...prev, [entryId]: true }));
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No hay token de autenticación');

      const response = await axios.get('/api/appointment-confirmation/waitlist/available-slots', {
        params: { date },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      if (response.data.success) {
        setAvailableSlots(prev => ({ ...prev, [entryId]: response.data.data || [] }));
      } else {
        throw new Error(response.data.error || 'Error al cargar horarios disponibles');
      }
    } catch (error) {
      console.error('Error al cargar horarios disponibles:', error);
      toast.error(error.response?.data?.error || 'Error al cargar horarios disponibles');
      setAvailableSlots(prev => ({ ...prev, [entryId]: [] }));
    } finally {
      setLoadingSlots(prev => ({ ...prev, [entryId]: false }));
    }
  };

  const handleDateChange = (entryId, date) => {
    setSelectedDates(prev => ({ ...prev, [entryId]: date }));
    setSelectedSlots(prev => ({ ...prev, [entryId]: null }));
    if (date) {
      fetchAvailableSlots(entryId, date);
    } else {
      setAvailableSlots(prev => ({ ...prev, [entryId]: [] }));
    }
  };

  const assignToSlot = async (waitlistEntryId) => {
    try {
      const selectedSlot = selectedSlots[waitlistEntryId];
      if (!selectedSlot) {
        toast.error('Por favor selecciona un horario disponible');
        return;
      }

      const response = await axios.post('/api/appointment-confirmation/waitlist/assign', {
        waitlistEntryId,
        slotDateTime: selectedSlot.startTime
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        toast.success('Paciente asignado exitosamente. El doctor ha sido notificado.');
        fetchWaitlist(); // Recargar lista
        setAvailableSlots(prev => ({ ...prev, [waitlistEntryId]: [] }));
        setSelectedSlots(prev => ({ ...prev, [waitlistEntryId]: null }));
        setSelectedDates(prev => ({ ...prev, [waitlistEntryId]: '' }));
      } else {
        throw new Error(response.data.error || 'Error al asignar paciente');
      }
    } catch (error) {
      console.error('Error al asignar paciente:', error);
      toast.error(error.response?.data?.error || 'Error al asignar paciente a la cita');
    }
  };

  const getUrgencyIcon = (urgency) => {
    switch (urgency) {
      case 'URGENT':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'HIGH':
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
      case 'NORMAL':
        return <ClockIcon className="h-5 w-5 text-blue-500" />;
      case 'LOW':
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'NORMAL':
        return 'bg-blue-100 text-blue-800';
      case 'LOW':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getUrgencyText = (urgency) => {
    switch (urgency) {
      case 'URGENT':
        return 'Muy Urgente';
      case 'HIGH':
        return 'Alta';
      case 'NORMAL':
        return 'Normal';
      case 'LOW':
        return 'Baja';
      default:
        return urgency;
    }
  };

  const getTimeSlotText = (timeSlot) => {
    switch (timeSlot) {
      case 'morning':
        return 'Mañana (8:00 AM - 12:00 PM)';
      case 'afternoon':
        return 'Tarde (12:00 PM - 5:00 PM)';
      case 'evening':
        return 'Noche (5:00 PM - 8:00 PM)';
      default:
        return timeSlot || 'Sin preferencia';
    }
  };

  if (loading) {
    return <Loader text="Cargando lista de espera..." />;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Gestión de Lista de Espera</h3>
        <div className="text-sm text-gray-500">
          {waitlistEntries.length} pacientes en espera
        </div>
      </div>

      {waitlistEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p>No hay pacientes en lista de espera</p>
          <p className="text-sm">Los pacientes aparecerán aquí cuando soliciten reprogramación</p>
        </div>
      ) : (
        <div className="space-y-4">
          {waitlistEntries.map((entry) => (
            <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getUrgencyIcon(entry.urgency)}
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {entry.patient.user.firstName} {entry.patient.user.lastName}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getUrgencyColor(entry.urgency)}`}>
                        {getUrgencyText(entry.urgency)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>
                          Fecha preferida: {entry.preferredDate 
                            ? new Date(entry.preferredDate).toLocaleDateString('es-ES')
                            : 'Sin preferencia'
                          }
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="h-4 w-4" />
                        <span>Horario: {getTimeSlotText(entry.preferredTimeSlot)}</span>
                      </div>
                    </div>
                    
                    {entry.notes && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                        <strong>Notas:</strong> {entry.notes}
                      </div>
                    )}
                    
                    <div className="mt-2 text-xs text-gray-500">
                      Se unió a la lista: {new Date(entry.joinedAt).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2 ml-4">
                  <div className="text-xs text-gray-500">Selecciona un horario</div>
                  <input
                    type="date"
                    value={selectedDates[entry.id] || (entry.preferredDate ? new Date(entry.preferredDate).toISOString().split('T')[0] : '')}
                    onChange={(e) => handleDateChange(entry.id, e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                  {loadingSlots[entry.id] ? (
                    <div className="text-xs text-gray-500">Cargando horarios...</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(availableSlots[entry.id] || []).map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlots(prev => ({ ...prev, [entry.id]: slot }))}
                          className={`px-2 py-1 text-xs rounded border ${
                            selectedSlots[entry.id]?.id === slot.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                          type="button"
                        >
                          {slot.displayTime ||
                            new Date(slot.startTime).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false
                            })}
                        </button>
                      ))}
                      {(selectedDates[entry.id] && (availableSlots[entry.id] || []).length === 0) && (
                        <span className="text-xs text-gray-500">Sin horarios disponibles</span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => assignToSlot(entry.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                  >
                    Asignar Slot
                  </button>
                  
                  <button
                    onClick={() => {/* TODO: Implementar ver perfil del paciente */}}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Ver Perfil
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Información adicional */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="font-medium text-blue-800 mb-2">¿Cómo funciona la lista de espera?</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Los pacientes se agregan automáticamente cuando solicitan reprogramación</li>
          <li>• Se priorizan por nivel de urgencia y tiempo de espera</li>
          <li>• Puedes asignar pacientes a slots disponibles cuando se cancelen citas</li>
          <li>• El sistema notifica automáticamente a los pacientes cuando se les asigna un slot</li>
        </ul>
      </div>
    </div>
  );
};

export default WaitlistManager;
