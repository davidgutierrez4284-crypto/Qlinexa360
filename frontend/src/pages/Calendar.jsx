import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { 
  PlusIcon, 
  CalendarIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';
import CreateEventModal from '../components/Calendar/CreateEventModal';
import EventDetailsModal from '../components/calendar/EventDetailsModal.jsx';
import OptimizedCalendarConfig from '../components/medical/OptimizedCalendarConfig';
import ConfirmationDashboard from '../components/appointments/ConfirmationDashboard';
import WaitlistManager from '../components/appointments/WaitlistManager';
import CancellationManager from '../components/appointments/CancellationManager';
import AgendaConfig from '../components/medical/AgendaConfig';
import Loader from '../components/common/Loader';

const Calendar = () => {
  const [events, setEvents] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeSection, setActiveSection] = useState('calendar'); // calendar, config, share, confirmations, waitlist, cancellations
  const calendarRef = useRef(null); // Referencia al calendario para recargar eventos
  const [filters, setFilters] = useState({
    patientId: '',
    origenEvento: '',
    viewType: typeof window !== 'undefined' && window.innerWidth < 640 ? 'listWeek' : 'dayGridMonth'
  });
  // Los filtros siempre están visibles, no necesitamos estado para controlarlos
  const [patients, setPatients] = useState([]);
  const [searchParams] = useSearchParams();
  const [providerStatus, setProviderStatus] = useState({
    google: false,
    outlook: false,
    apple: false
  });
  const [scheduleConfig, setScheduleConfig] = useState(null);
  const [doctorName, setDoctorName] = useState('');

  // Cargar nombre del doctor
  useEffect(() => {
    const fetchDoctorName = async () => {
      try {
        const response = await axios.get('/api/doctors/profile', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.data?.data) {
          const doctor = response.data.data;
          const fullName = `${doctor.user?.firstName || ''} ${doctor.user?.lastName || ''}`.trim();
          setDoctorName(fullName);
        }
      } catch (error) {
        console.error('Error al cargar nombre del doctor:', error);
      }
    };
    fetchDoctorName();
  }, []);

  // Cargar pacientes (sin bloquear la carga del calendario)
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        // Timeout para evitar cargas infinitas
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 segundos timeout
        
        const response = await axios.get('/api/doctors/my-patients', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
          signal: controller.signal,
          timeout: 8000
        });
        
        clearTimeout(timeoutId);

        // my-patients devuelve una fila por caso clínico: unificar por paciente (mismo criterio que Dashboard / Billing)
        const raw = Array.isArray(response.data) ? response.data : [];
        const uniqueRaw = raw.reduce((acc, p) => {
          if (!acc.some(x => x.id === p.id)) acc.push(p);
          return acc;
        }, []);

        const formattedPatients = uniqueRaw.map(patient => ({
          id: patient.id,
          firstName: patient.firstName || patient.user?.firstName || '',
          lastName: patient.lastName || patient.user?.lastName || '',
          email: patient.email || patient.user?.email || '',
          phone: patient.phone || patient.user?.phone || ''
        }));
        setPatients(formattedPatients);
      } catch (error) {
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
          console.warn('Timeout al cargar pacientes - continuando sin ellos');
          // No mostrar error, simplemente continuar sin pacientes en los filtros
          setPatients([]);
        } else {
          console.error('Error al cargar pacientes:', error);
          // No bloquear la UI con error toast si falla la carga de pacientes
          setPatients([]);
        }
      }
    };
    fetchPatients();
  }, []);

  const fetchProviderStatus = useCallback(async () => {
    try {
      const response = await axios.get('/api/calendar-sync/sync-status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.data?.success) {
        const data = response.data.data || {};
        const nextStatus = {
          google: !!data.google?.connected,
          outlook: !!data.outlook?.connected,
          apple: !!data.apple?.connected
        };
        setProviderStatus(prev => {
          const unchanged =
            prev.google === nextStatus.google &&
            prev.outlook === nextStatus.outlook &&
            prev.apple === nextStatus.apple;
          return unchanged ? prev : nextStatus;
        });
      }
    } catch (error) {
      console.error('Error fetching calendar sync status:', error);
    }
  }, []);

  useEffect(() => {
    fetchProviderStatus();
  }, [fetchProviderStatus]);

  // Cargar configuración de horarios
  useEffect(() => {
    const loadScheduleConfig = async () => {
      try {
        const response = await axios.get('/api/schedule/config', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (response.data?.success && response.data.data) {
          setScheduleConfig(response.data.data);
        }
      } catch (error) {
        console.error('Error al cargar configuración de horarios:', error);
        // No mostrar error, simplemente no mostrar bloques de disponibilidad
      }
    };
    loadScheduleConfig();
  }, []);

  useEffect(() => {
    const handleProviderMessage = (event) => {
      if (!event?.data?.type) return;
      const { type } = event.data;
      if (
        type === 'CALENDAR_AUTH_SUCCESS' ||
        type === 'CALENDAR_AUTH_ERROR' ||
        type === 'CALENDAR_SYNC_SUCCESS'
      ) {
        fetchProviderStatus();
      }
    };

    window.addEventListener('message', handleProviderMessage);
    return () => window.removeEventListener('message', handleProviderMessage);
  }, [fetchProviderStatus]);

  // Prefiltrar por paciente desde query param
  useEffect(() => {
    const qp = searchParams.get('patientId');
    if (qp) {
      setFilters(prev => ({ ...prev, patientId: qp }));
    }
  }, [searchParams]);

  // Generar eventos de fondo para horarios de disponibilidad
  const generateAvailabilityEvents = (info, scheduleConfig) => {
    if (!scheduleConfig || !scheduleConfig.weeklySchedule || !info?.start || !info?.end) {
      return [];
    }

    const availabilityEvents = [];
    const weeklySchedule = scheduleConfig.weeklySchedule;
    
    // Mapeo de días de la semana (FullCalendar usa 0=domingo, 1=lunes, etc.)
    const dayMap = {
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6,
      'sunday': 0
    };

    // Iterar sobre cada día en el rango de fechas visible
    const currentDate = new Date(info.start);
    const endDate = new Date(info.end);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay(); // 0=domingo, 1=lunes, etc.
      const dayName = Object.keys(dayMap).find(key => dayMap[key] === dayOfWeek);
      
      if (dayName && weeklySchedule[dayName] && Array.isArray(weeklySchedule[dayName])) {
        weeklySchedule[dayName].forEach((timeSlot, index) => {
          if (timeSlot.startTime && timeSlot.endTime) {
            // Crear fecha combinando la fecha actual con la hora del slot
            const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
            const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);
            
            const slotStart = new Date(currentDate);
            slotStart.setHours(startHour, startMinute, 0, 0);
            
            const slotEnd = new Date(currentDate);
            slotEnd.setHours(endHour, endMinute, 0, 0);
            
            // Solo agregar si el slot está dentro del rango visible (con un margen de tolerancia)
            const infoStart = new Date(info.start);
            const infoEnd = new Date(info.end);
            // Agregar si el slot se solapa con el rango visible
            if (slotStart < infoEnd && slotEnd > infoStart) {
              availabilityEvents.push({
                id: `availability-${currentDate.toISOString().split('T')[0]}-${index}`,
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
                display: 'background',
                backgroundColor: '#E0F2FE', // Azul claro para disponibilidad
                borderColor: '#BAE6FD',
                classNames: ['availability-block'],
                extendedProps: {
                  isAvailability: true
                }
              });
            }
          }
        });
      }
      
      // Avanzar al siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return availabilityEvents;
  };

  // Función para obtener color según si tiene paciente y estado de confirmación
  // Todos los eventos provienen de calendarios externos (Google, Outlook, Apple)
  const getEventColor = (hasPatient, confirmationStatus = null, calendarHighlight = 'normal') => {
    if (!hasPatient) {
      return '#9CA3AF';
    }
    if (
      confirmationStatus === 'CANCELLED' ||
      calendarHighlight === 'cancelled' ||
      calendarHighlight === 'refund_pending' ||
      calendarHighlight === 'refunded'
    ) {
      return '#DC2626';
    }
    if (confirmationStatus === 'CONFIRMED') {
      return '#22C55E';
    }
    return '#FCA5A5';
  };

  // Cargar eventos del calendario
  const fetchEvents = useCallback(async (info = null) => {
    try {
      // Si ya se cargaron eventos y no hay cambios en los filtros, retornar eventos existentes
      // (optimización para evitar cargas innecesarias)
      
      const params = new URLSearchParams();
      
      // Siempre proporcionar un rango de fechas para evitar consultas sin límite
      // Si FullCalendar proporciona info con fechas, usarlas
      // Si no, usar un rango por defecto razonable (mes actual + 1 mes antes/después)
      let startDate;
      let endDate;

      if (info?.start && info?.end) {
        startDate = new Date(info.start);
        endDate = new Date(info.end);
        // Agregar un buffer de 1 día antes y después para mejor UX
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() + 1);
      } else {
        // Rango por defecto: 1 mes antes y 2 meses después del mes actual
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 3, 0, 23, 59, 59);
      }
      
      params.append('start', startDate.toISOString());
      params.append('end', endDate.toISOString());
      
      // Aplicar filtros
      if (filters.origenEvento) params.append('origenEvento', filters.origenEvento);
      if (filters.patientId) params.append('patientId', filters.patientId);

      // Agregar timestamp para evitar caché y obtener datos actualizados
      params.append('_t', Date.now().toString());
      
      // No enviar Cache-Control/Pragma: en cross-origin (www → api) obligan un preflight
      // que fallaba si el backend no listaba esas cabeceras en CORS. El query _t evita caché.
      const response = await axios.get(`/api/calendar/events?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 8000
      });

      // Verificar que response.data sea un array
      if (!Array.isArray(response.data)) {
        console.warn('La respuesta del servidor no es un array:', response.data);
        return [];
      }

      // Transformar eventos para FullCalendar
      const calendarEvents = response.data.map(event => {
        // Verificar si el evento tiene un paciente asociado
        const hasPatient = !!(event.patientId || event.patient);
        const color = getEventColor(hasPatient, event.confirmationStatus, event.calendarHighlight);
        
        let eventTitle = event.titulo;
        if (hasPatient && event.confirmationStatus === 'CANCELLED') {
          eventTitle = `❌ Cita cancelada: ${event.titulo}`;
        } else if (hasPatient && event.calendarHighlight === 'refund_pending') {
          eventTitle = `🔴 Reembolso solicitado: ${event.titulo}`;
        } else if (hasPatient && event.calendarHighlight === 'refunded') {
          eventTitle = `↩ Reembolsado: ${event.titulo}`;
        } else if (hasPatient && event.paymentLabel) {
          eventTitle = `${event.titulo} · ${event.paymentLabel}`;
        }
        
        return {
          id: event.id,
          title: eventTitle,
          start: event.fechaHoraInicio,
          end: event.fechaHoraFin,
          extendedProps: {
            titulo: event.titulo, // Guardar el título original sin el prefijo del estatus
            descripcion: event.descripcion,
            origenEvento: event.origenEvento,
            appointmentType: event.appointmentType || null,
            teleconsultationAmount: event.teleconsultationAmount ?? null,
            linkMeeting: event.linkMeeting,
            meetingUrl: event.meetingUrl ?? null,
            patient: event.patient,
            doctor: event.doctor,
            externalProvider: event.externalProvider,
            externalEventId: event.externalEventId,
            externalUpdatedAt: event.externalUpdatedAt,
            confirmationStatus: event.confirmationStatus,
            appointmentId: event.appointmentId || null,
            mpPaymentStatus: event.mpPaymentStatus || null,
            refundRequestStatus: event.refundRequestStatus || null,
            paymentLabel: event.paymentLabel || null,
            calendarHighlight: event.calendarHighlight || 'normal',
          },
          backgroundColor: color, // Usar siempre el color basado en confirmationStatus
          borderColor: color,
          textColor: '#ffffff'
        };
      });

      // Ya no filtramos eventos internos, mostramos todos los eventos
      const filteredEvents = calendarEvents;

      // Generar eventos de fondo para horarios de disponibilidad
      const availabilityEvents = generateAvailabilityEvents(info, scheduleConfig);
      
      // Combinar eventos normales con eventos de disponibilidad
      return [...filteredEvents, ...availabilityEvents];
    } catch (error) {
      console.error('Error al cargar eventos:', error);
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('Tiempo de espera agotado. Intenta nuevamente.');
      } else if (error.response?.status === 401) {
        toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        toast.error('Error al cargar eventos del calendario');
      }
      return [];
    }
  }, [filters.origenEvento, filters.patientId, scheduleConfig]);

  // Recargar eventos cuando cambian los filtros (excepto viewType que no afecta los datos)
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      if (calendarApi) {
        calendarApi.refetchEvents();
      }
    }
  }, [filters.patientId, filters.origenEvento]);

  // Cambiar vista del calendario cuando el usuario selecciona otra en el dropdown
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      if (calendarApi) {
        calendarApi.changeView(filters.viewType);
      }
    }
  }, [filters.viewType]);

  // Sincronización automática periódica de calendarios (cada 7.5 minutos = 450,000ms)
  // Solo cuando el usuario está en la sección de calendario
  useEffect(() => {
    if (activeSection !== 'calendar') {
      return; // No sincronizar si no está en la sección de calendario
    }

    const syncAllCalendars = async () => {
      try {
        // Sincronizar todos los calendarios conectados en segundo plano (sin mostrar notificaciones)
        const connectedProviders = Object.keys(providerStatus).filter(
          provider => providerStatus[provider]
        );

        if (connectedProviders.length === 0) {
          return; // No hay calendarios conectados, no hacer nada
        }

        // Sincronizar cada proveedor conectado
        const syncPromises = connectedProviders.map(async (provider) => {
          try {
            await axios.post(`/api/calendar-sync/sync/${provider}`, {}, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              timeout: 30000 // Timeout de 30 segundos para sincronización
            });
          } catch (error) {
            // Silenciar errores de sincronización automática para no molestar al usuario
            console.log(`Sincronización automática de ${provider} falló (no crítico):`, error.message);
          }
        });

        await Promise.allSettled(syncPromises);

        // Después de sincronizar, refrescar los eventos del calendario
        if (calendarRef.current) {
          const calendarApi = calendarRef.current.getApi();
          if (calendarApi) {
            calendarApi.refetchEvents();
          }
        }

        // Actualizar el estado de los proveedores
        fetchProviderStatus();
      } catch (error) {
        console.error('Error en sincronización automática:', error);
        // No mostrar error al usuario, es una sincronización en segundo plano
      }
    };

    // Sincronizar inmediatamente cuando se monta el componente (si está en la sección de calendario)
    // Y luego cada 7.5 minutos (450,000ms = 7.5 minutos)
    const syncInterval = setInterval(syncAllCalendars, 450000); // 7.5 minutos
    
    // Sincronizar inmediatamente después de 2 segundos (para dar tiempo a que la página cargue)
    const initialSyncTimeout = setTimeout(() => {
      syncAllCalendars();
    }, 2000);

    return () => {
      clearInterval(syncInterval);
      clearTimeout(initialSyncTimeout);
    };
  }, [activeSection, providerStatus, fetchProviderStatus]);
  
  // Manejar el cambio de vista del calendario
  const handleViewChange = (view) => {
    if (view.view && calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      if (calendarApi) {
        // Actualizar la vista y recargar eventos con el nuevo rango
        calendarApi.changeView(filters.viewType);
        calendarApi.refetchEvents();
      }
    }
  };

  // Manejar clic en fecha
  const handleDateClick = (arg) => {
    setSelectedDate(arg.date);
    setShowCreateModal(true);
  };

  // Manejar clic en evento
  const handleEventClick = (arg) => {
    setSelectedEvent(arg.event);
    setShowEventModal(true);
  };

  // Crear nuevo evento
  const handleCreateEvent = async (eventData) => {
    try {
      const response = await axios.post('/api/calendar/events', eventData, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Evento creado correctamente');
      if (response.data?.calendarSyncWarning) {
        toast.warn(response.data.calendarSyncWarning, { autoClose: 10000 });
      }
      setShowCreateModal(false);
      // Recargar eventos del calendario
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        if (calendarApi) {
          calendarApi.refetchEvents();
        }
      }
    } catch (error) {
      console.error('Error al crear evento:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear evento';
      toast.error(errorMessage);
    }
  };

  // Actualizar evento
  const handleUpdateEvent = async (eventId, eventData) => {
    try {
      const response = await axios.put(`/api/calendar/events/${eventId}`, eventData, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Evento actualizado correctamente');
      if (response.data?.calendarSyncWarning) {
        toast.warn(response.data.calendarSyncWarning, { autoClose: 10000 });
      }
      setShowEventModal(false);
      // Recargar eventos del calendario
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        if (calendarApi) {
          calendarApi.refetchEvents();
        }
      }
    } catch (error) {
      console.error('Error al actualizar evento:', error);
      const errorMessage = error.response?.data?.message || 'Error al actualizar evento';
      toast.error(errorMessage);
    }
  };

  // Eliminar evento
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este evento?')) {
      return;
    }

    try {
      await axios.delete(`/api/calendar/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      toast.success('Evento eliminado correctamente');
      setShowEventModal(false);
      // Recargar eventos del calendario
      if (calendarRef.current) {
        const calendarApi = calendarRef.current.getApi();
        if (calendarApi) {
          calendarApi.refetchEvents();
        }
      }
    } catch (error) {
      console.error('Error al eliminar evento:', error);
      const errorMessage = error.response?.data?.message || 'Error al eliminar evento';
      toast.error(errorMessage);
    }
  };

  // Compartir evento por email
  // TODO: Preparado para agregar WhatsApp en el futuro - se puede agregar opción de canal
  const handleShareEvent = async (event) => {
    // El evento puede venir del modal (event) o de FullCalendar (event.event)
    const calendarEvent = event.event || event;
    const eventId = calendarEvent.id;
    
    if (!eventId) {
      toast.error('No se pudo identificar el evento');
      return;
    }

    try {
      // Mostrar indicador de carga
      const loadingToast = toast.loading('Enviando información de la cita por email...');
      
      const response = await axios.post(`/api/calendar/events/${eventId}/share`, {}, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      toast.dismiss(loadingToast);
      
      if (response.data.success) {
        toast.success('Información de la cita enviada por email correctamente');
        
        // TODO: En el futuro, cuando se agregue WhatsApp, aquí se puede mostrar:
        // if (response.data.channel === 'whatsapp') {
        //   toast.success('Información de la cita enviada por WhatsApp correctamente');
        // } else {
        //   toast.success('Información de la cita enviada por email correctamente');
        // }
      } else {
        toast.error('Error al enviar la información de la cita');
      }
    } catch (error) {
      console.error('Error al compartir evento:', error);
      const errorMessage = error.response?.data?.message || 'Error al enviar la información de la cita';
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calendario</h1>
            <p className="text-gray-600 mt-1">Gestiona tus citas y eventos médicos</p>
          </div>
          
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            {/* Botón de crear evento */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Nueva cita
            </button>
          </div>
        </div>

        {/* Navegación por pestañas - scroll horizontal en móvil */}
        <div className="border-b border-gray-200 mb-6 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0 pb-px">
            <button
              onClick={() => setActiveSection('calendar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                activeSection === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📅 Calendario
            </button>
            <button
              onClick={() => setActiveSection('config')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                activeSection === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ⚙️ Configuración
            </button>
            <button
              onClick={() => setActiveSection('share')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                activeSection === 'share'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🔗 Compartir Agenda
            </button>
            <button
              onClick={() => setActiveSection('confirmations')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                activeSection === 'confirmations'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              ✅ Confirmaciones
            </button>
                         <button
               onClick={() => setActiveSection('waitlist')}
               className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                 activeSection === 'waitlist'
                   ? 'border-blue-500 text-blue-600'
                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
               }`}
             >
               ⏳ Lista de Espera
             </button>
             <button
               onClick={() => setActiveSection('cancellations')}
               className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                 activeSection === 'cancellations'
                   ? 'border-blue-500 text-blue-600'
                   : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
               }`}
             >
               ❌ Cancelaciones
             </button>
          </nav>
        </div>

        {/* Contenido según sección activa */}
        {activeSection === 'calendar' && (
          <>
            {/* Filtros - siempre visibles */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paciente
                    </label>
                    <select
                      value={filters.patientId}
                      onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los pacientes</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origen del evento
                    </label>
                    <select
                      value={filters.origenEvento}
                      onChange={(e) => setFilters(prev => ({ ...prev, origenEvento: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="google">Google Calendar</option>
                      <option value="outlook">Outlook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vista
                    </label>
                    <select
                      value={filters.viewType}
                      onChange={(e) => setFilters(prev => ({ ...prev, viewType: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="dayGridMonth">Mes</option>
                      <option value="timeGridWeek">Semana</option>
                      <option value="timeGridDay">Día</option>
                      <option value="listWeek">Lista por semana</option>
                      <option value="listDay">Lista por día</option>
                    </select>
                  </div>
                </div>
              </div>

            {/* Calendario - en móvil vertical usar vista Lista por defecto para mejor legibilidad */}
            <div className="bg-white rounded-lg shadow min-w-0 overflow-hidden">
              <div className="p-2 sm:p-4">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                    initialView={filters.viewType}
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: ''
                    }}
                    events={(info, successCallback, failureCallback) => {
                      // Cargar eventos de forma asíncrona
                      fetchEvents(info)
                        .then((events) => {
                          successCallback(events);
                        })
                        .catch((error) => {
                          console.error('Error en fetchEvents:', error);
                          failureCallback(error);
                        });
                    }}
                    datesSet={(dateInfo) => {
                      // Este callback se llama cuando cambian las fechas visibles
                      // Útil para debugging (solo en desarrollo)
                    }}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    height="auto"
                    locale="es"
                    buttonText={{
                      today: 'Hoy',
                      month: 'Mes',
                      week: 'Semana',
                      day: 'Día',
                      list: 'Lista',
                      listWeek: 'Lista semana',
                      listDay: 'Lista día'
                    }}
                    dayHeaderFormat={{ weekday: 'short' }}
                    slotMinTime="07:00:00"
                    slotMaxTime="20:00:00"
                    allDaySlot={false}
                    slotDuration="00:30:00"
                    selectable={true}
                    editable={false}
                    selectMirror={true}
                    dayMaxEvents={true}
                    weekends={true}
                    firstDay={1} // Lunes
                    lazyFetching={true} // Solo cargar eventos cuando sea necesario
                    eventDisplay="block"
                  />
                </div>
                
                {/* Leyenda de colores */}
                <div className="px-4 pb-4 border-t border-gray-200 pt-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-medium text-gray-700">Leyenda:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9CA3AF' }}></div>
                      <span className="text-gray-600">Eventos externos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#FCA5A5' }}></div>
                      <span className="text-gray-600">Citas aún no confirmadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22C55E' }}></div>
                      <span className="text-gray-600">Citas aceptadas por los pacientes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: '#DC2626' }}></div>
                      <span className="text-gray-600">Cancelada / reembolso solicitado</span>
                    </div>
                  </div>
                </div>
            </div>
          </>
        )}

        {/* Sección de Configuración */}
        {activeSection === 'config' && (
          <OptimizedCalendarConfig />
        )}

        {/* Sección de Compartir Agenda (Calendly-like) */}
        {activeSection === 'share' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                🔗 Compartir Agenda con Pacientes
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Activa tu link personalizado para que tus pacientes puedan agendar citas directamente desde tu calendario disponible.
              </p>
              <AgendaConfig />
            </div>
          </div>
        )}

        {/* Sección de Confirmaciones */}
        {activeSection === 'confirmations' && (
          <>
            {/* Filtros - siempre visibles */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paciente
                    </label>
                    <select
                      value={filters.patientId}
                      onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los pacientes</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origen del evento
                    </label>
                    <select
                      value={filters.origenEvento}
                      onChange={(e) => setFilters(prev => ({ ...prev, origenEvento: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="externo">Externo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vista
                    </label>
                    <select
                      value={filters.viewType}
                      onChange={(e) => setFilters(prev => ({ ...prev, viewType: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="dayGridMonth">Mes</option>
                      <option value="timeGridWeek">Semana</option>
                      <option value="timeGridDay">Día</option>
                      <option value="listWeek">Lista por semana</option>
                      <option value="listDay">Lista por día</option>
                    </select>
                  </div>
                </div>
              </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  ✅ Dashboard de Confirmaciones
                </h3>
                <ConfirmationDashboard />
              </div>
            </div>
          </>
        )}

        {/* Sección de Lista de Espera */}
        {activeSection === 'waitlist' && (
          <>
            {/* Filtros - siempre visibles */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paciente
                    </label>
                    <select
                      value={filters.patientId}
                      onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los pacientes</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origen del evento
                    </label>
                    <select
                      value={filters.origenEvento}
                      onChange={(e) => setFilters(prev => ({ ...prev, origenEvento: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="google">Google Calendar</option>
                      <option value="outlook">Outlook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vista
                    </label>
                    <select
                      value={filters.viewType}
                      onChange={(e) => setFilters(prev => ({ ...prev, viewType: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="dayGridMonth">Mes</option>
                      <option value="timeGridWeek">Semana</option>
                      <option value="timeGridDay">Día</option>
                      <option value="listWeek">Lista por semana</option>
                      <option value="listDay">Lista por día</option>
                    </select>
                  </div>
                </div>
              </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  ⏳ Gestión de Lista de Espera
                </h3>
                <WaitlistManager />
              </div>
            </div>
          </>
        )}

        {/* Sección de Cancelaciones */}
        {activeSection === 'cancellations' && (
          <>
            {/* Filtros - siempre visibles */}
            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Paciente
                    </label>
                    <select
                      value={filters.patientId}
                      onChange={(e) => setFilters(prev => ({ ...prev, patientId: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los pacientes</option>
                      {patients.map(patient => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origen del evento
                    </label>
                    <select
                      value={filters.origenEvento}
                      onChange={(e) => setFilters(prev => ({ ...prev, origenEvento: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="google">Google Calendar</option>
                      <option value="outlook">Outlook</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Vista
                    </label>
                    <select
                      value={filters.viewType}
                      onChange={(e) => setFilters(prev => ({ ...prev, viewType: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="dayGridMonth">Mes</option>
                      <option value="timeGridWeek">Semana</option>
                      <option value="timeGridDay">Día</option>
                      <option value="listWeek">Lista por semana</option>
                      <option value="listDay">Lista por día</option>
                    </select>
                  </div>
                </div>
              </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  ❌ Gestión de Cancelaciones
                </h3>
                <CancellationManager />
              </div>
            </div>
          </>
        )}

        {/* Modales */}
        {showCreateModal && (
          <CreateEventModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onSave={handleCreateEvent}
            selectedDate={selectedDate}
            patients={patients}
            supportsGoogleMeet={providerStatus.google}
            supportsTeams={providerStatus.outlook}
            doctorName={doctorName}
          />
        )}

        {showEventModal && selectedEvent && (
          <EventDetailsModal
            open={showEventModal}
            onClose={() => setShowEventModal(false)}
            event={selectedEvent}
            onUpdate={handleUpdateEvent}
            onDelete={handleDeleteEvent}
            onShare={handleShareEvent}
            patients={patients}
            supportsGoogleMeet={providerStatus.google}
            supportsTeams={providerStatus.outlook}
          />
        )}
      </div>
    </div>
  );
};

export default Calendar; 