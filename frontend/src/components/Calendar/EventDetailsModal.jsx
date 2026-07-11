import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  PencilIcon, 
  TrashIcon, 
  ShareIcon,
  MapPinIcon,
  VideoCameraIcon,
  LinkIcon,
  UserIcon,
  CalendarIcon,
  ClockIcon,
  PhoneIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import axios from 'axios';
import { CALENDAR_SYNC_CONFIG } from '../../config/calendarSync';
import { getApiUrl, getApiHeaders } from '../../utils/api';
import InPersonPaymentModal from '../payments/InPersonPaymentModal';

const EventDetailsModal = ({
  open,
  onClose,
  event,
  onUpdate,
  onDelete,
  onShare,
  patients = [],
  supportsGoogleMeet = false,
  supportsTeams = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [connectedCalendars, setConnectedCalendars] = useState([]);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isResendingCalendarInvite, setIsResendingCalendarInvite] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    fechaHoraInicio: '',
    fechaHoraFin: '',
    patientId: '',
    linkMeeting: '',
    origenEvento: '',
    tipoCita: 'presencial',
    meetingPlatform: '',
    teleconsultationAmount: '',
  });
  const [rescheduleData, setRescheduleData] = useState({
    fecha: '',
    selectedSlot: ''
  });
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [showMpModal, setShowMpModal] = useState(false);
  const [mpPaymentCtx, setMpPaymentCtx] = useState(null);
  const [teleconsultMeetingUrl, setTeleconsultMeetingUrl] = useState(null);
  const [mpChargePolicy, setMpChargePolicy] = useState({
    showAmountField: false,
    amountRequired: false,
    defaultAmount: 0,
    currency: 'MXN',
  });

  // Cargar calendarios conectados
  useEffect(() => {
    const fetchConnectedCalendars = async () => {
      if (!open) return;
      
      setIsLoadingCalendars(true);
      try {
        const response = await axios.get('/api/calendar-sync/sync-status', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });

        if (response.data?.success) {
          const data = response.data.data || {};
          const connected = [];
          
          if (data.google?.connected) {
            connected.push({ id: 'google', name: CALENDAR_SYNC_CONFIG.google.name });
          }
          if (data.outlook?.connected) {
            connected.push({ id: 'outlook', name: CALENDAR_SYNC_CONFIG.outlook.name });
          }
          if (data.apple?.connected) {
            connected.push({ id: 'apple', name: CALENDAR_SYNC_CONFIG.apple.name });
          }
          
          setConnectedCalendars(connected);
        }
      } catch (error) {
        console.error('Error fetching calendar sync status:', error);
      } finally {
        setIsLoadingCalendars(false);
      }
    };

    fetchConnectedCalendars();
  }, [open]);

  useEffect(() => {
    const loadMpPolicy = async () => {
      if (!open) return;
      try {
        const res = await axios.get(getApiUrl('/api/payments/mercadopago/teleconsultation-settings'), {
          headers: getApiHeaders(),
        });
        if (res.data?.success && res.data.chargePolicy) {
          setMpChargePolicy(res.data.chargePolicy);
        }
      } catch {
        setMpChargePolicy({
          showAmountField: false,
          amountRequired: false,
          defaultAmount: 0,
          currency: 'MXN',
        });
      }
    };
    loadMpPolicy();
  }, [open]);

  useEffect(() => {
    const loadPaymentStatus = async () => {
      if (!open || !event) return;
      const eventData = event.extendedProps || {};
      const appointmentId = eventData.appointmentId;
      if (!appointmentId || eventData.appointmentType !== 'teleconsulta') {
        setMpPaymentCtx(null);
        setTeleconsultMeetingUrl(null);
        return;
      }
      try {
        const res = await axios.get(
          getApiUrl(`/api/payments/mercadopago/appointment/${appointmentId}/payment-status`),
          { headers: getApiHeaders() }
        );
        if (res.data?.success) {
          setMpPaymentCtx(res.data);
          setTeleconsultMeetingUrl(res.data.meetingUrl || null);
        }
      } catch {
        setMpPaymentCtx(null);
        setTeleconsultMeetingUrl(null);
      }
    };
    loadPaymentStatus();
  }, [open, event]);

  useEffect(() => {
    if (showRescheduleModal && rescheduleData.fecha) {
      fetchRescheduleSlots(rescheduleData.fecha);
    }
  }, [showRescheduleModal]);

  // Cargar datos del evento cuando se abre el modal o cambia el evento
  useEffect(() => {
    if (event && open) {
      const eventData = event.extendedProps || {};
      const startDate = event.start ? new Date(event.start) : null;
      const endDate = event.end ? new Date(event.end) : null;

      // Formatear fechas para inputs datetime-local
      const formatLocalDateTime = (date) => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      const formattedStart = formatLocalDateTime(startDate);
      const formattedEnd = formatLocalDateTime(endDate);

      // Usar el título original de extendedProps si está disponible, o limpiar el prefijo del estatus
      let tituloOriginal = eventData.titulo || event.title || '';
      // Si el título tiene el prefijo "❌ Cita rechazada:", removerlo
      if (tituloOriginal.startsWith('❌ Cita rechazada: ')) {
        tituloOriginal = tituloOriginal.replace('❌ Cita rechazada: ', '');
      }

      const isTeleconsultaAppointment = eventData.appointmentType === 'teleconsulta';
      setFormData({
        titulo: tituloOriginal,
        descripcion: eventData.descripcion || '',
        fechaHoraInicio: formattedStart,
        fechaHoraFin: formattedEnd,
        patientId: eventData.patient?.id || '',
        linkMeeting: isTeleconsultaAppointment ? (eventData.linkMeeting || '') : '',
        origenEvento: eventData.origenEvento || '',
        tipoCita: isTeleconsultaAppointment ? 'remota' : 'presencial',
        meetingPlatform: eventData.linkMeeting?.includes('meet.google.com') ? 'google-meet' : 
                        eventData.linkMeeting?.includes('teams.microsoft.com') ? 'teams' : '',
        teleconsultationAmount:
          eventData.teleconsultationAmount != null && eventData.teleconsultationAmount !== ''
            ? String(eventData.teleconsultationAmount)
            : '',
      });

      // Inicializar datos de reagendar con las fechas actuales
      if (startDate) {
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');

        setRescheduleData({
          fecha: `${year}-${month}-${day}`,
          selectedSlot: ''
        });
        setRescheduleSlots([]);
      }
    }
  }, [event, open]);

  // Verificar si el evento puede ser editado
  // Solo eventos con paciente pueden ser editados (citas médicas)
  const canEdit = event?.extendedProps?.patientId ? true : false;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'tipoCita') {
        if (
          value === 'remota' &&
          mpChargePolicy.showAmountField &&
          !prev.teleconsultationAmount &&
          mpChargePolicy.defaultAmount > 0
        ) {
          next.teleconsultationAmount = String(mpChargePolicy.defaultAmount);
        }
        if (value === 'presencial') {
          next.teleconsultationAmount = '';
        }
      }
      return next;
    });
  };

  const eventData = event?.extendedProps || {};
  const resolvedMeetingLink =
    teleconsultMeetingUrl || eventData.meetingUrl || eventData.linkMeeting || '';
  const teleconsultVideoAllowed =
    eventData.appointmentType === 'teleconsulta' &&
    mpPaymentCtx?.consentSigned === true &&
    (!mpPaymentCtx?.paymentRequired || mpPaymentCtx?.paymentStatus === 'approved');
  const showTeleconsultVideoLink =
    eventData.appointmentType === 'teleconsulta' &&
    !!resolvedMeetingLink &&
    teleconsultVideoAllowed;

  const requiresTeleconsultationAmount =
    formData.tipoCita === 'remota' && mpChargePolicy.showAmountField;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.fechaHoraInicio || !formData.fechaHoraFin) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    if (new Date(formData.fechaHoraInicio) >= new Date(formData.fechaHoraFin)) {
      toast.error('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    if (requiresTeleconsultationAmount) {
      if (!formData.patientId) {
        toast.error('Selecciona un paciente para teleconsulta con cobro obligatorio');
        return;
      }
      const amount = parseFloat(formData.teleconsultationAmount);
      if (!formData.teleconsultationAmount || !Number.isFinite(amount) || amount <= 0) {
        toast.error('Indica el monto de teleconsulta (MXN)');
        return;
      }
    }

    try {
      await onUpdate(event.id, {
        ...formData,
        modalidadConsulta: formData.tipoCita === 'remota' ? 'virtual' : 'presencial',
        teleconsultationAmount: requiresTeleconsultationAmount
          ? parseFloat(formData.teleconsultationAmount)
          : null,
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error al actualizar evento:', error);
    }
  };

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      onDelete(event.id);
    }
  };

  const handleShare = () => {
    onShare(event);
  };

  const handleResendCalendarInvite = async () => {
    if (!event?.id) {
      toast.error('No se puede reenviar la invitación: evento no válido');
      return;
    }

    setIsResendingCalendarInvite(true);
    try {
      const response = await axios.post(
        `/api/calendar/events/${event.id}/resend-calendar-invite`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (response.data?.success) {
        toast.success('Invitación de calendario reenviada al paciente');
      }
    } catch (error) {
      console.error('Error al reenviar invitación de calendario:', error);
      toast.error(error.response?.data?.message || 'Error al reenviar la invitación de calendario');
    } finally {
      setIsResendingCalendarInvite(false);
    }
  };

  const handleResendAppointment = async () => {
    if (!event?.id) {
      toast.error('No se puede reenviar la cita: evento no válido');
      return;
    }

    setIsResending(true);
    try {
      const response = await axios.post(
        `/api/calendar/events/${event.id}/share`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (response.data) {
        toast.success('Cita reenviada exitosamente al paciente');
        if (onUpdate) {
          // Recargar el evento para actualizar el estado
          onUpdate(event.id, {});
        }
      }
    } catch (error) {
      console.error('Error al reenviar cita:', error);
      toast.error(error.response?.data?.message || 'Error al reenviar la cita');
    } finally {
      setIsResending(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!event?.id) {
      toast.error('No se puede cancelar la cita: evento no válido');
      return;
    }

    if (!window.confirm('¿Estás seguro de que quieres cancelar esta cita? El paciente será notificado.')) {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await axios.post(
        `/api/calendar/events/${event.id}/cancel`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (response.data?.success) {
        toast.success('Cita cancelada correctamente');
        if (onUpdate) {
          // Recargar el evento para actualizar el estado
          onUpdate(event.id, {});
        }
        // Cerrar el modal después de cancelar
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (error) {
      console.error('Error al cancelar cita:', error);
      toast.error(error.response?.data?.message || 'Error al cancelar la cita');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleApproveAppointment = async () => {
    const eventData = event?.extendedProps || {};
    const appointmentId = eventData.appointmentId;
    if (!appointmentId) {
      toast.error('No se puede aprobar la cita: falta el ID de la cita');
      return;
    }

    setIsApproving(true);
    try {
      const response = await axios.put(
        `/api/appointment-confirmation/appointment/${appointmentId}/status`,
        { action: 'approve' },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (response.data?.success) {
        toast.success('Cita aprobada. Se enviará la invitación al paciente.');
        if (onUpdate) {
          onUpdate(event.id, {});
        }
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        toast.error(response.data?.error || 'Error al aprobar la cita');
      }
    } catch (error) {
      console.error('Error al aprobar cita:', error);
      toast.error(error.response?.data?.error || 'Error al aprobar la cita');
    } finally {
      setIsApproving(false);
    }
  };

  const fetchRescheduleSlots = async (date) => {
    if (!date) {
      setRescheduleSlots([]);
      return;
    }
    setLoadingRescheduleSlots(true);
    try {
      const eventData = event?.extendedProps || {};
      const params = { date };
      if (eventData.appointmentId) params.excludeAppointmentId = eventData.appointmentId;
      if (event?.id) params.excludeEventId = event.id;

      const response = await axios.get('/api/calendar/reschedule-slots', {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.data?.success) {
        setRescheduleSlots(response.data.data || []);
      } else {
        setRescheduleSlots([]);
        toast.error(response.data?.message || 'No hay horarios disponibles');
      }
    } catch (error) {
      console.error('Error al cargar slots de reagendar:', error);
      setRescheduleSlots([]);
      toast.error(error.response?.data?.message || 'Error al cargar horarios disponibles');
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  const handleOpenMpModal = () => {
    const props = event?.extendedProps || {};
    if (!props.appointmentId) {
      toast.error('No se puede cobrar: falta el ID de la cita');
      return;
    }
    if (!props.patient?.id && !props.patientId) {
      toast.error('No se puede cobrar: falta el paciente asociado');
      return;
    }
    setShowMpModal(true);
  };

  const handleRescheduleDateChange = (date) => {
    setRescheduleData({ fecha: date, selectedSlot: '' });
    fetchRescheduleSlots(date);
  };

  const handleReschedule = async () => {
    if (!rescheduleData.fecha) {
      toast.error('Selecciona una fecha');
      return;
    }
    if (!rescheduleData.selectedSlot) {
      toast.error('Selecciona un horario disponible');
      return;
    }

    const slot = rescheduleSlots.find((s) => s.startTime === rescheduleData.selectedSlot);
    if (!slot) {
      toast.error('Horario no válido');
      return;
    }

    setIsRescheduling(true);
    try {
      const updateData = {
        ...formData,
        fechaHoraInicio: slot.startTime,
        fechaHoraFin: slot.endTime,
        modalidadConsulta: formData.tipoCita === 'remota' ? 'virtual' : 'presencial'
      };

      const response = await axios.put(
        `/api/calendar/events/${event.id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      toast.success('Cita reagendada. Se actualizó en tu calendario y en la agenda del paciente.');
      if (response.data?.calendarSyncWarning) {
        toast.warn(response.data.calendarSyncWarning, { autoClose: 10000 });
      }
      if (response.data?.calendarSyncWarning) {
        toast.warn(response.data.calendarSyncWarning, { autoClose: 10000 });
      }
      setShowRescheduleModal(false);
      if (onUpdate) {
        onUpdate(event.id, updateData);
      }
      onClose();
    } catch (error) {
      console.error('Error al reagendar cita:', error);
      toast.error(error.response?.data?.message || 'Error al reagendar la cita');
    } finally {
      setIsRescheduling(false);
    }
  };

  const getEventColor = (hasPatient, confirmationStatus) => {
    if (!hasPatient) {
      return '#9CA3AF'; // Gris - eventos externos sin paciente
    }
    if (confirmationStatus === 'CONFIRMED') {
      return '#22C55E'; // Verde - citas confirmadas
    }
    return '#FCA5A5'; // Rojo claro - citas pendientes
  };

  const getEventColorBadge = (origenEvento) => {
    const colors = {
      google: 'bg-red-100 text-red-800',
      outlook: 'bg-blue-100 text-blue-800',
      apple: 'bg-gray-100 text-gray-800'
    };
    return colors[origenEvento] || 'bg-gray-100 text-gray-800';
  };

  const getEventName = (origenEvento) => {
    const names = {
      google: 'Google Calendar',
      outlook: 'Outlook',
      apple: 'Apple Calendar'
    };
    return names[origenEvento] || origenEvento || 'Desconocido';
  };

  if (!event) return null;

  const hasPatient = !!(eventData.patientId || eventData.patient);
  const confirmationStatus = eventData.confirmationStatus;
  const eventColor = getEventColor(hasPatient, confirmationStatus);

  return (
    <>
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
            <Dialog.Title className="text-lg font-medium text-gray-900">
              {isEditing ? 'Editar cita' : 'Detalles de la cita'}
            </Dialog.Title>
            <div className="flex items-center space-x-2">
              {!isEditing && canEdit && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-gray-400 hover:text-blue-600"
                    title="Editar"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-gray-400 hover:text-red-600"
                    title="Eliminar"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                  {hasPatient && (
                    <button
                      onClick={handleShare}
                      className="text-gray-400 hover:text-green-600"
                      title="Compartir con paciente"
                    >
                      <ShareIcon className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  name="titulo"
                  value={formData.titulo}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paciente
                </label>
                <select
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Sin paciente</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.firstName} {patient.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha y hora de inicio *
                  </label>
                  <input
                    type="datetime-local"
                    name="fechaHoraInicio"
                    value={formData.fechaHoraInicio}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha y hora de fin *
                  </label>
                  <input
                    type="datetime-local"
                    name="fechaHoraFin"
                    value={formData.fechaHoraFin}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de cita
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tipoCita"
                      value="presencial"
                      checked={formData.tipoCita === 'presencial'}
                      onChange={handleChange}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center">
                      <MapPinIcon className="h-4 w-4 text-gray-600 mr-1" />
                      <span className="text-sm text-gray-700">Presencial</span>
                    </div>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tipoCita"
                      value="remota"
                      checked={formData.tipoCita === 'remota'}
                      onChange={handleChange}
                      className="mr-2 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex items-center">
                      <VideoCameraIcon className="h-4 w-4 text-gray-600 mr-1" />
                      <span className="text-sm text-gray-700">Remota</span>
                    </div>
                  </label>
                </div>
              </div>

              {formData.tipoCita === 'remota' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Link de reunión
                  </label>
                  <input
                    type="url"
                    name="linkMeeting"
                    value={formData.linkMeeting}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Pega el enlace de la reunión"
                  />
                </div>
              )}

              {requiresTeleconsultationAmount && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <BanknotesIcon className="h-4 w-4 text-sky-600" />
                    Monto teleconsulta (MXN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="teleconsultationAmount"
                    min="0"
                    step="0.01"
                    value={formData.teleconsultationAmount}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej. 500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Cobro obligatorio antes de generar el enlace de videollamada (Mercado Pago).
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Detalles adicionales de la cita"
                />
              </div>

              {isLoadingCalendars ? (
                <div className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-500">
                  Cargando calendarios...
                </div>
              ) : connectedCalendars.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Origen del evento
                  </label>
                  <select
                    name="origenEvento"
                    value={formData.origenEvento}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {connectedCalendars.map(calendar => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 space-y-4">
              {/* Color indicator */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: eventColor }}
                  ></div>
                  <span className="text-sm text-gray-600">
                    {!hasPatient ? 'Evento externo' : 
                     confirmationStatus === 'CONFIRMED' ? 'Cita confirmada' : 
                     'Cita pendiente de confirmación'}
                  </span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventColorBadge(eventData.origenEvento)}`}>
                  {getEventName(eventData.origenEvento)}
                </span>
              </div>

              {/* Título */}
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {formData.titulo || eventData.titulo || event.title?.replace('❌ Cita rechazada: ', '') || ''}
                </h3>
              </div>

              {/* Fecha y hora */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start space-x-2">
                  <CalendarIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Fecha de inicio</p>
                    <p className="text-sm text-gray-600">
                      {event.start ? new Date(event.start).toLocaleString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }) : 'No disponible'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-2">
                  <ClockIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Fecha de fin</p>
                    <p className="text-sm text-gray-600">
                      {event.end ? new Date(event.end).toLocaleString('es-ES', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }) : 'No disponible'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Información completa del paciente */}
              {hasPatient && eventData.patient && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 mb-3">
                    <UserIcon className="h-5 w-5 text-gray-600" />
                    <h4 className="text-sm font-semibold text-gray-900">Información del Paciente</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <UserIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-gray-500">Nombre completo</p>
                        <p className="text-sm text-gray-900">
                          {eventData.patient.firstName} {eventData.patient.lastName}
                        </p>
                      </div>
                    </div>

                    {eventData.patient.email && (
                      <div className="flex items-start space-x-2">
                        <EnvelopeIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">Email</p>
                          <a 
                            href={`mailto:${eventData.patient.email}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {eventData.patient.email}
                          </a>
                        </div>
                      </div>
                    )}

                    {(() => {
                      // Priorizar el teléfono del modelo Patient (campo "phone" del paciente)
                      const patientPhone = eventData.patient.phone || eventData.patient.user?.phone;
                      return patientPhone ? (
                        <div className="flex items-start space-x-2">
                          <PhoneIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-gray-500">Teléfono</p>
                            <a 
                              href={`tel:${patientPhone}`}
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              {patientPhone}
                            </a>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}

              {/* Tipo de cita */}
              <div className="flex items-start space-x-2">
                {formData.tipoCita === 'remota' ? (
                  <VideoCameraIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                ) : (
                  <MapPinIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">Tipo de cita</p>
                  <p className="text-sm text-gray-600">
                    {(eventData.appointmentType === 'teleconsulta')
                      ? 'Teleconsulta'
                      : (formData.tipoCita === 'remota' ? 'Remota' : 'Presencial')}
                  </p>
                </div>
              </div>

              {/* Link de reunión (teleconsulta con pago+consentimiento, o presencial/remota con linkMeeting) */}
              {showTeleconsultVideoLink && (
                <div className="flex items-start space-x-2">
                  <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Link de videollamada</p>
                    <a
                      href={resolvedMeetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 break-all"
                    >
                      {resolvedMeetingLink}
                    </a>
                  </div>
                </div>
              )}

              {/* Descripción */}
              {eventData.descripcion && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Descripción</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {eventData.descripcion}
                  </p>
                </div>
              )}

              {/* Estado de confirmación */}
              {hasPatient && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Estado de confirmación</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    confirmationStatus === 'CONFIRMED' 
                      ? 'bg-green-100 text-green-800' 
                      : confirmationStatus === 'CANCELLED'
                      ? 'bg-red-600 text-white'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {confirmationStatus === 'CONFIRMED' 
                      ? '✅ Confirmada por el paciente' 
                      : confirmationStatus === 'CANCELLED'
                      ? '❌ Cita rechazada por el paciente'
                      : '⏳ Pendiente de confirmación'}
                  </span>
                </div>
              )}

              {hasPatient && eventData.paymentLabel && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Estado de pago (Mercado Pago)
                  </p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      eventData.calendarHighlight === 'refund_pending'
                        ? 'bg-amber-100 text-amber-800'
                        : eventData.calendarHighlight === 'refunded' ||
                            eventData.mpPaymentStatus === 'refunded'
                          ? 'bg-gray-100 text-gray-800'
                          : eventData.mpPaymentStatus === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : eventData.mpPaymentStatus === 'pending'
                              ? 'bg-violet-100 text-violet-800'
                              : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {eventData.paymentLabel}
                  </span>
                </div>
              )}

              {hasPatient && eventData.appointmentType === 'teleconsulta' && mpPaymentCtx?.paymentRequired && !eventData.paymentLabel && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Estado de pago (teleconsulta)</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    mpPaymentCtx.paymentStatus === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : mpPaymentCtx.paymentStatus === 'refunded'
                        ? 'bg-gray-100 text-gray-800'
                        : mpPaymentCtx.refundRequest?.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-violet-100 text-violet-800'
                  }`}>
                    {mpPaymentCtx.paymentStatus === 'approved'
                      ? mpPaymentCtx.refundRequest?.status === 'pending'
                        ? 'Pagado · reembolso pendiente'
                        : 'Pagado'
                      : mpPaymentCtx.paymentStatus === 'refunded'
                        ? 'Reembolsado'
                        : 'Pendiente de pago'}
                  </span>
                  {mpPaymentCtx.amount > 0 && (
                    <p className="mt-1 text-xs text-gray-600">
                      Monto: ${Number(mpPaymentCtx.amount).toLocaleString('es-MX')} {mpPaymentCtx.currency || 'MXN'}
                    </p>
                  )}
                </div>
              )}

              {hasPatient &&
                eventData.appointmentType === 'teleconsulta' &&
                eventData.teleconsultationAmount != null &&
                !mpPaymentCtx?.paymentRequired && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Monto teleconsulta</p>
                    <p className="text-sm text-gray-600">
                      ${Number(eventData.teleconsultationAmount).toLocaleString('es-MX')} MXN
                    </p>
                  </div>
                )}

              {/* Botones de acción para citas con paciente (no canceladas) */}
              {hasPatient && confirmationStatus !== 'CANCELLED' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 space-y-3">
                  <p className="text-sm font-medium text-blue-900">
                    Acciones disponibles para esta cita:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {confirmationStatus === 'PENDING' && (
                      <button
                        onClick={handleApproveAppointment}
                        disabled={isApproving}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        <span>{isApproving ? 'Aprobando...' : 'Aceptar cita'}</span>
                      </button>
                    )}
                    <button
                      onClick={handleResendCalendarInvite}
                      disabled={isResendingCalendarInvite}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      <span>
                        {isResendingCalendarInvite ? 'Reenviando...' : 'Reenviar invitación calendario'}
                      </span>
                    </button>
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      disabled={isRescheduling}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CalendarDaysIcon className="h-4 w-4" />
                      <span>{isRescheduling ? 'Reagendando...' : 'Reagendar cita'}</span>
                    </button>
                    <button
                      onClick={handleCancelAppointment}
                      disabled={isCancelling}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XMarkIcon className="h-4 w-4" />
                      <span>{isCancelling ? 'Cancelando...' : 'Cancelar cita'}</span>
                    </button>
                    {eventData.appointmentType !== 'teleconsulta' && (
                      <button
                        type="button"
                        onClick={handleOpenMpModal}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-sky-600 text-white rounded-md text-sm font-medium hover:bg-sky-700"
                      >
                        <BanknotesIcon className="h-4 w-4" />
                        <span>Cobrar con Mercado Pago</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Botones de acción para citas rechazadas */}
              {hasPatient && confirmationStatus === 'CANCELLED' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-red-900">
                    Esta cita fue rechazada por el paciente. Puedes:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={handleResendAppointment}
                      disabled={isResending}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowPathIcon className="h-4 w-4" />
                      <span>{isResending ? 'Reenviando...' : 'Reenviar cita'}</span>
                    </button>
                    <button
                      onClick={() => setShowRescheduleModal(true)}
                      disabled={isRescheduling}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CalendarDaysIcon className="h-4 w-4" />
                      <span>Reagendar cita</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Botones de acción */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>

    {/* Modal de reagendar - Renderizado fuera del Dialog usando Portal */}
    {showRescheduleModal && createPortal(
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      >
        {/* Overlay - cierra el modal al hacer clic */}
        <div 
          className="fixed inset-0 bg-black/50"
          onClick={() => setShowRescheduleModal(false)}
        />
        
        {/* Contenido del modal */}
        <div 
          className="relative mx-auto max-w-md w-full bg-white rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-medium text-gray-900">
              Reagendar cita
            </h2>
            <button
              type="button"
              onClick={() => setShowRescheduleModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Elige un día y un horario disponible según la agenda compartida. La cita se actualizará
              en tu calendario y en la agenda del paciente.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1" />
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="fecha"
                value={rescheduleData.fecha}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => handleRescheduleDateChange(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                Horarios disponibles <span className="text-red-500">*</span>
              </label>
              {loadingRescheduleSlots ? (
                <div className="flex items-center justify-center py-6 text-sm text-gray-500">
                  <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                  Cargando horarios…
                </div>
              ) : !rescheduleData.fecha ? (
                <p className="text-sm text-gray-500 py-2">Selecciona primero una fecha.</p>
              ) : rescheduleSlots.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No hay horarios disponibles este día. Prueba otra fecha.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {rescheduleSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() =>
                        setRescheduleData((prev) => ({ ...prev, selectedSlot: slot.startTime }))
                      }
                      className={`px-2 py-2 text-sm rounded-md border transition-colors ${
                        rescheduleData.selectedSlot === slot.startTime
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-800 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {slot.displayTime}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setShowRescheduleModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleReschedule}
                disabled={isRescheduling}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRescheduling ? 'Reagendando...' : 'Reagendar'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
    {showMpModal && createPortal(
      <InPersonPaymentModal
        appointment={{
          id: eventData.appointmentId,
          patientId: eventData.patient?.id,
          patientName: eventData.patient
            ? `${eventData.patient.firstName || ''} ${eventData.patient.lastName || ''}`.trim()
            : event.title,
        }}
        onClose={() => setShowMpModal(false)}
      />,
      document.body
    )}
    </>
  );
};

export default EventDetailsModal;
