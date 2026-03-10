import React, { useState, useEffect } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  CalendarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';
import Loader from '../common/Loader';

const ConfirmationDashboard = () => {
  const [confirmationData, setConfirmationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchConfirmationStatus();
  }, [selectedDate]);

  const fetchConfirmationStatus = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await axios.get(`/api/appointment-confirmation/status?date=${selectedDate}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 segundos timeout
      });
      
      if (response.data.success) {
        setConfirmationData(response.data.data);
      } else {
        throw new Error(response.data.error || 'Error al cargar confirmaciones');
      }
      
    } catch (error) {
      console.error('Error al cargar estado de confirmaciones:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      const errorMessage = error.response?.data?.error || 
                           error.response?.data?.message || 
                           error.message || 
                           'Error al cargar confirmaciones';
      
      toast.error(errorMessage);
      
      // Establecer datos vacíos para evitar que se quede cargando
      setConfirmationData({
        appointments: [],
        statusCounts: {
          pending: 0,
          confirmed: 0,
          cancelled: 0,
          rescheduled: 0,
          completed: 0,
          noShow: 0
        },
        total: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const sendConfirmationRequest = async (appointmentId, reminderType) => {
    try {
      // Calcular fecha de envío según el tipo de recordatorio
      const scheduledFor = new Date();
      switch (reminderType) {
        case 'CONFIRMATION_48H':
          scheduledFor.setHours(scheduledFor.getHours() + 48);
          break;
        case 'CONFIRMATION_24H':
          scheduledFor.setHours(scheduledFor.getHours() + 24);
          break;
        case 'CONFIRMATION_12H':
          scheduledFor.setHours(scheduledFor.getHours() + 12);
          break;
        default:
          scheduledFor.setHours(scheduledFor.getHours() + 24);
      }
      
      const response = await axios.post('/api/appointment-confirmation/request', {
        appointmentId,
        reminderType,
        scheduledFor: scheduledFor.toISOString()
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        toast.success('Solicitud de confirmación enviada exitosamente');
        fetchConfirmationStatus(); // Recargar datos
      } else {
        throw new Error(response.data.error || 'Error al enviar solicitud');
      }
    } catch (error) {
      console.error('Error al enviar solicitud de confirmación:', error);
      toast.error(error.response?.data?.error || 'Error al enviar solicitud de confirmación');
    }
  };

  const handleApproveReject = async (appointmentId, action, reason = '') => {
    try {
      const response = await axios.put(
        `/api/appointment-confirmation/appointment/${appointmentId}/status`,
        { action, reason },
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      if (response.data.success) {
        toast.success(response.data.message || `Cita ${action === 'approve' ? 'aprobada' : 'rechazada'} exitosamente`);
        fetchConfirmationStatus(); // Recargar datos
      } else {
        throw new Error(response.data.error || `Error al ${action === 'approve' ? 'aprobar' : 'rechazar'} la cita`);
      }
    } catch (error) {
      console.error(`Error al ${action === 'approve' ? 'aprobar' : 'rechazar'} cita:`, error);
      toast.error(error.response?.data?.error || `Error al ${action === 'approve' ? 'aprobar' : 'rechazar'} la cita`);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'CANCELLED':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'RESCHEDULED':
        return <CalendarIcon className="h-5 w-5 text-blue-500" />;
      case 'NO_SHOW':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'COMPLETED':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'RESCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'NO_SHOW':
        return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'CONFIRMED':
        return 'Confirmada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'RESCHEDULED':
        return 'Reprogramada';
      case 'NO_SHOW':
        return 'No se presentó';
      case 'COMPLETED':
        return 'Completada';
      default:
        return status;
    }
  };

  if (loading) {
    return <Loader text="Cargando confirmaciones..." />;
  }

  if (!confirmationData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No hay datos de confirmación disponibles</p>
      </div>
    );
  }

  const { appointments, statusCounts, total } = confirmationData;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Dashboard de Confirmaciones</h3>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Resumen de estados */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-gray-700">{total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-700">{statusCounts.pending}</div>
          <div className="text-sm text-yellow-600">Pendientes</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-700">{statusCounts.confirmed}</div>
          <div className="text-sm text-green-600">Confirmadas</div>
        </div>
        <div className="bg-red-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-700">{statusCounts.cancelled}</div>
          <div className="text-sm text-red-600">Canceladas</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-blue-700">{statusCounts.rescheduled}</div>
          <div className="text-sm text-blue-600">Reprogramadas</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <div className="text-2xl font-bold text-purple-700">{statusCounts.completed}</div>
          <div className="text-sm text-purple-600">Completadas</div>
        </div>
      </div>

      {/* Lista de citas */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 mb-3">Citas del día seleccionado</h4>
        
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay citas programadas para esta fecha
          </div>
        ) : (
          appointments.map((appointment) => (
            <div key={appointment.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(appointment.confirmationStatus)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {appointment.patient.user.firstName} {appointment.patient.user.lastName}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(appointment.confirmationStatus)}`}>
                        {getStatusText(appointment.confirmationStatus)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(appointment.date).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {appointment.confirmationStatus === 'PENDING' && (
                    <>
                      <button
                        onClick={() => handleApproveReject(appointment.id, 'approve')}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 flex items-center space-x-1"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>Aprobar</span>
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Motivo del rechazo (opcional):');
                          if (reason !== null) {
                            handleApproveReject(appointment.id, 'reject', reason);
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 flex items-center space-x-1"
                      >
                        <XCircleIcon className="h-4 w-4" />
                        <span>Rechazar</span>
                      </button>
                      <div className="border-l border-gray-300 h-6 mx-2"></div>
                      <button
                        onClick={() => sendConfirmationRequest(appointment.id, 'CONFIRMATION_48H')}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                        title="Enviar recordatorio en 48 horas"
                      >
                        48h
                      </button>
                      <button
                        onClick={() => sendConfirmationRequest(appointment.id, 'CONFIRMATION_24H')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                        title="Enviar recordatorio en 24 horas"
                      >
                        24h
                      </button>
                      <button
                        onClick={() => sendConfirmationRequest(appointment.id, 'CONFIRMATION_12H')}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200"
                        title="Enviar recordatorio en 12 horas"
                      >
                        12h
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              {/* Solicitudes de confirmación previas */}
              {appointment.confirmationRequests && appointment.confirmationRequests.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs text-gray-500 mb-2">Solicitudes de confirmación enviadas:</div>
                  <div className="flex flex-wrap gap-2">
                    {appointment.confirmationRequests.map((request) => (
                      <span
                        key={request.id}
                        className={`px-2 py-1 text-xs rounded ${
                          request.status === 'RESPONDED' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {request.reminderType.replace('CONFIRMATION_', '')} - {request.status}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ConfirmationDashboard;
