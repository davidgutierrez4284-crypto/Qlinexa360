import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getApiUrl } from '../utils/api';
import PhoneInput from '../components/common/PhoneInput';

const AgendarCita = () => {
  const { doctorUsername } = useParams();
  const [searchParams] = useSearchParams();
  const clinicalIntakeToken = searchParams.get('clinicalIntake');
  const [fromClinicalIntake, setFromClinicalIntake] = useState(false);
  const [motivoLockedFromIntake, setMotivoLockedFromIntake] = useState(false);
  const [intakePrefillLoading, setIntakePrefillLoading] = useState(!!clinicalIntakeToken);
  const [doctorInfo, setDoctorInfo] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [formData, setFormData] = useState({
    patientName: '', patientEmail: '', patientPhone: '', motivoConsulta: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [profileImageError, setProfileImageError] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [autoCloseIn, setAutoCloseIn] = useState(null);

  useEffect(() => {
    if (doctorUsername) fetchDoctorInfo();
  }, [doctorUsername]);

  useEffect(() => {
    if (!clinicalIntakeToken) {
      setIntakePrefillLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          getApiUrl(`/api/clinical-intakes/public/${clinicalIntakeToken}`)
        );
        const data = await response.json();
        if (cancelled || !data?.success) return;
        const patient = data.data?.formData?.patient || {};
        const health = data.data?.formData?.health || {};
        const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim();
        const motivoConsulta = String(health.motivoConsulta || '').trim();
        setFormData((prev) => ({
          ...prev,
          patientName,
          patientEmail: String(patient.email || '').trim(),
          patientPhone: String(patient.phone || '').trim(),
          motivoConsulta
        }));
        const hasCoreContact = !!(patientName && String(patient.email || '').trim());
        setFromClinicalIntake(hasCoreContact);
        setMotivoLockedFromIntake(!!motivoConsulta);
      } catch (error) {
        console.warn('No se pudo cargar pre-consulta para prellenar agenda:', error);
      } finally {
        if (!cancelled) setIntakePrefillLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clinicalIntakeToken]);

  useEffect(() => {
    if (selectedDate) {
      // Limpiar slots anteriores cuando cambia la fecha
      setAvailableSlots([]);
      setSelectedSlot(null);
      fetchAvailableSlots();
    } else {
      // Si no hay fecha seleccionada, limpiar slots
      setAvailableSlots([]);
      setSelectedSlot(null);
    }
  }, [selectedDate]);

  // Tras agendar desde una pre-consulta, autocerrar esta pestaña para que el paciente
  // regrese a terminar su pre-consulta (aceptar avisos + enviar) en la pestaña original.
  useEffect(() => {
    if (!appointmentSuccess || !clinicalIntakeToken) return;
    setAutoCloseIn(6);
    const interval = setInterval(() => {
      setAutoCloseIn((n) => {
        if (n === null) return null;
        if (n <= 1) {
          clearInterval(interval);
          try {
            window.close();
          } catch {
            /* el navegador puede bloquear el cierre; el botón manual cubre el caso */
          }
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [appointmentSuccess, clinicalIntakeToken]);

  const fetchDoctorInfo = async () => {
    setLoadError(null);
    try {
      const response = await fetch(getApiUrl(`/api/agenda-pacientes/doctor/${doctorUsername}`));
      const data = await response.json();
      if (data.success) {
        setDoctorInfo(data.data);
        setProfileImageError(false);
      }
      else {
        setLoadError('Link no válido o inactivo');
        toast.error('Link no válido o inactivo');
      }
    } catch (error) {
      setLoadError('Error al cargar la página. Verifica tu conexión e intenta de nuevo.');
      toast.error('Error al cargar información del doctor');
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/agenda-pacientes/doctor/${doctorUsername}/slots?fecha=${selectedDate}`));
      const data = await response.json();
      if (data.success) {
        const slots = (data.data || []).slice();
        slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setAvailableSlots(slots);
        // Si no hay horarios disponibles y hay un mensaje, mostrarlo
        if (data.data.length === 0 && data.message) {
          // No mostrar toast para evitar spam, solo actualizar el estado
        }
      } else {
        setAvailableSlots([]);
        if (data.error) toast.error(data.error);
      }
    } catch (error) {
      toast.error('Error al cargar horarios disponibles');
      setAvailableSlots([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!selectedSlot) {
      toast.error('Por favor selecciona un horario');
      return;
    }
    
    if (!formData.patientName || !formData.patientEmail || !formData.patientPhone || !formData.motivoConsulta) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      console.log('Enviando solicitud de cita:', {
        slotId: selectedSlot.id,
        patientName: formData.patientName,
        patientEmail: formData.patientEmail,
        patientPhone: formData.patientPhone,
        motivoConsulta: formData.motivoConsulta
      });
      
      const response = await fetch(getApiUrl(`/api/agenda-pacientes/doctor/${doctorUsername}/appointment`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slotId: selectedSlot.id, 
          patientName: formData.patientName,
          patientEmail: formData.patientEmail,
          patientPhone: formData.patientPhone,
          motivoConsulta: formData.motivoConsulta,
          ...(clinicalIntakeToken ? { clinicalIntakeToken } : {})
        })
      });

      console.log('Respuesta recibida:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Datos de respuesta:', data);
      
      // El backend retorna { success: true, data: {...} }
      if (data.success) {
        setAppointmentSuccess(true);
        // Avisar a la pestaña de la pre-consulta (mismo origen) que la cita ya se agendó,
        // para que resalte el último paso (aceptar avisos + enviar).
        if (clinicalIntakeToken && typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined') {
          try {
            const ch = new BroadcastChannel('qlinexa-preconsulta-agenda');
            ch.postMessage({ type: 'appointment-booked', clinicalIntake: clinicalIntakeToken });
            ch.close();
          } catch {
            /* canal no disponible; el mensaje en pantalla cubre el caso */
          }
        }
      } else {
        // Si hay error, puede estar en data.error o data.data?.error
        const errorMessage = data.error || data.data?.error || 'Error al agendar cita';
        toast.error(errorMessage);
        console.error('Error en respuesta:', data);
      }
    } catch (error) {
      console.error('Error al agendar cita:', error);
      toast.error(error.message || 'Error al agendar cita. Por favor intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Formato 24h con AM/PM para claridad (ej: "09:00 a.m." o "14:30 p.m.")
  const formatTime = (dateString) => {
    if (!dateString) return '';
    let date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    // Si viene solo "HH:mm", construir fecha para parsear correctamente
    if (isNaN(date.getTime()) && typeof dateString === 'string' && /^\d{1,2}:\d{2}/.test(dateString)) {
      date = new Date(`2000-01-01T${dateString}`);
    }
    if (isNaN(date.getTime())) return '';
    const h = date.getHours();
    const m = date.getMinutes();
    const pad = (n) => String(n).padStart(2, '0');
    const ampm = h < 12 ? 'a.m.' : 'p.m.';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${pad(h12)}:${pad(m)} ${ampm}`;
  };

  if (!doctorInfo) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          {loadError ? (
            <>
              <p className="text-red-600 mb-4">{loadError}</p>
              <button
                onClick={() => fetchDoctorInfo()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Reintentar
              </button>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Pantalla de éxito tras confirmar cita
  if (appointmentSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Cita agendada!</h2>
          {clinicalIntakeToken ? (
            <>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-left mb-5">
                <p className="text-sm font-semibold text-amber-900">Te falta 1 paso para terminar</p>
                <p className="mt-1 text-sm text-amber-800">
                  Tu cita quedó agendada, pero aún <span className="font-semibold">no has enviado tu
                  pre-consulta</span>. Vuelve a la pestaña anterior para <span className="font-semibold">aceptar
                  el aviso de privacidad y enviarla</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.close();
                  } catch {
                    /* el navegador puede bloquear el cierre */
                  }
                }}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700"
              >
                Volver a mi pre-consulta para terminar
              </button>
              <p className="mt-3 text-xs text-gray-500">
                {autoCloseIn !== null && autoCloseIn > 0
                  ? `Esta ventana se cerrará en ${autoCloseIn}s para que regreses a terminar…`
                  : 'Si esta ventana no se cierra sola, ciérrala y regresa a la pestaña anterior.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-gray-600 mb-6">
                Tu cita ha sido confirmada. Recibirás un recordatorio por correo.
              </p>
              <p className="text-sm text-gray-500 font-medium">Puedes cerrar esta ventana.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-4xl mx-auto py-8 px-4 flex-grow">
        {/* Header - contenedor fijo para evitar parpadeo al cargar foto */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-20 h-20 rounded-full border-2 border-blue-100 flex-shrink-0 overflow-hidden bg-gray-100 flex items-center justify-center">
              {doctorInfo.profilePicture && !profileImageError ? (
                <img 
                  src={doctorInfo.profilePicture} 
                  alt={doctorInfo.doctorName} 
                  className="w-full h-full object-cover"
                  onError={() => setProfileImageError(true)}
                />
              ) : (
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{doctorInfo.doctorName}</h1>
              <p className="text-gray-600">{doctorInfo.specialization}</p>
              {doctorInfo.mensajeCustom && <p className="text-gray-700 mt-2">{doctorInfo.mensajeCustom}</p>}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Calendario */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Selecciona fecha y horario</h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha de la cita</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {selectedDate && (
              <div>
                <h3 className="font-medium mb-3">Horarios disponibles</h3>
                {availableSlots.length === 0 ? (
                  <p className="text-gray-500">No hay horarios disponibles para esta fecha</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-3 text-center rounded-md border transition-colors ${
                          selectedSlot?.id === slot.id
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Formulario */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">
              {fromClinicalIntake ? 'Confirma tu cita' : 'Datos de contacto'}
            </h2>

            {intakePrefillLoading && (
              <p className="text-sm text-gray-500 mb-4">Cargando tus datos de la pre-consulta…</p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {fromClinicalIntake ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-gray-800 space-y-2">
                  <p className="font-medium text-blue-900">
                    Usaremos los datos que ya capturaste en tu pre-consulta
                  </p>
                  <p>
                    <span className="text-gray-500">Nombre:</span>{' '}
                    {formData.patientName || '—'}
                  </p>
                  <p>
                    <span className="text-gray-500">Email:</span>{' '}
                    {formData.patientEmail || '—'}
                  </p>
                  <p>
                    <span className="text-gray-500">Teléfono:</span>{' '}
                    {formData.patientPhone || '—'}
                  </p>
                  {motivoLockedFromIntake ? (
                    <p>
                      <span className="text-gray-500">Motivo:</span>{' '}
                      {formData.motivoConsulta}
                    </p>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Motivo de consulta *
                      </label>
                      <textarea
                        required
                        value={formData.motivoConsulta}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, motivoConsulta: e.target.value }))
                        }
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe brevemente el motivo de tu consulta..."
                      />
                    </div>
                  )}
                  <p className="text-xs text-blue-800 pt-1">
                    Solo elige fecha y horario. Si necesitas corregir algo, regresa al formulario de
                    pre-consulta antes de enviar.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                    <input
                      type="text"
                      required
                      value={formData.patientName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, patientName: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.patientEmail}
                      onChange={(e) => setFormData((prev) => ({ ...prev, patientEmail: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <PhoneInput
                      name="patientPhone"
                      label="Teléfono *"
                      value={formData.patientPhone}
                      onChange={(e) => setFormData((prev) => ({ ...prev, patientPhone: e.target.value }))}
                      required
                      placeholder="Ej: 55 1234 5678"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de consulta *</label>
                    <textarea
                      required
                      value={formData.motivoConsulta}
                      onChange={(e) => setFormData((prev) => ({ ...prev, motivoConsulta: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe brevemente el motivo de tu consulta..."
                    />
                  </div>
                </>
              )}

              {selectedSlot && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Horario seleccionado:</strong> {formatTime(selectedSlot.startTime)}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={!selectedSlot || loading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-70 disabled:cursor-wait disabled:hover:bg-blue-600"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Agendando...
                  </span>
                ) : (
                  'Confirmar cita'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Información */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-3">Información importante</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Llega 10 minutos antes de tu cita</li>
            <li>• Trae tu identificación</li>
            <li>• Si necesitas cancelar, contacta al doctor con al menos 24 horas de anticipación</li>
            <li>• Recibirás confirmación por email</li>
          </ul>
        </div>
      </div>

      {/* Cenefa con logo y nombre de Qlinexa360 */}
      <div className="bg-blue-600 text-white py-4 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center space-x-3">
          <img
            src="/logo.svg"
            alt="Qlinexa360"
            className="h-6 w-6"
          />
          <span className="text-lg font-semibold">Qlinexa360</span>
        </div>
      </div>
    </div>
  );
};

export default AgendarCita; 