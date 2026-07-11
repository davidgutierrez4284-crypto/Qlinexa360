import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircleIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getApiUrl } from '../utils/api';

const TeleconsultationConsent = () => {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState(null);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('not_required');
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentCurrency, setPaymentCurrency] = useState('MXN');
  const [refundPolicyText, setRefundPolicyText] = useState(null);
  const [canRequestRefund, setCanRequestRefund] = useState(false);
  const [refundableAmount, setRefundableAmount] = useState(0);
  const [refundRequest, setRefundRequest] = useState(null);
  const [refundReason, setRefundReason] = useState('');
  const [paymentError, setPaymentError] = useState(null);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Gestión de la cita (reprogramar / cancelar) — disponible para teleconsultas igual que en presenciales
  const [managePanel, setManagePanel] = useState(null); // 'reschedule' | 'cancel' | 'refund' | null
  const [actionResult, setActionResult] = useState(null); // 'rescheduled' | 'waitlisted' | 'cancelled' | null
  const [rescheduledAt, setRescheduledAt] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rescheduleData, setRescheduleData] = useState({ preferredDate: '', preferredTime: '', notes: '' });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);

  useEffect(() => {
    fetchInfo();
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentParam = params.get('payment');
    if (paymentParam === 'success') {
      fetchInfo();
    } else if (paymentParam === 'failure') {
      toast.error(
        'El pago no se completó en Mercado Pago. Pulsa «Generar nuevo enlace de pago» e intenta de nuevo.'
      );
      fetchInfo(true);
    }
  }, [token]);

  useEffect(() => {
    if (!signed || !paymentRequired || paymentStatus === 'approved') return undefined;
    const interval = setInterval(() => fetchInfo(), 8000);
    return () => clearInterval(interval);
  }, [signed, paymentRequired, paymentStatus, token]);

  const applyPaymentFields = (data) => {
    const consentOk = !!data.consentSigned;
    setPaymentRequired(!!data.paymentRequired);
    setPaymentStatus(data.paymentStatus || 'not_required');
    setCheckoutUrl(consentOk ? data.checkoutUrl || null : null);
    setPaymentAmount(data.paymentAmount || 0);
    setPaymentCurrency(data.paymentCurrency || 'MXN');
    setRefundPolicyText(data.refundPolicyText || null);
    setCanRequestRefund(!!data.canRequestRefund);
    setRefundableAmount(Number(data.refundableAmount || 0));
    setRefundRequest(data.refundRequest || null);
    setPaymentError(data.paymentError || null);
  };

  const fetchInfo = async (refreshCheckout = false) => {
    try {
      const query = refreshCheckout ? '?refreshCheckout=1' : '';
      const response = await axios.get(getApiUrl(`/api/teleconsultation/info/${token}${query}`));
      if (response.data?.success) {
        setInfo(response.data);
        setSigned(response.data.consentSigned);
        setMeetingUrl(response.data.meetingUrl || null);
        applyPaymentFields(response.data);
      } else {
        throw new Error(response.data?.error || 'No se pudo cargar la información');
      }
    } catch (error) {
      console.error('Error al cargar teleconsulta:', error);
      setInfo({ error: error.response?.data?.error || 'Enlace no válido o expirado' });
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (e) => {
    e.preventDefault();
    if (!privacyAccepted) {
      toast.error('Debes leer y aceptar el aviso de privacidad y consentimiento informado');
      return;
    }
    if (!signature.trim() || signature.trim().length < 3) {
      toast.error('Ingresa tu nombre completo (mínimo 3 caracteres)');
      return;
    }

    setSigning(true);
    try {
      const response = await axios.post(
        getApiUrl(`/api/teleconsultation/sign-consent/${token}`),
        { signature: signature.trim() }
      );
      if (response.data?.success) {
        setSigned(true);
        setMeetingUrl(response.data.meetingUrl || null);
        applyPaymentFields(response.data);
        if (response.data.checkoutUrl) setCheckoutUrl(response.data.checkoutUrl);
        toast.success(response.data.message || 'Consentimiento firmado correctamente');
      } else {
        throw new Error(response.data?.error || 'Error al firmar');
      }
    } catch (error) {
      console.error('Error al firmar:', error);
      toast.error(error.response?.data?.error || 'Error al firmar el consentimiento');
    } finally {
      setSigning(false);
    }
  };

  const handleRetryPayment = async () => {
    setRetryingPayment(true);
    setPaymentError(null);
    setCheckoutUrl(null);
    try {
      await fetchInfo(true);
      toast.info('Enlace de pago actualizado.');
    } finally {
      setRetryingPayment(false);
    }
  };

  const handleJoinMeeting = () => {
    if (meetingUrl) {
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // ----- Reprogramar / cancelar (reutiliza los endpoints públicos de gestión de cita) -----
  const fetchAvailableSlots = async (date) => {
    if (!date) {
      setAvailableSlots([]);
      return;
    }
    try {
      setLoadingSlots(true);
      const response = await axios.get(
        getApiUrl(`/api/appointment-confirmation/reschedule/${token}/available-slots?date=${date}`)
      );
      if (response.data?.success) {
        setAvailableSlots(response.data.data || []);
      } else {
        setAvailableSlots([]);
        toast.error(response.data?.message || 'No hay horarios disponibles para esta fecha');
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
      setSubmittingAction(true);
      const response = await axios.post(
        getApiUrl(`/api/appointment-confirmation/reschedule/${token}`),
        rescheduleData
      );
      if (response.data?.success) {
        if (response.data.waitlisted) {
          setActionResult('waitlisted');
        } else {
          setRescheduledAt(response.data.data?.newDate || null);
          setActionResult('rescheduled');
        }
      } else {
        throw new Error(response.data?.error || 'Error al reprogramar');
      }
    } catch (error) {
      console.error('Error al solicitar reprogramación:', error);
      toast.error(error.response?.data?.error || 'Error al solicitar reprogramación');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      toast.error('Por favor, indica el motivo de la cancelación');
      return;
    }
    try {
      setSubmittingAction(true);
      const response = await axios.post(getApiUrl(`/api/appointment-confirmation/cancel/${token}`), {
        reason: cancellationReason
      });
      if (response.data?.success) {
        setActionResult('cancelled');
      } else {
        throw new Error(response.data?.error || 'Error al cancelar');
      }
    } catch (error) {
      console.error('Error al cancelar cita:', error);
      toast.error(error.response?.data?.error || 'Error al cancelar la cita');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSubmitRefund = async () => {
    if (!refundReason.trim() || refundReason.trim().length < 10) {
      toast.error('Describe el motivo del reembolso (mínimo 10 caracteres)');
      return;
    }
    try {
      setSubmittingAction(true);
      const response = await axios.post(getApiUrl(`/api/teleconsultation/refund-request/${token}`), {
        reason: refundReason.trim(),
        requestedAmount: refundableAmount,
      });
      if (response.data?.success) {
        toast.success('Solicitud enviada. El profesional revisará tu caso.');
        setRefundRequest(response.data.data);
        setCanRequestRefund(false);
        setManagePanel(null);
        setRefundReason('');
        await fetchInfo();
      } else {
        throw new Error(response.data?.error || 'Error al solicitar reembolso');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al solicitar reembolso');
    } finally {
      setSubmittingAction(false);
    }
  };

  const closeManagePanel = () => {
    setManagePanel(null);
    setRescheduleData({ preferredDate: '', preferredTime: '', notes: '' });
    setAvailableSlots([]);
    setCancellationReason('');
    setRefundReason('');
  };

  const refundRequestStatusLabel = {
    pending: 'Pendiente de revisión por el profesional',
    rejected: 'Rechazada',
    completed: 'Reembolso procesado',
    failed: 'Error al procesar; el profesional puede reintentar',
  };

  const renderRefundRequestStatus = () => {
    if (!refundRequest) return null;
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4 text-left">
        <p className="text-sm font-medium text-amber-900 mb-1">Solicitud de reembolso</p>
        <p className="text-sm text-amber-800">
          Estado: {refundRequestStatusLabel[refundRequest.status] || refundRequest.status}
        </p>
        <p className="text-sm text-amber-800">
          Monto solicitado: ${Number(refundRequest.requestedAmount || 0).toLocaleString('es-MX', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          {paymentCurrency}
        </p>
        {refundRequest.doctorNotes && (
          <p className="text-sm text-amber-900 mt-2">
            <strong>Respuesta del profesional:</strong> {refundRequest.doctorNotes}
          </p>
        )}
      </div>
    );
  };

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  // Sección reutilizable de gestión (reprogramar/cancelar), visible antes y después de firmar
  const renderManageSection = () => (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 text-left">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">¿Necesitas cambiar tu cita?</h2>
      <p className="text-sm text-gray-600 mb-4">
        Puedes reprogramar o cancelar esta teleconsulta. Al reprogramar solo verás los horarios disponibles en la
        agenda del profesional y el cambio se reflejará en tu calendario y en el del profesional.
      </p>

      {!managePanel && (
        <div className={`grid grid-cols-1 gap-3 ${canRequestRefund ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
          <button
            onClick={() => setManagePanel('reschedule')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Reprogramar cita
          </button>
          <button
            onClick={() => setManagePanel('cancel')}
            className="w-full bg-white text-red-600 border border-red-300 py-3 px-4 rounded-lg hover:bg-red-50 font-medium flex items-center justify-center gap-2"
          >
            <XCircleIcon className="h-5 w-5" />
            Cancelar cita
          </button>
          {canRequestRefund && (
            <button
              onClick={() => setManagePanel('refund')}
              className="w-full bg-white text-amber-700 border border-amber-300 py-3 px-4 rounded-lg hover:bg-amber-50 font-medium flex items-center justify-center gap-2"
            >
              <ExclamationTriangleIcon className="h-5 w-5" />
              Solicitar reembolso
            </button>
          )}
        </div>
      )}

      {managePanel === 'reschedule' && (
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fecha preferida *</label>
            <input
              type="date"
              value={rescheduleData.preferredDate}
              onChange={(e) => handleDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Horario disponible *</label>
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
                    onClick={() => setRescheduleData({ ...rescheduleData, preferredTime: slot.startTime })}
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Notas adicionales (opcional)</label>
            <textarea
              value={rescheduleData.notes}
              onChange={(e) => setRescheduleData({ ...rescheduleData, notes: e.target.value })}
              placeholder="Indica cualquier información adicional que consideres importante..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleReschedule}
              disabled={!rescheduleData.preferredDate || !rescheduleData.preferredTime || loadingSlots || submittingAction}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submittingAction ? 'Reprogramando...' : 'Reprogramar cita'}
            </button>
            <button
              onClick={closeManagePanel}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 font-medium"
            >
              Volver
            </button>
          </div>
        </div>
      )}

      {managePanel === 'cancel' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Motivo de la cancelación *</label>
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            placeholder="Por favor, indica el motivo de la cancelación..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            rows={3}
            required
          />
          <div className="flex space-x-3 mt-4">
            <button
              onClick={handleCancel}
              disabled={submittingAction}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submittingAction ? 'Cancelando...' : 'Confirmar cancelación'}
            </button>
            <button
              onClick={closeManagePanel}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 font-medium"
            >
              Volver
            </button>
          </div>
          {paymentStatus === 'approved' && canRequestRefund && (
            <p className="text-xs text-amber-700 mt-3">
              Si cancelas y corresponde un reembolso según la política del profesional, usa «Solicitar reembolso» después de cancelar o antes, según aplique.
            </p>
          )}
        </div>
      )}

      {managePanel === 'refund' && (
        <div>
          <p className="text-sm text-gray-700 mb-3">
            Tu solicitud será revisada por el profesional antes de procesar cualquier reembolso en Mercado Pago.
          </p>
          {refundPolicyText && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">
              <strong>Política de reembolso:</strong> {refundPolicyText}
            </p>
          )}
          <p className="text-sm text-gray-800 mb-3">
            Monto pagado reembolsable:{' '}
            <strong>
              ${Number(refundableAmount || paymentAmount || 0).toLocaleString('es-MX', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              {paymentCurrency}
            </strong>
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-2">Motivo del reembolso *</label>
          <textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Explica por qué solicitas el reembolso (cancelación, imposibilidad de asistir, etc.)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
            rows={4}
            required
          />
          <div className="flex space-x-3 mt-4">
            <button
              onClick={handleSubmitRefund}
              disabled={submittingAction}
              className="flex-1 bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submittingAction ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            <button
              onClick={closeManagePanel}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 font-medium"
            >
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (info?.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Enlace no válido</h1>
          <p className="text-gray-600 mb-6">{info.error}</p>
          <a
            href={baseUrl}
            className="inline-block w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium text-center"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  // Resultado de una acción de gestión (reprogramar / cancelar)
  if (actionResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          {actionResult === 'rescheduled' && (
            <>
              <CalendarIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Cita reprogramada</h1>
              <p className="text-gray-600 mb-6">
                Tu teleconsulta quedó actualizada con el nuevo horario.
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
                )}{' '}
                También la verás en <strong>Mis citas</strong> al iniciar sesión y recibirás un correo de confirmación.
                El enlace de la videollamada seguirá disponible en esta misma página.
              </p>
            </>
          )}
          {actionResult === 'waitlisted' && (
            <>
              <ClockIcon className="h-16 w-16 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Lista de espera</h1>
              <p className="text-gray-600 mb-6">
                El horario elegido ya no está disponible. Te agregamos a la lista de espera y el consultorio te
                propondrá otra fecha.
              </p>
            </>
          )}
          {actionResult === 'cancelled' && (
            <>
              <XCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Cita cancelada</h1>
              <p className="text-gray-600 mb-6">
                Tu teleconsulta ha sido cancelada. Si necesitas una nueva cita, contacta con el consultorio.
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

  // Consentimiento ya firmado: mostrar acceso a videollamada + gestión de cita
  if (signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6 text-center">
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Asistencia confirmada</h1>
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
              <CheckCircleIcon className="h-4 w-4" />
              Cita confirmada
            </span>
            <p className="text-gray-600 mb-6">
              Has firmado el consentimiento informado y aviso de privacidad, y con ello tu asistencia a la
              teleconsulta quedó <strong>confirmada</strong>. El profesional de salud ha recibido una copia por correo.
            </p>
            {info && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-600">
                  <strong>Paciente:</strong> {info.patientName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Profesional:</strong> {info.doctorName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Fecha y hora:</strong> {info.appointmentDate} - {info.appointmentTime}
                </p>
              </div>
            )}
            {paymentRequired && paymentStatus === 'pending' && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-left">
                <p className="text-sm font-medium text-amber-900 mb-2">Pendiente de pago</p>
                <p className="text-sm text-amber-800 mb-3">
                  Para recibir el enlace de videollamada, completa el pago de{' '}
                  <strong>
                    ${Number(paymentAmount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                    {paymentCurrency}
                  </strong>.
                </p>
                {refundPolicyText && (
                  <p className="text-xs text-amber-700 mb-3">{refundPolicyText}</p>
                )}
                {checkoutUrl ? (
                  <>
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full justify-center bg-sky-600 text-white py-3 px-4 rounded-lg hover:bg-sky-700 font-medium"
                    >
                      Pagar con Mercado Pago
                    </a>
                    <button
                      type="button"
                      onClick={handleRetryPayment}
                      disabled={retryingPayment}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 text-sm text-sky-700 hover:text-sky-900 disabled:opacity-50"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      {retryingPayment ? 'Generando enlace…' : 'Generar nuevo enlace de pago'}
                    </button>
                    <p className="text-xs text-amber-800 mt-2">
                      Si Mercado Pago muestra error, genera un enlace nuevo.
                    </p>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-700">
                      {paymentError || 'No se pudo cargar el enlace de pago.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleRetryPayment}
                      disabled={retryingPayment}
                      className="inline-flex w-full justify-center bg-sky-600 text-white py-3 px-4 rounded-lg hover:bg-sky-700 font-medium disabled:opacity-50"
                    >
                      {retryingPayment ? 'Generando enlace…' : 'Reintentar enlace de pago'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Tras pagar, esta página se actualizará automáticamente.
                </p>
              </div>
            )}
            {paymentRequired && paymentStatus === 'approved' && (
              <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
                Pagado
              </span>
            )}
            {paymentRequired && paymentStatus === 'refunded' && (
              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
                Reembolsado
              </span>
            )}
            {(paymentStatus === 'approved' || paymentStatus === 'refunded') && renderRefundRequestStatus()}
            {meetingUrl ? (
              <button
                onClick={handleJoinMeeting}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-medium text-lg flex items-center justify-center gap-2"
              >
                <VideoCameraIcon className="h-6 w-6" />
                Acceder a la videollamada
              </button>
            ) : paymentRequired && paymentStatus === 'pending' ? null : (
              <p className="text-amber-600 text-sm">
                El enlace de videollamada aún no está disponible. Revisa tu correo o contacta al consultorio.
              </p>
            )}
          </div>

          {renderManageSection()}
        </div>
      </div>
    );
  }

  // Formulario de firma + gestión de cita
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <DocumentTextIcon className="h-14 w-14 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Consentimiento para Teleconsulta
          </h1>
          <p className="text-gray-600">Qlinexa360</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Información de tu cita</h2>
          <div className="space-y-2 text-gray-600">
            <p><strong>Paciente:</strong> {info?.patientName}</p>
            <p><strong>Profesional:</strong> {info?.doctorName}</p>
            <p><strong>Fecha:</strong> {info?.appointmentDate}</p>
            <p><strong>Hora:</strong> {info?.appointmentTime}</p>
            {info?.paymentRequired && info?.paymentAmount > 0 && (
              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm">
                <strong>Costo teleconsulta:</strong>{' '}
                ${Number(info.paymentAmount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                {info.paymentCurrency || 'MXN'}. Tras firmar podrás pagar con Mercado Pago.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Consentimiento informado y aviso de privacidad</h2>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 space-y-3 mb-4 max-h-72 overflow-y-auto">
            <p>
              <strong>Aviso legal:</strong> Qlinexa360 facilita la gestión administrativa y documental de
              teleconsultas, pero no presta servicios médicos ni garantiza por sí misma la suficiencia clínica de la
              atención a distancia. La procedencia de la teleconsulta, el diagnóstico, tratamiento y la eventual
              necesidad de atención presencial son responsabilidad exclusiva del profesional de la salud.
            </p>
            <p>
              Al firmar este documento, consientes la realización de una consulta médica a distancia mediante
              videollamada. Los datos personales serán tratados conforme al Aviso de Privacidad de Qlinexa360
              (LFPDPPP). La teleconsulta no sustituye la valoración presencial cuando sea necesaria. No se realizará
              grabación de video ni audio de la sesión.
            </p>
            <p className="text-xs text-gray-500">Contacto: www.qlinexa360.com | legal@qlinexa360.com</p>
          </div>
          <p className="text-gray-700 text-sm font-medium mb-4">
            Al firmar también <strong>confirmas tu asistencia</strong> a esta teleconsulta. Si no puedes asistir,
            usa la sección de más abajo para reprogramar o cancelar.
          </p>

          <form onSubmit={handleSign}>
            <label className="flex items-start gap-2 text-sm text-gray-800 mb-4">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
                className="mt-1"
                required
              />
              <span>
                He leído y acepto el consentimiento informado y el aviso de privacidad para esta teleconsulta.
              </span>
            </label>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Firma digital (escribe tu nombre completo)
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Ej: Juan Pérez García"
              className="w-full border border-gray-300 rounded-md px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              minLength={3}
              required
              disabled={signing}
            />
            <p className="text-xs text-gray-500 mt-1">Mínimo 3 caracteres</p>

            <button
              type="submit"
              disabled={signing || !privacyAccepted || signature.trim().length < 3}
              className="mt-6 w-full bg-blue-600 text-white py-4 px-6 rounded-lg hover:bg-blue-700 font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {signing ? (
                <>
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  Firmando...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-6 w-6" />
                  Confirmar asistencia y firmar consentimiento
                </>
              )}
            </button>
          </form>
        </div>

        {renderManageSection()}
      </div>
    </div>
  );
};

export default TeleconsultationConsent;
