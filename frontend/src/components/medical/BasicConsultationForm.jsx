import React, { useState, useRef } from 'react';
import SmartForm from './SmartForm';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';

// --- Componente Tooltip ---
const Tooltip = ({ text, children }) => (
  <div className="relative flex items-center group">
    {children}
    <div className="absolute bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
      {text}
    </div>
  </div>
);

// --- Componente Principal ---
const BasicConsultationForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  patientName, 
  padecimiento, 
  initialData = {}, 
  readOnly = false,
  asFullPage = false
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const BASIC_FORM_KEYS = ['fecha', 'motivoConsulta', 'evolucionClinica', 'etiquetas', 'notas', 'notaPublica'];
  const getInitialSpecialtyData = () => {
    if (!initialData.formData || typeof initialData.formData !== 'object') return {};
    const fd = initialData.formData;
    return Object.fromEntries(Object.entries(fd).filter(([k]) => !BASIC_FORM_KEYS.includes(k)));
  };
  const [specialtyFormData] = useState(getInitialSpecialtyData);
  // Refs con datos más recientes (para submit sin re-render del padre al teclear)
  const latestSpecialtyRef = useRef(getInitialSpecialtyData());
  const latestDoctorCustomRef = useRef(initialData.doctorCustomFormData || []);
  // No subir specialtyFormData al state en cada tecla: evita re-render del modal/página
  // y saltos de scroll mientras se escribe en formularios de especialidad.

  // Función para obtener la fecha actual en formato YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Función para normalizar la fecha
  const normalizeDate = (dateValue) => {
    if (!dateValue) return getCurrentDate();
    
    if (typeof dateValue === 'string') {
      if (dateValue.includes('T')) {
        const date = new Date(dateValue);
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else if (dateValue.includes('-')) {
        return dateValue;
      } else {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    } else if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return getCurrentDate();
  };

  // Normalizar la fecha inicial
  const normalizedInitialDate = normalizeDate(initialData.date);

  // Estados para campos editables
  // Refs para campos de texto: evitan re-renders al escribir (elimina saltos de pantalla)
  const reasonRef = useRef(null);
  const notesRef = useRef(null);
  const tagsRef = useRef(null);
  const [date, setDate] = readOnly ? [normalizedInitialDate, undefined] : useState(normalizedInitialDate);
  const [reason, setReason] = readOnly ? [initialData.reason, undefined] : useState(initialData.reason || '');
  const [tags, setTags] = readOnly ? [Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '', undefined] : useState(initialData.tags ? initialData.tags.join(', ') : '');
  const [notes, setNotes] = readOnly ? [initialData.notes, undefined] : useState(initialData.notes || '');
  const [isPublic, setIsPublic] = readOnly ? [initialData.isPublic !== undefined ? initialData.isPublic : false, undefined] : useState(initialData.isPublic !== undefined ? initialData.isPublic : false);
  const [clinicalEvolution, setClinicalEvolution] = readOnly ? [initialData.clinicalEvolution, undefined] : useState(initialData.clinicalEvolution || '');

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting || readOnly) return;

    // Leer de refs (inputs no controlados) para evitar re-renders al escribir
    const reasonVal = reasonRef.current?.value ?? reason;
    const notesVal = notesRef.current?.value ?? notes;
    const tagsVal = tagsRef.current?.value ?? tags;

    // Validaciones básicas
    if (!clinicalEvolution) {
      toast.error('Debe seleccionar la evolución clínica del paciente.');
      return;
    }
    if (!reasonVal?.trim()) {
      toast.error('Debe capturar el motivo de la consulta.');
      return;
    }
    if (!notesVal?.trim()) {
      toast.error('Debe capturar las notas o diagnóstico.');
      return;
    }

    setIsSubmitting(true);

    const processedTags = (tagsVal || '').split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);

    const consultationData = {
      date,
      reason: reasonVal.trim(),
      notes: notesVal.trim(),
      isPublic,
      clinicalEvolution,
      tags: processedTags,
      formData: {
        fecha: date,
        motivoConsulta: reasonVal.trim(),
        evolucionClinica: clinicalEvolution,
        etiquetas: processedTags,
        notas: notesVal.trim(),
        notaPublica: isPublic
      }
    };

    // Usar refs para datos más recientes (evita pérdida si usuario envía justo después de escribir)
    const specialtyToUse = latestSpecialtyRef.current;
    const doctorCustomToUse = latestDoctorCustomRef.current;
    consultationData.formData = { ...consultationData.formData, ...specialtyToUse };
    consultationData.doctorCustomFormData = doctorCustomToUse;

    onSubmit(consultationData)
      .then(() => {
        setIsSubmitting(false);
        handleClose();
      })
      .catch(() => {
        setIsSubmitting(false);
        // No cerrar el modal en error: el usuario puede corregir y reintentar
      });
  };

  const formContent = (
    <div className={`relative w-full rounded-xl bg-gray-50 ${asFullPage ? '' : 'flex flex-col h-[90vh] max-h-[90vh]'}`}>
          {/* Header */}
          <div className={`${asFullPage ? '' : 'flex-shrink-0'} px-6 py-4 border-b border-gray-200 rounded-t-xl ${readOnly ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              {(asFullPage ? 'h2' : Dialog.Title) && (asFullPage ? (
                <h2 className={`text-lg font-medium ${readOnly ? 'text-white' : 'text-gray-900'}`}>
                  Nueva Consulta para: <span className={readOnly ? 'text-blue-200' : 'text-blue-600'}>{patientName}</span>
                  {padecimiento && <span className={readOnly ? 'text-gray-200' : 'text-gray-700'}>— <span className="font-semibold">{padecimiento}</span></span>}
                  {readOnly && <span className="ml-4 px-3 py-1 rounded bg-gray-700 text-white text-xs font-semibold align-middle">Modo solo lectura</span>}
                </h2>
              ) : (
                <Dialog.Title className={`text-lg font-medium ${readOnly ? 'text-white' : 'text-gray-900'}`}>
                  Nueva Consulta para: <span className={readOnly ? 'text-blue-200' : 'text-blue-600'}>{patientName}</span>
                  {padecimiento && <span className={readOnly ? 'text-gray-200' : 'text-gray-700'}>— <span className="font-semibold">{padecimiento}</span></span>}
                  {readOnly && <span className="ml-4 px-3 py-1 rounded bg-gray-700 text-white text-xs font-semibold align-middle">Modo solo lectura</span>}
                </Dialog.Title>
              ))}
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg hover:bg-gray-100 ${readOnly ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                disabled={isSubmitting}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-sm mt-2 ${readOnly ? 'text-gray-300' : 'text-gray-600'}`}>
              Parte 1: Información básica de la consulta
            </p>
          </div>

          {/* Body: overflow-anchor y contain evitan saltos al escribir en cualquier dispositivo */}
          <div 
            className={`p-6 space-y-6 overscroll-contain ${asFullPage ? '' : 'flex-grow overflow-y-auto overflow-x-hidden min-h-0'}`}
            style={{ overflowAnchor: 'none', contain: 'layout', scrollPaddingTop: asFullPage ? undefined : '1rem' }}
          >
            <form id="basic-consultation-form" onSubmit={handleSubmit} className="space-y-6" style={{ overflowAnchor: 'none' }}>
            <div className="bg-white p-6 rounded-lg border border-gray-200 space-y-6">
              <h3 className="font-semibold text-lg text-gray-800">Detalles de la Consulta</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Fecha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha
                  </label>
                  {readOnly ? (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                      {date ? new Date(date).toLocaleDateString('es-ES') : 'No especificada'}
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  )}
                </div>

                {/* Motivo de la Consulta */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo de la Consulta
                  </label>
                  {readOnly ? (
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                      {reason || 'No especificado'}
                    </div>
                  ) : (
                    <input
                      ref={reasonRef}
                      type="text"
                      defaultValue={reason}
                      placeholder="Ej: Revisión de resultados"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      style={{ overflowAnchor: 'none' }}
                      required
                    />
                  )}
                </div>
              </div>

              {/* Evolución Clínica */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evolución Clínica del Paciente <span className="text-red-500">*</span>
                  <Tooltip text="Seleccione el estado actual del paciente según su evolución clínica">
                    <InformationCircleIcon className="inline w-4 h-4 ml-1 text-gray-400" />
                  </Tooltip>
                </label>
                {readOnly ? (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                    {clinicalEvolution || 'No especificada'}
                  </div>
                ) : (
                  <select
                    value={clinicalEvolution}
                    onChange={(e) => setClinicalEvolution(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Selecciona la evolución clínica</option>
                    <option value="INITIAL_EVALUATION">Evaluación Inicial</option>
                    <option value="CONFIRMED_DIAGNOSIS">Diagnóstico Confirmado</option>
                    <option value="TREATMENT_PLAN">Plan de Tratamiento</option>
                    <option value="FOLLOW_UP">Seguimiento</option>
                    <option value="STABILIZATION">Estabilización</option>
                    <option value="MEDICAL_DISCHARGE">Alta Médica</option>
                    <option value="READMISSION">Reingreso</option>
                  </select>
                )}
              </div>

              {/* Etiquetas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etiquetas (opcional)
                </label>
                {readOnly ? (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                    {tags || 'Sin etiquetas'}
                  </div>
                ) : (
                  <div>
                    <input
                      ref={tagsRef}
                      type="text"
                      defaultValue={tags}
                      placeholder="Ej: diabetes, control, seguimiento"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      style={{ overflowAnchor: 'none' }}
                    />
                    <p className="text-xs text-gray-500 mt-1">Separa las etiquetas con comas</p>
                  </div>
                )}
              </div>

              {/* Notas / Diagnóstico / Tratamiento */}
              <div style={{ overflowAnchor: 'none' }}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notas / Diagnóstico / Tratamiento <span className="text-red-500">*</span>
                </label>
                {readOnly ? (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900 min-h-[100px] whitespace-pre-wrap">
                    {notes || 'Sin notas'}
                  </div>
                ) : (
                  <textarea
                    ref={notesRef}
                    defaultValue={notes}
                    placeholder="Describe el diagnóstico, tratamiento, observaciones..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto min-h-[120px]"
                    rows={5}
                    style={{ overflowAnchor: 'none', contain: 'layout' }}
                    required
                  />
                )}
              </div>

              {/* Nota pública */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nota pública (visible para el paciente)
                  </label>
                  <p className="text-xs text-gray-500">Permite que el paciente vea esta consulta</p>
                </div>
                {readOnly ? (
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                    {isPublic ? 'Sí' : 'No'}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPublic(!isPublic)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isPublic ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isPublic ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>
            </form>

            {/* Formularios por Especialidad — estado interno en SmartForm; padre solo recibe refs al cambiar */}
            <div className="mt-4" style={{ overflowAnchor: 'none', contain: 'layout' }}>
              <SmartForm
              values={specialtyFormData}
              onChange={(data) => {
                latestSpecialtyRef.current = data;
              }}
              onDoctorFormDataChange={(data) => {
                latestDoctorCustomRef.current = data;
              }}
            />
            </div>
          </div>

          {/* Footer sticky with action buttons */}
          {!readOnly && (
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="basic-consultation-form"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Consulta'}
              </button>
            </div>
          )}
    </div>
  );

  if (asFullPage) {
    return isOpen ? formContent : null;
  }

  return (
    <Dialog open={isOpen} onClose={() => {}} static className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <Dialog.Panel as="div" className="relative w-full max-w-4xl">
          {formContent}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default BasicConsultationForm; 