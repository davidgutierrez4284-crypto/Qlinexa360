import React, { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, CalendarIcon, ClockIcon, UserIcon, VideoCameraIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import { getApiUrl, getApiHeaders } from '../../utils/api';

const CreateEventModal = ({ open, onClose, onSave, selectedDate, patients, supportsGoogleMeet, supportsTeams, doctorName }) => {
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    patientId: '',
    fecha: '',
    horaInicio: '09',
    minutosInicio: '00',
    horaFin: '10',
    minutosFin: '00',
    origenEvento: 'google',
    modalidadConsulta: 'presencial',
    linkMeeting: '',
    teleconsultationAmount: '',
    offerInPersonMercadoPago: false,
    inPersonPaymentAmount: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [mpChargePolicy, setMpChargePolicy] = useState({
    showAmountField: false,
    amountRequired: false,
    defaultAmount: 0,
    currency: 'MXN',
    inPersonShowOfferCheckbox: false,
    inPersonDefaultAmount: 0,
  });

  const loadMpChargePolicy = useCallback(async () => {
    try {
      const res = await axios.get(getApiUrl('/api/payments/mercadopago/teleconsultation-settings'), {
        headers: getApiHeaders(),
      });
      if (res.data?.success && res.data.chargePolicy) {
        setMpChargePolicy(res.data.chargePolicy);
      } else {
        setMpChargePolicy({
          showAmountField: false,
          amountRequired: false,
          defaultAmount: 0,
          currency: 'MXN',
        });
      }
    } catch {
      setMpChargePolicy({
        showAmountField: false,
        amountRequired: false,
        defaultAmount: 0,
        currency: 'MXN',
      });
    }
  }, []);

  useEffect(() => {
    if (open) loadMpChargePolicy();
  }, [open, loadMpChargePolicy]);

  const requiresTeleconsultationAmount =
    formData.modalidadConsulta === 'virtual' && mpChargePolicy.showAmountField;

  const canOfferInPersonMercadoPago =
    formData.modalidadConsulta === 'presencial' && mpChargePolicy.inPersonShowOfferCheckbox;

  // Cualquier cita (presencial o virtual) se sincroniza al calendario externo seleccionado para que el
  // paciente la reciba en su dispositivo. Si ese calendario no está enlazado, bloqueamos la creación.
  const selectedProviderConnected =
    formData.origenEvento === 'google'
      ? !!supportsGoogleMeet
      : formData.origenEvento === 'outlook'
        ? !!supportsTeams
        : true;

  useEffect(() => {
    if (selectedDate && open) {
      const date = new Date(selectedDate);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      setFormData(prev => ({
        ...prev,
        fecha: `${year}-${month}-${day}`,
        horaInicio: '09',
        minutosInicio: '00',
        horaFin: '10',
        minutosFin: '00'
      }));
      // Resetear el flag de edición manual cuando se abre el modal
      setTitleManuallyEdited(false);
    }
  }, [selectedDate, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia la hora de inicio, actualizar también la hora de fin con el mismo valor
    if (name === 'horaInicio' || name === 'minutosInicio') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        // Si cambia la hora de inicio, actualizar la hora de fin con el mismo valor
        horaFin: name === 'horaInicio' ? value : prev.horaFin,
        minutosFin: name === 'minutosInicio' ? value : prev.minutosFin
      }));
    } else if (name === 'patientId') {
      // Cuando se selecciona un paciente, pre-llenar título y descripción
      const selectedPatient = patients.find(p => p.id === value);
      const newFormData = {
        ...formData,
        [name]: value
      };
      
      // Pre-llenar título con el nombre del paciente (solo si no fue editado manualmente)
      if (selectedPatient && !titleManuallyEdited) {
        const patientFullName = `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim();
        newFormData.titulo = patientFullName;
      }
      
      // Pre-llenar descripción con "Cita con [título y nombre del profesional]"
      if (selectedPatient && doctorName) {
        const patientFullName = `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim();
        const titleForDescription = newFormData.titulo || patientFullName;
        newFormData.descripcion = `Cita con ${titleForDescription} y ${doctorName}`;
      } else if (!selectedPatient) {
        // Si no hay paciente, limpiar descripción
        newFormData.descripcion = '';
      }
      
      setFormData(newFormData);
    } else if (name === 'titulo') {
      // Marcar que el título fue editado manualmente
      setTitleManuallyEdited(true);
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
      
      // Actualizar descripción si hay paciente y doctor
      if (formData.patientId && doctorName) {
        const selectedPatient = patients.find(p => p.id === formData.patientId);
        if (selectedPatient) {
          const titleForDescription = value || `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim();
          setFormData(prev => ({
            ...prev,
            [name]: value,
            descripcion: `Cita con ${titleForDescription} y ${doctorName}`
          }));
          return; // Ya actualizamos, no necesitamos el setFormData de abajo
        }
      }
    } else if (name === 'modalidadConsulta') {
      setFormData((prev) => {
        const next = { ...prev, [name]: value };
        if (
          value === 'virtual' &&
          mpChargePolicy.showAmountField &&
          !prev.teleconsultationAmount &&
          mpChargePolicy.defaultAmount > 0
        ) {
          next.teleconsultationAmount = String(mpChargePolicy.defaultAmount);
        }
        if (value === 'presencial') {
          next.teleconsultationAmount = '';
          next.offerInPersonMercadoPago = false;
          next.inPersonPaymentAmount = '';
        }
        if (value === 'virtual') {
          next.offerInPersonMercadoPago = false;
          next.inPersonPaymentAmount = '';
        }
        return next;
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleQuickDuration = (minutes) => {
    const startHour = parseInt(formData.horaInicio);
    const startMinutes = parseInt(formData.minutosInicio);
    
    const startTotalMinutes = startHour * 60 + startMinutes;
    const endTotalMinutes = startTotalMinutes + minutes;
    
    const endHour = Math.floor(endTotalMinutes / 60) % 24;
    const endMinutes = endTotalMinutes % 60;
    
    setFormData(prev => ({
      ...prev,
      horaFin: String(endHour).padStart(2, '0'),
      minutosFin: String(Math.floor(endMinutes / 15) * 15).padStart(2, '0')
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.titulo.trim()) {
      newErrors.titulo = 'El título es obligatorio';
    }

    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }

    if (!formData.horaInicio || !formData.minutosInicio) {
      newErrors.horaInicio = 'La hora de inicio es obligatoria';
    }

    if (!formData.horaFin || !formData.minutosFin) {
      newErrors.horaFin = 'La hora de fin es obligatoria';
    }

    // Validar que la hora de fin sea posterior a la de inicio
    if (formData.horaInicio && formData.minutosInicio && formData.horaFin && formData.minutosFin) {
      const startTotalMinutes = parseInt(formData.horaInicio) * 60 + parseInt(formData.minutosInicio);
      const endTotalMinutes = parseInt(formData.horaFin) * 60 + parseInt(formData.minutosFin);
      
      if (endTotalMinutes <= startTotalMinutes) {
        newErrors.horaFin = 'La hora de fin debe ser posterior a la de inicio';
      }
    }

    if (requiresTeleconsultationAmount) {
      if (!formData.patientId) {
        newErrors.patientId = 'Selecciona un paciente para teleconsulta con cobro obligatorio';
      }
      const amount = parseFloat(formData.teleconsultationAmount);
      if (!formData.teleconsultationAmount || !Number.isFinite(amount) || amount <= 0) {
        newErrors.teleconsultationAmount = 'Indica el monto de teleconsulta (MXN)';
      }
    }

    if (canOfferInPersonMercadoPago && formData.offerInPersonMercadoPago) {
      if (!formData.patientId) {
        newErrors.patientId = 'Selecciona un paciente para ofrecer cobro con Mercado Pago';
      }
      const inPersonAmount = parseFloat(formData.inPersonPaymentAmount);
      if (!formData.inPersonPaymentAmount || !Number.isFinite(inPersonAmount) || inPersonAmount <= 0) {
        newErrors.inPersonPaymentAmount = 'Indica el monto de la consulta presencial (MXN)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setSaving(true);
    try {
      // Construir fechas completas
      const fechaHoraInicio = new Date(`${formData.fecha}T${formData.horaInicio}:${formData.minutosInicio}:00`);
      const fechaHoraFin = new Date(`${formData.fecha}T${formData.horaFin}:${formData.minutosFin}:00`);

      const eventData = {
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        patientId: formData.patientId || null,
        fechaHoraInicio: fechaHoraInicio.toISOString(),
        fechaHoraFin: fechaHoraFin.toISOString(),
        origenEvento: formData.origenEvento,
        modalidadConsulta: formData.modalidadConsulta,
        meetingPlatform: formData.modalidadConsulta === 'virtual' ? formData.origenEvento : null,
        linkMeeting: formData.modalidadConsulta === 'virtual' ? null : null,
        teleconsultationAmount: requiresTeleconsultationAmount
          ? parseFloat(formData.teleconsultationAmount)
          : null,
        offerInPersonMercadoPago:
          canOfferInPersonMercadoPago && formData.offerInPersonMercadoPago,
        inPersonPaymentAmount:
          canOfferInPersonMercadoPago && formData.offerInPersonMercadoPago
            ? parseFloat(formData.inPersonPaymentAmount)
            : null,
      };

      await onSave(eventData);
      // Resetear formulario
      setFormData({
        titulo: '',
        descripcion: '',
        patientId: '',
        fecha: '',
        horaInicio: '09',
        minutosInicio: '00',
        horaFin: '10',
        minutosFin: '00',
        origenEvento: 'google',
        modalidadConsulta: 'presencial',
        linkMeeting: '',
        teleconsultationAmount: '',
        offerInPersonMercadoPago: false,
        inPersonPaymentAmount: '',
      });
      setErrors({});
      setTitleManuallyEdited(false);
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setSaving(false);
    }
  };

  // Generar opciones de horas (0-23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  
  // Generar opciones de minutos (00, 15, 30, 45)
  const minuteOptions = ['00', '15', '30', '45'];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-semibold text-gray-900 flex items-center">
            <CalendarIcon className="h-6 w-6 mr-2 text-blue-600" />
            Crear Nueva Cita
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Paciente - Movido al principio */}
          <div>
            <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <UserIcon className="h-4 w-4 mr-1" />
              Paciente
            </label>
            <select
              id="patientId"
              name="patientId"
              value={formData.patientId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sin paciente (evento general)</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
            {errors.patientId && <p className="mt-1 text-sm text-red-600">{errors.patientId}</p>}
          </div>
          <div>
            <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 mb-2">
              Título de la cita <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="titulo"
              name="titulo"
              value={formData.titulo}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.titulo ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ej: Consulta médica, Revisión, etc."
            />
            {errors.titulo && <p className="mt-1 text-sm text-red-600">{errors.titulo}</p>}
          </div>

          {/* Fecha */}
          <div>
            <label htmlFor="fecha" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <CalendarIcon className="h-4 w-4 mr-1" />
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="fecha"
              name="fecha"
              value={formData.fecha}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.fecha ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.fecha && <p className="mt-1 text-sm text-red-600">{errors.fecha}</p>}
          </div>

          {/* Hora de inicio */}
          <div>
            <label htmlFor="horaInicio" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <ClockIcon className="h-4 w-4 mr-1" />
              Hora de inicio <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-2">
              <select
                id="horaInicio"
                name="horaInicio"
                value={formData.horaInicio}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.horaInicio ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {hourOptions.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span className="self-center text-gray-500">:</span>
              <select
                id="minutosInicio"
                name="minutosInicio"
                value={formData.minutosInicio}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.horaInicio ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {minuteOptions.map(minute => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
            </div>
            {errors.horaInicio && <p className="mt-1 text-sm text-red-600">{errors.horaInicio}</p>}
          </div>

          {/* Hora de fin con opciones rápidas */}
          <div>
            <label htmlFor="horaFin" className="block text-sm font-medium text-gray-700 mb-2">
              Hora de fin <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-2 mb-2">
              <select
                id="horaFin"
                name="horaFin"
                value={formData.horaFin}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.horaFin ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                {hourOptions.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span className="self-center text-gray-500">:</span>
              <select
                id="minutosFin"
                name="minutosFin"
                value={formData.minutosFin}
                onChange={handleChange}
                className={`flex-1 px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.horaFin ? 'border-red-500' : 'border-gray-300'
                }`}
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
            {errors.horaFin && <p className="mt-1 text-sm text-red-600">{errors.horaFin}</p>}
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              value={formData.descripcion}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Notas adicionales sobre la cita..."
            />
          </div>

          {/* Origen del evento */}
          <div>
            <label htmlFor="origenEvento" className="block text-sm font-medium text-gray-700 mb-2">
              Origen del evento <span className="text-red-500">*</span>
            </label>
            <select
              id="origenEvento"
              name="origenEvento"
              value={formData.origenEvento}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="google">Google Calendar</option>
              <option value="outlook">Outlook</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Selecciona el calendario externo para sincronizar la cita con el paciente
            </p>
            {!selectedProviderConnected && (
              <p className="mt-1 text-xs text-red-600">
                No tienes enlazado el calendario de {formData.origenEvento === 'google' ? 'Google' : 'Microsoft Outlook'}. Enlázalo en Configuración → Calendario para crear citas. Sin calendario, el paciente solo recibe correo y no ve la cita en su dispositivo.
              </p>
            )}
          </div>

          {/* Modalidad de consulta */}
          <div>
            <label htmlFor="modalidadConsulta" className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <VideoCameraIcon className="h-4 w-4 mr-1" />
              Modalidad de consulta
            </label>
            <select
              id="modalidadConsulta"
              name="modalidadConsulta"
              value={formData.modalidadConsulta}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="presencial">Consulta presencial</option>
              <option value="virtual">Sesión virtual</option>
            </select>
            {formData.modalidadConsulta === 'virtual' && selectedProviderConnected && (
              <p className="mt-1 text-xs text-gray-500">
                El link de la reunión se generará automáticamente desde el calendario configurado ({formData.origenEvento === 'google' ? 'Google Meet' : formData.origenEvento === 'outlook' ? 'Microsoft Teams' : 'Calendario externo'})
              </p>
            )}
          </div>

          {requiresTeleconsultationAmount && (
            <div>
              <label htmlFor="teleconsultationAmount" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <BanknotesIcon className="h-4 w-4 text-sky-600" />
                Monto teleconsulta (MXN) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="teleconsultationAmount"
                name="teleconsultationAmount"
                min="0"
                step="0.01"
                value={formData.teleconsultationAmount}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.teleconsultationAmount ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Ej. 500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Cobro obligatorio antes de generar el enlace de videollamada (Mercado Pago).
              </p>
              {errors.teleconsultationAmount && (
                <p className="mt-1 text-sm text-red-600">{errors.teleconsultationAmount}</p>
              )}
            </div>
          )}

          {canOfferInPersonMercadoPago && (
            <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  name="offerInPersonMercadoPago"
                  checked={formData.offerInPersonMercadoPago}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      offerInPersonMercadoPago: e.target.checked,
                      inPersonPaymentAmount:
                        e.target.checked && !prev.inPersonPaymentAmount && mpChargePolicy.inPersonDefaultAmount > 0
                          ? String(mpChargePolicy.inPersonDefaultAmount)
                          : prev.inPersonPaymentAmount,
                    }))
                  }
                />
                Ofrecer pago opcional con Mercado Pago (consulta presencial)
              </label>
              {formData.offerInPersonMercadoPago && (
                <div>
                  <label htmlFor="inPersonPaymentAmount" className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <BanknotesIcon className="h-4 w-4 text-sky-600" />
                    Monto consulta presencial (MXN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    id="inPersonPaymentAmount"
                    name="inPersonPaymentAmount"
                    min="0"
                    step="0.01"
                    value={formData.inPersonPaymentAmount}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.inPersonPaymentAmount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Opcional para el paciente: puede pagar en efectivo o en el consultorio sin usar la plataforma.
                  </p>
                  {errors.inPersonPaymentAmount && (
                    <p className="mt-1 text-sm text-red-600">{errors.inPersonPaymentAmount}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving || !selectedProviderConnected}
              title={!selectedProviderConnected ? 'Enlaza tu calendario para crear citas' : undefined}
            >
              {saving ? 'Guardando...' : 'Crear Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventModal;
