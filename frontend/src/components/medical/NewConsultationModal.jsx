import React, { useState, useRef } from 'react';
import { Dialog, Switch } from '@headlessui/react';
import { XMarkIcon, ClipboardDocumentIcon, ArrowUpTrayIcon, PaperClipIcon, InformationCircleIcon, PlusCircleIcon, TrashIcon, LinkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import SmartForm from './SmartForm';
import FileUpload from './FileUpload';
import LinkManager from './LinkManager';

// --- Componente Tooltip ---
const Tooltip = ({ text, children }) => (
  <div className="relative flex items-center group">
    {children}
    <div className="absolute bottom-full mb-2 w-48 p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
      {text}
    </div>
  </div>
);

// --- Componente Principal del Modal ---
const NewConsultationModal = ({ isOpen, onClose, onSubmit, patientName, padecimiento, initialData = {}, readOnly = false, formTemplates = [] }) => {
  // Solo usar useState para campos editables
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Función para obtener la fecha actual en formato YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Función para normalizar la fecha a formato YYYY-MM-DD
  const normalizeDate = (dateValue) => {
    if (!dateValue) return getCurrentDate();
    
    if (typeof dateValue === 'string') {
      if (dateValue.includes('T')) {
        // Es un ISO string (UTC), convertir a fecha local correctamente
        const date = new Date(dateValue);
        
        // Usar UTC para obtener los componentes de fecha sin conversión de zona horaria
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        
        console.log('Fecha UTC recibida:', dateValue);
        console.log('Año UTC:', year, 'Mes UTC:', month, 'Día UTC:', day);
        
        return `${year}-${month}-${day}`;
      } else if (dateValue.includes('-')) {
        // Ya está en formato YYYY-MM-DD
        return dateValue;
      } else {
        // Otro formato, intentar parsear
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    } else if (dateValue instanceof Date) {
      // Es un objeto Date
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return getCurrentDate();
  };

  // Normalizar la fecha inicial
  const normalizedInitialDate = normalizeDate(initialData.date);
  
  // Debug de fechas
  console.log('=== DEBUG FECHAS FRONTEND ===');
  console.log('initialData.date recibido:', initialData.date);
  console.log('Tipo de initialData.date:', typeof initialData.date);
  console.log('Fecha normalizada:', normalizedInitialDate);
  console.log('Fecha actual:', getCurrentDate());
  console.log('=== FIN DEBUG FECHAS ===');

  // Estados para campos editables
  const [date, setDate] = readOnly ? [normalizedInitialDate, undefined] : useState(normalizedInitialDate);
  const [reason, setReason] = readOnly ? [initialData.reason, undefined] : useState(initialData.reason || '');
  const [tags, setTags] = readOnly ? [Array.isArray(initialData.tags) ? initialData.tags.join(', ') : '', undefined] : useState(initialData.tags ? initialData.tags.join(', ') : '');
  const [notes, setNotes] = readOnly ? [initialData.notes, undefined] : useState(initialData.notes || '');
  const [isPublic, setIsPublic] = readOnly ? [initialData.isPublic !== undefined ? initialData.isPublic : false, undefined] : useState(initialData.isPublic !== undefined ? initialData.isPublic : false);
  const [clinicalEvolution, setClinicalEvolution] = readOnly ? [initialData.clinicalEvolution, undefined] : useState(initialData.clinicalEvolution || '');
  const [prescriptionFiles, setPrescriptionFiles] = readOnly ? [initialData.files?.PRESCRIPTION_REQUEST || [], undefined] : useState(initialData.files?.PRESCRIPTION_REQUEST || []);
  const [doctorPhotos, setDoctorPhotos] = readOnly ? [initialData.files?.DOCTOR_PHOTO || [], undefined] : useState(initialData.files?.DOCTOR_PHOTO || []);
  const [studyResults, setStudyResults] = readOnly ? [initialData.files?.STUDY_RESULT || [], undefined] : useState(initialData.files?.STUDY_RESULT || []);
  const [patientPhotos, setPatientPhotos] = readOnly ? [initialData.files?.PATIENT_PHOTO || [], undefined] : useState(initialData.files?.PATIENT_PHOTO || []);
  const [links, setLinks] = readOnly ? [initialData.links || [], undefined] : useState(initialData.links || []);
  const [formData] = readOnly ? [initialData.formData || {}, undefined] : useState(initialData.formData || {});
  const specialtyFormDataRef = useRef(initialData.formData || {});
  
  // Generar campos de especialidad basándose en formData cuando está en modo solo lectura
  const specialtyFields = readOnly && initialData.formData ? 
    Object.keys(initialData.formData)
      .filter(key => key !== 'reason' && key !== 'tags')
      .map(key => ({
        id: key,
        name: key,
        label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        fieldType: 'TEXT'
      })) : 
    (initialData.specialtyFields || []);
  
  // Solo lectura o values iniciales: no reinyectar formData en cada tecla (evita saltos)
  const smartFormValues = readOnly ? (initialData.formData || {}) : formData;
  
  console.log('Campo specialtyFields:', initialData.specialtyFields);
  console.log('specialtyFields generados:', specialtyFields);
  console.log('values para SmartForm:', readOnly ? initialData.formData || {} : formData);
  console.log('=== DEBUG FORMULARIO ESPECIALIDAD ===');
  console.log('initialData completo:', initialData);
  console.log('initialData.formData:', initialData.formData);
  console.log('readOnly:', readOnly);
  console.log('smartFormValues:', smartFormValues);
  console.log('=== FIN DEBUG ===');

  // Mapeo de ID de campo a label legible
  const fieldIdToLabel = {};
  if (formTemplates && formTemplates.length > 0) {
    formTemplates.forEach(template => {
      template.fields.forEach(field => {
        fieldIdToLabel[field.id] = field.label;
      });
    });
  }

  console.log('fieldIdToLabel:', fieldIdToLabel);
  console.log('¿Debería mostrar campos de especialidad?', {
    readOnly,
    hasFormData: !!initialData.formData,
    formDataKeys: Object.keys(initialData.formData || {}),
    formDataLength: Object.keys(initialData.formData || {}).length
  });

  // Opciones de evolución clínica
  const clinicalEvolutionOptions = [
    { value: 'INITIAL_EVALUATION', label: '1. Evaluación inicial - ingreso' },
    { value: 'CONFIRMED_DIAGNOSIS', label: '2. Diagnóstico confirmado' },
    { value: 'TREATMENT_PLAN', label: '3. Plan de tratamiento' },
    { value: 'FOLLOW_UP', label: '4. Seguimiento' },
    { value: 'STABILIZATION', label: '5. Estabilización - control' },
    { value: 'MEDICAL_DISCHARGE', label: '6. Alta médica' },
    { value: 'READMISSION', label: '7. Reingreso - recaída' },
  ];

  // Limpieza de estados al cerrar el modal
  const handleClose = () => {
    if (readOnly) {
      onClose();
      return;
    }
    setPrescriptionFiles([]);
    setDoctorPhotos([]);
    setStudyResults([]);
    setPatientPhotos([]);
    setLinks([]);
    specialtyFormDataRef.current = {};
    setTags('');
    setNotes('');
    setReason('');
    setClinicalEvolution('');
    setIsPublic(false);
    setDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting || readOnly) return;

    // Validar solo los campos realmente obligatorios
    if (!clinicalEvolution) {
      toast.error('Debe seleccionar la evolución clínica del paciente.');
      return;
    }
    if (!reason) {
      toast.error('Debe capturar el motivo de la consulta.');
      return;
    }
    if (!notes) {
      toast.error('Debe capturar las notas o diagnóstico.');
      return;
    }

    setIsSubmitting(true);

    const processedTags = tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
    const validLinks = links.filter(link => link.url && link.description);

    // El payload que se envía a la página padre
    const specialtyPayload = specialtyFormDataRef.current || {};
    console.log('formData antes de enviar:', specialtyPayload);
    console.log('Object.keys(formData):', Object.keys(specialtyPayload));
    const consultationData = {
      date,
      reason,
      notes,
      isPublic,
      clinicalEvolution,
      tags: processedTags,
      links: validLinks,
      files: {
        PRESCRIPTION_REQUEST: prescriptionFiles,
        DOCTOR_PHOTO: doctorPhotos,
        STUDY_RESULT: studyResults,
        PATIENT_PHOTO: patientPhotos,
      },
      formData: specialtyPayload, // Siempre enviar un objeto, aunque esté vacío
    };

    onSubmit(consultationData).finally(() => {
      setIsSubmitting(false);
      handleClose(); // Limpiar y cerrar tras submit exitoso
    });
  };

  return (
    <Dialog open={isOpen} onClose={() => {}} static className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <Dialog.Panel as="div" className="relative w-full max-w-4xl rounded-xl bg-gray-50 flex flex-col max-h-[95vh]">
          {/* Header con cenefa gris obscuro en modo solo lectura */}
          <div className={`flex-shrink-0 px-6 py-4 border-b border-gray-200 rounded-t-xl ${readOnly ? 'bg-gray-800' : 'bg-white'}`}>
            <Dialog.Title className={`text-lg font-medium ${readOnly ? 'text-white' : 'text-gray-900'}`}>
              Nueva Consulta para: <span className={readOnly ? 'text-blue-200' : 'text-blue-600'}>{patientName}</span>{padecimiento ? <span className={readOnly ? 'text-gray-200' : 'text-gray-700'}>— <span className="font-semibold">{padecimiento}</span></span> : null}
              {readOnly && <span className="ml-4 px-3 py-1 rounded bg-gray-700 text-white text-xs font-semibold align-middle">Modo solo lectura</span>}
            </Dialog.Title>
          </div>
          {/* Body con scroll y formulario - overflow-anchor evita saltos al escribir */}
          <form id="consultation-form" onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6 max-h-[60vh] overscroll-contain" style={{ overflowAnchor: 'none' }}>
            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-semibold text-lg text-gray-800">Detalles de la Consulta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="form-label">Fecha</label>
                  {readOnly ? (
                    <div className="form-value text-gray-900 font-medium py-2">
                      {date ? (() => {
                        // Asegurar que la fecha se muestre correctamente
                        let displayDate;
                        if (typeof date === 'string') {
                          if (date.includes('T')) {
                            // Es un ISO string, convertir a fecha local
                            displayDate = new Date(date);
                          } else if (date.includes('-')) {
                            // Es formato YYYY-MM-DD, convertir a fecha local
                            const [year, month, day] = date.split('-').map(Number);
                            displayDate = new Date(year, month - 1, day);
                          } else {
                            // Otro formato, intentar parsear
                            displayDate = new Date(date);
                          }
                        } else {
                          // Es un objeto Date
                          displayDate = new Date(date);
                        }
                        
                        // Verificar que la fecha sea válida
                        if (isNaN(displayDate.getTime())) {
                          console.error('Fecha inválida:', date);
                          return 'Fecha inválida';
                        }
                        
                        return displayDate.toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit'
                        });
                      })() : '-'}
                    </div>
                  ) : (
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="form-input mt-1 w-full" />
                  )}
                </div>
                <div>
                  <label className="form-label">Motivo de la Consulta</label>
                  {readOnly ? (
                    <div className="form-value text-gray-900 font-medium py-2">{initialData.reason || '-'}</div>
                  ) : (
                    <input type="text" value={reason} onChange={e => setReason(e.target.value)} required placeholder="Ej: Revisión de resultados" className="form-input mt-1 w-full" />
                  )}
                </div>
              </div>
              
              <div>
                <label className="form-label flex items-center space-x-2">
                  <span>Evolución Clínica del Paciente *</span>
                  <Tooltip text="Estado actual del paciente en su proceso de atención médica. Es obligatorio para el seguimiento y análisis de datos.">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400" />
                  </Tooltip>
                </label>
                {readOnly ? (
                  <div className="form-value text-gray-900 font-medium py-2">
                    {clinicalEvolution ? clinicalEvolutionOptions.find(opt => opt.value === clinicalEvolution)?.label || clinicalEvolution : '-'}
                  </div>
                ) : (
                  <select value={clinicalEvolution} onChange={e => setClinicalEvolution(e.target.value)} required className="form-select mt-1 w-full">
                    <option value="">Selecciona la evolución clínica</option>
                    {clinicalEvolutionOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="form-label">Etiquetas (opcional)</label>
                {readOnly ? (
                  <div className="form-value text-gray-900 font-medium py-2">{Array.isArray(initialData.tags) ? (initialData.tags.length > 0 ? initialData.tags.join(', ') : '-') : '-'}</div>
                ) : (
                  <>
                    <input type="text" value={tags} onChange={e => setTags(e.target.value)} placeholder="Ej: diabetes, control, seguimiento" className="form-input mt-1 w-full" />
                    <p className="text-xs text-gray-500 mt-1">Separa las etiquetas con comas</p>
                  </>
                )}
              </div>

              <div>
                <label className="form-label">Notas / Diagnóstico / Tratamiento *</label>
                {readOnly ? (
                  <div className="form-value text-gray-900 font-medium py-2 whitespace-pre-line">{initialData.notes || initialData.diagnosis || '-'}</div>
                ) : (
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} required placeholder="Describe el diagnóstico, tratamiento, observaciones..." className="form-textarea mt-1 w-full resize-none overflow-y-auto h-[100px] min-h-[100px] max-h-[100px]"></textarea>
                )}
                            </div>
          
                <div className="flex items-center space-x-2">
                {readOnly ? (
                  <>
                    <span className="inline-block w-5 h-5 align-middle rounded-full bg-blue-600 mr-2"></span>
                    <span className="text-sm text-gray-700">{isPublic ? 'Nota pública (visible para el paciente)' : 'Nota privada'}</span>
                  </>
                ) : (
                  <>
                    <Switch checked={isPublic} onChange={setIsPublic} className={`${isPublic ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}>
                      <span className={`${isPublic ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
                    </Switch>
                    <span className="text-sm text-gray-700">Nota pública (visible para el paciente)</span>
                  </>
                )}
              </div>
            </div>

            {/* Formularios Inteligentes - Mostrar en modo edición y solo lectura */}
            <SmartForm 
              fields={specialtyFields}
              values={smartFormValues}
              onChange={(data) => {
                specialtyFormDataRef.current = data;
              }}
              readOnly={readOnly}
            />

            {/* Secciones de Archivos y Links */}
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">a) Recetas y Estudios Solicitados</h4>
                <p className="text-sm text-gray-500 mb-3">El paciente solo puede consultar.</p>
                <FileUpload
                  onFilesSelected={files => setPrescriptionFiles(files)}
                  category="PRESCRIPTION_REQUEST"
                  maxFiles={5}
                  disabled={readOnly}
                  files={prescriptionFiles}
                />
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">b) Fotos (Subidas por el profesional)</h4>
                <p className="text-sm text-gray-500 mb-3">El paciente solo puede consultar.</p>
                <FileUpload
                  onFilesSelected={files => setDoctorPhotos(files)}
                  category="DOCTOR_PHOTO"
                  maxFiles={10}
                  disabled={readOnly}
                  files={doctorPhotos}
                />
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">c) Resultados de Estudios</h4>
                <p className="text-sm text-gray-500 mb-3">El paciente también puede subir archivos aquí.</p>
                <FileUpload
                  onFilesSelected={files => setStudyResults(files)}
                  category="STUDY_RESULT"
                  maxFiles={10}
                  disabled={readOnly}
                  files={studyResults}
                />
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">d) Fotos Subidas por Paciente</h4>
                <p className="text-sm text-gray-500 mb-3">Categoría para archivos que el paciente podría subir en su portal.</p>
                <FileUpload
                  onFilesSelected={files => setPatientPhotos(files)}
                  category="PATIENT_PHOTO"
                  maxFiles={10}
                  disabled={readOnly}
                  files={patientPhotos}
                />
              </div>

              <LinkManager 
                links={links} 
                onChange={readOnly ? () => {} : setLinks} 
                readOnly={readOnly} 
              />
            </div>
          </form>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-white rounded-b-xl flex justify-end space-x-3">
            {readOnly ? (
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-white bg-gray-700 border border-transparent rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700">
                Cerrar
              </button>
            ) : (
              <>
                <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Cancelar
                </button>
                <button type="submit" form="consultation-form" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting ? 'Guardando...' : 'Guardar Consulta'}
                </button>
              </>
            )}
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewConsultationModal; 