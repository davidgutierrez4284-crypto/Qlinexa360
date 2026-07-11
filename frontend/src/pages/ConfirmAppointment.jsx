import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const ConfirmAppointment = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [appointmentData, setAppointmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(null); // 'confirm', 'cancel', 'reschedule'
  const [rescheduledAt, setRescheduledAt] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rescheduleData, setRescheduleData] = useState({
    preferredDate: '',
    preferredTime: '',
    notes: ''
  });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [canRequestRefund, setCanRequestRefund] = useState(false);
  const [refundableAmount, setRefundableAmount] = useState(0);
  const [refundRequest, setRefundRequest] = useState(null);
  const [refundPolicyText, setRefundPolicyText] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  useEffect(() => {
    fetchAppointmentData();
  }, [token]);

  const fetchAppointmentData = async () => {
    try {
      const response = await axios.get(`/api/appointment-confirmation/info/${token}`);
      if (response.data?.success) {
        const data = response.data.data;
        // Las teleconsultas se gestionan en su propia página (firma de aviso + liga de videollamada).
        // Redirigimos para que cualquier enlace (correo o invitación de calendario) lleve al flujo correcto.
        if (data.appointmentType === 'teleconsulta') {
          navigate(`/teleconsulta/${token}`, { replace: true });
          return;
        }
        setAppointmentData({
          id: data.appointmentId,
          date: new Date(data.date),
          displayDate: data.displayDate,
          displayTime: data.displayTime,
          patient: data.patient,
          doctor: data.doctor,
          status: data.confirmationStatus,
          appointmentType: data.appointmentType,
          inPersonPaymentOffered: data.inPersonPaymentOffered,
          inPersonPaymentStatus: data.inPersonPaymentStatus,
          inPersonPaymentAmount: data.inPersonPaymentAmount,
          inPersonPaymentCurrency: data.inPersonPaymentCurrency,
          inPersonCheckoutUrl: data.inPersonCheckoutUrl,
          refundPolicyText: data.refundPolicyText,
          canRequestRefund: data.canRequestRefund,
          refundableAmount: data.refundableAmount,
          refundRequest: data.refundRequest,
        });
        setCanRequestRefund(!!data.canRequestRefund);
        setRefundableAmount(Number(data.refundableAmount || 0));
        setRefundRequest(data.refundRequest || null);
        setRefundPolicyText(data.refundPolicyText || null);
      } else {
        throw new Error('No se pudo cargar la cita');
      }
    } catch (error) {
      console.error('Error al cargar datos de la cita:', error);
      toast.error('Error al cargar la cita');
    } finally {
      setLoading(false);
    }
  };

  const formatAppointmentDate = (date) =>
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);

  const formatAppointmentTime = (date) =>
    new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);

  const handleConfirm = async () => {
    try {
      const response = await axios.post(`/api/appointment-confirmation/confirm/${token}`);
      
      if (response.data.success) {
        toast.success('¡Cita confirmada exitosamente!');
        setAction('confirmed');
      }
    } catch (error) {
      console.error('Error al confirmar cita:', error);
      toast.error('Error al confirmar la cita');
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Por favor, indica el motivo de la cancelación');
      return;
    }

    try {
      const response = await axios.post(`/api/appointment-confirmation/cancel/${token}`, {
        reason: cancellationReason
      });
      
      if (response.data.success) {
        toast.success('Cita cancelada exitosamente');
        setAction('cancelled');
      }
    } catch (error) {
      console.error('Error al cancelar cita:', error);
      toast.error('Error al cancelar la cita');
    }
  };

  const handleSubmitRefund = async () => {
    if (!refundReason.trim() || refundReason.trim().length < 10) {
      toast.error('Describe el motivo del reembolso (mínimo 10 caracteres)');
      return;
    }
    try {
      setSubmittingRefund(true);
      const response = await axios.post(`/api/appointment-confirmation/refund-request/${token}`, {
        reason: refundReason.trim(),
        requestedAmount: refundableAmount,
      });
      if (response.data?.success) {
        toast.success('Solicitud enviada. La cita quedará cancelada mientras el profesional revisa el reembolso.');
        setRefundRequest(response.data.data);
        setCanRequestRefund(false);
        setAction('refund_requested');
        setRefundReason('');
        await fetchAppointmentData();
      } else {
        throw new Error(response.data?.error || 'Error al solicitar reembolso');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Error al solicitar reembolso');
    } finally {
      setSubmittingRefund(false);
    }
  };

  // Cargar horarios disponibles cuando se selecciona una fecha
  const fetchAvailableSlots = async (date) => {
    if (!date) {
      setAvailableSlots([]);
      return;
    }

    try {
      setLoadingSlots(true);
      const response = await axios.get(`/api/appointment-confirmation/reschedule/${token}/available-slots?date=${date}`);
      
      if (response.data.success) {
        setAvailableSlots(response.data.data || []);
      } else {
        setAvailableSlots([]);
        toast.error(response.data.message || 'No hay horarios disponibles para esta fecha');
      }
    } catch (error) {
      console.error('Error al cargar horarios disponibles:', error);
      setAvailableSlots([]);
      toast.error(error.response?.data?.error || 'Error al cargar horarios disponibles');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (date) => {
    setRescheduleData({ ...rescheduleData, preferredDate: date, preferredTime: '' });
    fetchAvailableSlots(date);
  };

  const handleReschedule = async () => {
    if (!rescheduleData.preferredDate) {
      toast.error('Por favor, selecciona una fecha preferida');
      return;
    }

    if (!rescheduleData.preferredTime) {
      toast.error('Por favor, selecciona un horario disponible');
      return;
    }

    try {
      const response = await axios.post(`/api/appointment-confirmation/reschedule/${token}`, rescheduleData);
      
      if (response.data.success) {
        if (response.data.waitlisted) {
          toast.success('Te agregamos a la lista de espera. El consultorio te contactará con un nuevo horario.');
          setAction('waitlisted');
        } else {
          toast.success('Cita reprogramada exitosamente');
          setRescheduledAt(response.data.data?.newDate || null);
          setAction('rescheduled');
        }
      }
    } catch (error) {
      console.error('Error al solicitar reprogramación:', error);
      toast.error(error.response?.data?.error || 'Error al solicitar reprogramación');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!appointmentData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cita no encontrada</h1>
          <p className="text-gray-600">El enlace de confirmación no es válido o ha expirado.</p>
        </div>
      </div>
    );
  }

  // Si ya se tomó una acción, mostrar confirmación
  if (action === 'confirmed' || action === 'cancelled' || action === 'rescheduled' || action === 'waitlisted' || action === 'refund_requested') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          {action === 'confirmed' && (
            <>
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Cita Confirmada!</h1>
              <p className="text-gray-600 mb-6">
                Tu cita ha sido confirmada exitosamente. Te esperamos en la fecha y hora programada.
              </p>
            </>
          )}
          
          {action === 'cancelled' && (
            <>
              <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Cita Cancelada</h1>
              <p className="text-gray-600 mb-6">
                Tu cita ha sido cancelada. Si necesitas reprogramar, contacta directamente con el consultorio.
              </p>
            </>
          )}

          {action === 'refund_requested' && (
            <>
              <ExclamationTriangleIcon className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Reembolso solicitado</h1>
              <p className="text-gray-600 mb-6">
                Tu solicitud fue enviada al profesional y la cita quedó cancelada. Te avisaremos cuando se procese el reembolso en Mercado Pago.
              </p>
            </>
          )}
          
          {action === 'rescheduled' && (
            <>
              <CalendarIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Cita reprogramada</h1>
              <p className="text-gray-600 mb-6">
                Tu cita quedó actualizada con el nuevo horario.
                {rescheduledAt && (
                  <>
                    {' '}
                    <strong className="text-gray-800">
                      {new Date(rescheduledAt).toLocaleString('es-MX', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </strong>
                  </>
                )}
                {' '}
                También la verás en <strong>Mis citas</strong> al iniciar sesión y recibirás un correo de
                confirmación.
              </p>
            </>
          )}

          {action === 'waitlisted' && (
            <>
              <ClockIcon className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Lista de espera</h1>
              <p className="text-gray-600 mb-6">
                El horario elegido ya no está disponible. Te agregamos a la lista de espera y el consultorio te propondrá otra fecha.
              </p>
            </>
          )}
          
          <button
            onClick={() => window.close()}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirmación de Cita Médica</h1>
          <p className="text-gray-600">Qlinexa360</p>
        </div>

        {/* Información de la cita */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <UserIcon className="h-8 w-8 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {appointmentData.patient.firstName} {appointmentData.patient.lastName}
              </h2>
              <p className="text-gray-600">Paciente</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="h-6 w-6 text-green-600" />
              <div>
                <p className="text-sm text-gray-500">Fecha y Hora</p>
                <p className="font-medium text-gray-900">
                  {appointmentData.displayDate || formatAppointmentDate(appointmentData.date)}
                </p>
                <p className="font-medium text-gray-900">
                  {appointmentData.displayTime || formatAppointmentTime(appointmentData.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <UserIcon className="h-6 w-6 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Profesional de la Salud</p>
                <p className="font-medium text-gray-900">
                  {appointmentData.doctor.firstName} {appointmentData.doctor.lastName}
                </p>
              </div>
            </div>
          </div>
        </div>

        {appointmentData.inPersonPaymentOffered &&
          appointmentData.inPersonPaymentStatus !== 'approved' &&
          appointmentData.inPersonCheckoutUrl && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-sky-900 mb-2">Pago opcional con Mercado Pago</h3>
              <p className="text-sm text-sky-800 mb-4">
                Puedes pagar esta consulta presencial por{' '}
                <strong>
                  ${Number(appointmentData.inPersonPaymentAmount || 0).toLocaleString('es-MX', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  {appointmentData.inPersonPaymentCurrency || 'MXN'}
                </strong>{' '}
                si lo deseas. También puedes pagar en efectivo o directamente en el consultorio.
              </p>
              <a
                href={appointmentData.inPersonCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full justify-center bg-sky-600 text-white py-3 px-4 rounded-lg hover:bg-sky-700 font-medium"
              >
                Pagar con Mercado Pago (opcional)
              </a>
            </div>
          )}

        {appointmentData.inPersonPaymentOffered && appointmentData.inPersonPaymentStatus === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-sm text-green-800">
            Consulta presencial pagada con Mercado Pago.
          </div>
        )}

        {refundRequest && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-900">
            <p className="font-medium mb-1">Solicitud de reembolso</p>
            <p>
              Estado:{' '}
              {refundRequest.status === 'pending'
                ? 'Pendiente de revisión'
                : refundRequest.status === 'completed'
                  ? 'Reembolso procesado'
                  : refundRequest.status}
            </p>
          </div>
        )}

        {appointmentData.status !== 'CANCELLED' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">¿Qué deseas hacer?</h3>
          
          {/* Confirmar */}
          <div className="mb-6">
            <button
              onClick={handleConfirm}
              className="w-full bg-green-600 text-white py-4 px-6 rounded-lg hover:bg-green-700 font-medium text-lg flex items-center justify-center space-x-2"
            >
              <CheckCircleIcon className="h-6 w-6" />
              <span>✅ Confirmar mi cita</span>
            </button>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Confirma que asistirás a tu cita en la fecha y hora programada
            </p>
          </div>

          {/* Cancelar */}
          <div className="mb-6">
            <button
              onClick={() => setAction('showCancel')}
              className="w-full bg-red-600 text-white py-4 px-6 rounded-lg hover:bg-red-700 font-medium text-lg flex items-center justify-center space-x-2"
            >
              <XCircleIcon className="h-6 w-6" />
              <span>❌ Cancelar mi cita</span>
            </button>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Cancela tu cita si no puedes asistir
            </p>
          </div>

          {/* Reprogramar */}
          <div className="mb-6">
            <button
              onClick={() => setAction('showReschedule')}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-medium text-lg flex items-center justify-center space-x-2"
            >
              <CalendarIcon className="h-6 w-6" />
              <span>🔄 Solicitar reprogramación</span>
            </button>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Solicita cambiar la fecha o hora de tu cita
            </p>
          </div>

          {canRequestRefund && (
            <div className="mb-2 border-t border-gray-100 pt-6">
              <button
                type="button"
                onClick={() => setAction(action === 'showRefund' ? null : 'showRefund')}
                className="w-full bg-amber-600 text-white py-4 px-6 rounded-lg hover:bg-amber-700 font-medium text-lg flex items-center justify-center space-x-2"
              >
                <ExclamationTriangleIcon className="h-6 w-6" />
                <span>Solicitar reembolso y cancelar</span>
              </button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Si pagaste con Mercado Pago y no podrás asistir, solicita reembolso. La cita se cancelará automáticamente.
              </p>
            </div>
          )}
        </div>
        )}

        {action === 'showRefund' && canRequestRefund && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Solicitar reembolso</h3>
            {refundPolicyText && (
              <p className="text-sm text-gray-600 mb-3">
                <strong>Política:</strong> {refundPolicyText}
              </p>
            )}
            <p className="text-sm text-gray-700 mb-4">
              Monto:{' '}
              <strong>
                ${Number(refundableAmount || appointmentData.inPersonPaymentAmount || 0).toLocaleString('es-MX', {
                  minimumFractionDigits: 2,
                })}{' '}
                {appointmentData.inPersonPaymentCurrency || 'MXN'}
              </strong>
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Motivo del reembolso *</label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Explica por qué solicitas el reembolso (mínimo 10 caracteres)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              rows={3}
            />
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleSubmitRefund}
                disabled={submittingRefund}
                className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 font-medium disabled:opacity-50"
              >
                {submittingRefund ? 'Enviando…' : 'Enviar solicitud'}
              </button>
              <button
                type="button"
                onClick={() => setAction(null)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 font-medium"
              >
                Volver
              </button>
            </div>
          </div>
        )}

        {/* Formulario de cancelación */}
        {action === 'showCancel' && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancelar Cita</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la cancelación *
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Por favor, indica el motivo de la cancelación..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                rows={3}
                required
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 font-medium"
              >
                Confirmar Cancelación
              </button>
              <button
                onClick={() => setAction(null)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Formulario de reprogramación */}
        {action === 'showReschedule' && (
          <div className="bg-white rounded-lg shadow-md p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reprogramar Cita</h3>
            <p className="text-sm text-gray-600 mb-4">
              Selecciona una fecha y horario disponible para reprogramar tu cita. Solo se muestran horarios disponibles en la agenda del doctor.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha preferida *
              </label>
              <input
                type="date"
                value={rescheduleData.preferredDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={new Date().toISOString().split('T')[0]} // No permitir fechas pasadas
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Horario disponible *
              </label>
              {loadingSlots ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Cargando horarios disponibles...</span>
                </div>
              ) : availableSlots.length === 0 && rescheduleData.preferredDate ? (
                <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50">
                  <p className="text-sm text-red-600">
                    No hay horarios disponibles para esta fecha. Por favor, selecciona otra fecha.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() =>
                        setRescheduleData({ ...rescheduleData, preferredTime: slot.startTime })
                      }
                      className={`px-2 py-2 text-sm rounded-md border ${
                        rescheduleData.preferredTime === slot.startTime
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-800 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {slot.displayTime ||
                        new Date(slot.startTime).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false
                        })}
                    </button>
                  ))}
                </div>
              )}
              {rescheduleData.preferredDate && availableSlots.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {availableSlots.length} horario(s) disponible(s) para esta fecha
                </p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notas adicionales (opcional)
              </label>
              <textarea
                value={rescheduleData.notes}
                onChange={(e) => setRescheduleData({...rescheduleData, notes: e.target.value})}
                placeholder="Indica cualquier información adicional que consideres importante..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleReschedule}
                disabled={!rescheduleData.preferredDate || !rescheduleData.preferredTime || loadingSlots}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Reprogramar Cita
              </button>
              <button
                onClick={() => {
                  setAction(null);
                  setRescheduleData({ preferredDate: '', preferredTime: '', notes: '' });
                  setAvailableSlots([]);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Información adicional */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-medium text-blue-800 mb-2">💡 Información importante</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Confirma tu cita al menos 24 horas antes de la fecha programada</li>
            <li>• Si cancelas, puedes solicitar reprogramación en cualquier momento</li>
            <li>• Para emergencias, contacta directamente con el consultorio</li>
            <li>• Este enlace permanece activo hasta 48 horas después de la fecha de tu cita</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ConfirmAppointment;
