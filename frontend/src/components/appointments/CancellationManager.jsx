import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  ClockIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  CalendarIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';
import Loader from '../common/Loader';
import axios from 'axios';
import { toast } from 'react-toastify';

const CancellationManager = () => {
  const [cancellations, setCancellations] = useState([]);
  const [rescheduleRequests, setRescheduleRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCancellation, setSelectedCancellation] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('No hay token de autenticación');
        }

        const [cancellationsResponse, reschedulesResponse] = await Promise.all([
          axios.get('/api/appointment-confirmation/cancellations', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get('/api/appointment-confirmation/reschedules', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (cancellationsResponse.data?.success) {
          setCancellations(cancellationsResponse.data.data || []);
        } else {
          setCancellations([]);
        }

        if (reschedulesResponse.data?.success) {
          setRescheduleRequests(reschedulesResponse.data.data || []);
        } else {
          setRescheduleRequests([]);
        }
      } catch (error) {
        console.error('Error al cargar cancelaciones:', error);
        toast.error(error.response?.data?.error || 'Error al cargar cancelaciones');
        setCancellations([]);
        setRescheduleRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleApproveReschedule = (requestId) => {
    setRescheduleRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'approved' }
          : req
      )
    );
  };

  const handleRejectReschedule = (requestId) => {
    setRescheduleRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: 'rejected' }
          : req
      )
    );
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'cancelled':
        return <XMarkIcon className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XMarkIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'cancelled':
        return 'Cancelada';
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      default:
        return 'Desconocido';
    }
  };

  const getCancelledByText = (cancelledBy) => {
    if (cancelledBy === 'patient') return 'Paciente';
    if (cancelledBy === 'doctor') return 'Profesional';
    return 'Desconocido';
  };

  if (loading) {
    return <Loader text="Cargando cancelaciones..." />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Citas Canceladas
            </h3>
            <div className="text-sm text-gray-500">
              Total: {cancellations.length} cancelaciones
            </div>
          </div>

          {cancellations.length === 0 ? (
            <div className="text-center py-12">
              <XMarkIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay cancelaciones</h3>
              <p className="mt-1 text-sm text-gray-500">
                No se han registrado cancelaciones de citas.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {cancellations.map((cancellation) => (
                  <li key={cancellation.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            {getStatusIcon(cancellation.status)}
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-gray-900">
                                {cancellation.patientName}
                              </p>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(cancellation.status)}`}>
                                {getStatusText(cancellation.status)}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <CalendarIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                              {new Date(cancellation.appointmentDate).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                            <div className="mt-1 flex items-center text-sm text-gray-500">
                              <ExclamationTriangleIcon className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                              Cancelada por: {getCancelledByText(cancellation.cancelledBy)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {
                              setSelectedCancellation(cancellation);
                              setShowDetailsModal(true);
                            }}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Ver detalles
                          </button>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Motivo:</span> {cancellation.reason}
                        </p>
                        {cancellation.notes && (
                          <p className="mt-1 text-sm text-gray-500">
                            <span className="font-medium">Notas:</span> {cancellation.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>


      {/* Modal de detalles */}
      {showDetailsModal && selectedCancellation && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowDetailsModal(false)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    {getStatusIcon(selectedCancellation.status)}
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Detalles de Cancelación
                    </h3>
                    <div className="mt-2 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Paciente</p>
                        <p className="text-sm text-gray-900">{selectedCancellation.patientName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Email</p>
                        <p className="text-sm text-gray-900">{selectedCancellation.patientEmail}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Teléfono</p>
                        <p className="text-sm text-gray-900">{selectedCancellation.patientPhone}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Fecha de cita</p>
                        <p className="text-sm text-gray-900">
                          {new Date(selectedCancellation.appointmentDate).toLocaleDateString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Cancelada por</p>
                        <p className="text-sm text-gray-900">{getCancelledByText(selectedCancellation.cancelledBy)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Motivo</p>
                        <p className="text-sm text-gray-900">{selectedCancellation.reason}</p>
                      </div>
                      {selectedCancellation.notes && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Notas</p>
                          <p className="text-sm text-gray-900">{selectedCancellation.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CancellationManager;
