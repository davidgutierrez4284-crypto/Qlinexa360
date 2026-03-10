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
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import axios from 'axios';
import { CALENDAR_SYNC_CONFIG } from '../../config/calendarSync';

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
    meetingPlatform: ''
  });
  const [rescheduleData, setRescheduleData] = useState({
    fecha: '',
    horaInicio: '09',
    minutosInicio: '00',
    horaFin: '10',
    minutosFin: '00'
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
          if (data.notion?.connected) {
            connected.push({ id: 'notion', name: CALENDAR_SYNC_CONFIG.notion.name });
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

      setFormData({
        titulo: tituloOriginal,
        descripcion: eventData.descripcion || '',
        fechaHoraInicio: formattedStart,
        fechaHoraFin: formattedEnd,
        patientId: eventData.patient?.id || '',
        linkMeeting: eventData.linkMeeting || '',
        origenEvento: eventData.origenEvento || '',
        tipoCita: eventData.linkMeeting ? 'remota' : 'presencial',
        meetingPlatform: eventData.linkMeeting?.includes('meet.google.com') ? 'google-meet' : 
                        eventData.linkMeeting?.includes('teams.microsoft.com') ? 'teams' : ''
      });

      // Inicializar datos de reagendar con las fechas actuales
      if (startDate) {
        const year = startDate.getFullYear();
        const month = String(startDate.getMonth() + 1).padStart(2, '0');
        const day = String(startDate.getDate()).padStart(2, '0');
        const horaInicio = String(startDate.getHours()).padStart(2, '0');
        const minutosInicio = String(Math.floor(startDate.getMinutes() / 15) * 15).padStart(2, '0');
        
        const endDateObj = endDate || startDate;
        const horaFin = String(endDateObj.getHours()).padStart(2, '0');
        const minutosFin = String(Math.floor(endDateObj.getMinutes() / 15) * 15).padStart(2, '0');
        
        setRescheduleData({
          fecha: `${year}-${month}-${day}`,
          horaInicio: horaInicio,
          minutosInicio: minutosInicio,
          horaFin: horaFin,
          minutosFin: minutosFin
        });
      }
    }
  }, [event, open]);

  // Verificar si el evento puede ser editado
  // Solo eventos con paciente pueden ser editados (citas médicas)
  const canEdit = event?.extendedProps?.patientId ? true : false;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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

    try {
      await onUpdate(event.id, formData);
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

  // Generar opciones de horas (0-23) y minutos (00, 15, 30, 45)
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minuteOptions = ['00', '15', '30', '45'];

  const handleRescheduleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia la hora de inicio, actualizar también la hora de fin con el mismo valor
    if (name === 'horaInicio' || name === 'minutosInicio') {
      setRescheduleData(prev => ({
        ...prev,
        [name]: value,
        // Si cambia la hora de inicio, actualizar la hora de fin con el mismo valor
        horaFin: name === 'horaInicio' ? value : prev.horaFin,
        minutosFin: name === 'minutosInicio' ? value : prev.minutosFin
      }));
    } else {
      setRescheduleData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleQuickDuration = (minutes) => {
    const startHour = parseInt(rescheduleData.horaInicio);
    const startMinutes = parseInt(rescheduleData.minutosInicio);
    
    const startTotalMinutes = startHour * 60 + startMinutes;
    const endTotalMinutes = startTotalMinutes + minutes;
    
    const endHour = Math.floor(endTotalMinutes / 60) % 24;
    const endMinutes = endTotalMinutes % 60;
    
    setRescheduleData(prev => ({
      ...prev,
      horaFin: String(endHour).padStart(2, '0'),
      minutosFin: String(Math.floor(endMinutes / 15) * 15).padStart(2, '0')
    }));
  };

  const handleReschedule = async () => {
    if (!rescheduleData.fecha || !rescheduleData.horaInicio || !rescheduleData.minutosInicio || 
        !rescheduleData.horaFin || !rescheduleData.minutosFin) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    // Validar que la hora de fin sea posterior a la de inicio
    const startTotalMinutes = parseInt(rescheduleData.horaInicio) * 60 + parseInt(rescheduleData.minutosInicio);
    const endTotalMinutes = parseInt(rescheduleData.horaFin) * 60 + parseInt(rescheduleData.minutosFin);
    
    if (endTotalMinutes <= startTotalMinutes) {
      toast.error('La hora de fin debe ser posterior a la de inicio');
      return;
    }

    setIsRescheduling(true);
    try {
      // Construir fechas completas
      const fechaHoraInicio = new Date(`${rescheduleData.fecha}T${rescheduleData.horaInicio}:${rescheduleData.minutosInicio}:00`);
      const fechaHoraFin = new Date(`${rescheduleData.fecha}T${rescheduleData.horaFin}:${rescheduleData.minutosFin}:00`);

      const updateData = {
        ...formData,
        fechaHoraInicio: fechaHoraInicio.toISOString(),
        fechaHoraFin: fechaHoraFin.toISOString()
      };

      await axios.put(
        `/api/calendar/events/${event.id}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        }
      );

      toast.success('Cita reagendada exitosamente');
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
      apple: 'bg-gray-100 text-gray-800',
      notion: 'bg-gray-100 text-gray-800'
    };
    return colors[origenEvento] || 'bg-gray-100 text-gray-800';
  };

  const getEventName = (origenEvento) => {
    const names = {
      google: 'Google Calendar',
      outlook: 'Outlook',
      apple: 'Apple Calendar',
      notion: 'Notion'
    };
    return names[origenEvento] || origenEvento || 'Desconocido';
  };

  if (!event) return null;

  const eventData = event.extendedProps || {};
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
                    {formData.tipoCita === 'remota' ? 'Remota' : 'Presencial'}
                  </p>
                </div>
              </div>

              {/* Link de reunión */}
              {eventData.linkMeeting && (
                <div className="flex items-start space-x-2">
                  <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">Link de reunión</p>
                    <a
                      href={eventData.linkMeeting}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 break-all"
                    >
                      {eventData.linkMeeting}
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
              Selecciona la nueva fecha y hora para esta cita:
            </p>

            {/* Fecha */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <CalendarIcon className="h-4 w-4 mr-1" />
                Fecha <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="fecha"
                value={rescheduleData.fecha}
                onChange={handleRescheduleChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* Hora de inicio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <ClockIcon className="h-4 w-4 mr-1" />
                Hora de inicio <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-2">
                <select
                  name="horaInicio"
                  value={rescheduleData.horaInicio}
                  onChange={handleRescheduleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hourOptions.map(hour => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select
                  name="minutosInicio"
                  value={rescheduleData.minutosInicio}
                  onChange={handleRescheduleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {minuteOptions.map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Hora de fin con opciones rápidas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora de fin <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-2 mb-2">
                <select
                  name="horaFin"
                  value={rescheduleData.horaFin}
                  onChange={handleRescheduleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {hourOptions.map(hour => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select
                  name="minutosFin"
                  value={rescheduleData.minutosFin}
                  onChange={handleRescheduleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {minuteOptions.map(minute => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
              </div>
              {/* Opciones rápidas de duración */}
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => handleQuickDuration(15)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  15 min
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(30)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  30 min
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(45)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  45 min
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDuration(60)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  1 hora
                </button>
              </div>
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
    </>
  );
};

export default EventDetailsModal;
