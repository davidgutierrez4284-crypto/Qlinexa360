import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, PaperClipIcon, LinkIcon, PlusIcon, BeakerIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import FileUpload from './FileUpload';
import LinkManager from './LinkManager';
import { getApiUrl } from '../../utils/api';

// --- Componente Principal ---
const ConsultationAttachmentsForm = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  consultationId,
  patientName, 
  padecimiento, 
  patientId, // ID del paciente cuando se abre desde contexto de consulta (DividedConsultationManager)
  initialData = {}, 
  readOnly = false,
  userRole = null, // Nuevo prop para el rol del usuario
  isConsultationEditable = true, // Nuevo prop para saber si la consulta está abierta
  refreshMedicalRecords, // Nuevo prop para refrescar el historial
  patient, // Objeto paciente cuando se abre desde historial (ConsultationDetailView)
  clinicalCase // Nuevo prop para la consulta actual
}) => {
  // Paciente fijo cuando estamos en contexto de una consulta específica (evitar errores)
  const hasLockedPatientContext = Boolean((patient && patient.id) || patientId);
  const lockedPatientId = patient?.id ?? patientId;
  const lockedPatientDisplayName = patient
    ? `${patient.user?.firstName || patient.firstName || ''} ${patient.user?.lastName || patient.lastName || ''}`.trim() || patientName
    : (patientName || '');
  // Determinar si el paciente puede subir archivos en categorías específicas
  const isPatient = userRole === 'PATIENT';
  const canPatientUpload = isPatient && isConsultationEditable;
  
  // Para pacientes: pueden subir en STUDY_RESULT y PATIENT_PHOTO si la consulta está abierta
  // Para doctores/asistentes: siguen las reglas normales de readOnly
  // Si es paciente y la consulta está abierta, puede subir independientemente de readOnly
  // Si no es paciente, sigue la regla normal de readOnly
  const canUploadStudyResults = isPatient ? canPatientUpload : !readOnly;
  const canUploadPatientPhotos = isPatient ? canPatientUpload : !readOnly;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para NUEVOS archivos por categoría (no mezclar con los existentes)
  const [prescriptionFiles, setPrescriptionFiles] = useState([]);
  const [doctorPhotos, setDoctorPhotos] = useState([]);
  const [studyResults, setStudyResults] = useState([]);
  const [patientPhotos, setPatientPhotos] = useState([]);
  const [links, setLinks] = useState(initialData.links || []);

  // Estados para la generación de recetas
  const [recipeMode, setRecipeMode] = useState('upload'); // 'upload' o 'generate'
  const [showRecipeGenerator, setShowRecipeGenerator] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [consultations, setConsultations] = useState([]);
  const [recipeFormData, setRecipeFormData] = useState({
    esRecetaMedicamento: true,
    esSolicitudEstudios: false,
    observaciones: '',
    medicamentos: [{ medicamento: '', dosis: '', frecuencia: '', duracion: '' }],
    estudios: [{ nombreEstudio: '', indicaciones: '' }]
  });
  const [generatingRecipe, setGeneratingRecipe] = useState(false);

  // Pre-seleccionar paciente cuando hay contexto de consulta (paciente fijo)
  useEffect(() => {
    if (isOpen && recipeMode === 'generate' && hasLockedPatientContext && lockedPatientId) {
      if (patient && patient.id) {
        // Buscar el paciente en la lista de la API para obtener estructura completa
        const findAndSelectPatient = async () => {
          try {
            const res = await fetch(getApiUrl('/api/recipes/patients/search'), {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && Array.isArray(data.data)) {
                const currentPatient = data.data.find(p => p.id === patient.id);
                if (currentPatient) {
                  setSelectedPatient(currentPatient);
                  setPatientSearch(`${currentPatient.user?.firstName || ''} ${currentPatient.user?.lastName || ''}`.trim());
                  fetchConsultations(currentPatient.id);
                } else {
                  // Si no está en la API, usar objeto mínimo del paciente actual
                  const minimal = {
                    id: patient.id,
                    user: {
                      firstName: patient.user?.firstName || patient.firstName || '',
                      lastName: patient.user?.lastName || patient.lastName || '',
                      email: patient.user?.email || ''
                    }
                  };
                  setSelectedPatient(minimal);
                  setPatientSearch(lockedPatientDisplayName);
                  fetchConsultations(patient.id);
                }
              }
            }
          } catch (error) {
            console.error('Error pre-selecting patient:', error);
            const minimal = { id: patient.id, user: { firstName: patient.user?.firstName || patient.firstName || '', lastName: patient.user?.lastName || patient.lastName || '', email: '' } };
            setSelectedPatient(minimal);
            setPatientSearch(lockedPatientDisplayName);
          }
        };
        findAndSelectPatient();
      } else if (patientId) {
        // Solo patientId (desde DividedConsultationManager): objeto mínimo
        const parts = (patientName || '').trim().split(/\s+/);
        const minimal = {
          id: patientId,
          user: {
            firstName: parts[0] || patientName || '',
            lastName: parts.slice(1).join(' ') || '',
            email: ''
          }
        };
        setSelectedPatient(minimal);
        setPatientSearch(lockedPatientDisplayName || patientName);
        fetchConsultations(patientId);
      }
    }
  }, [isOpen, recipeMode, hasLockedPatientContext, lockedPatientId, patient, patientId, patientName, lockedPatientDisplayName]);

  const fetchPatients = async () => {
    try {
      const res = await fetch(getApiUrl('/api/recipes/patients/search'), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setPatients(data.data);
        } else {
          setPatients([]);
        }
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      setPatients([]);
    }
  };

  // Cargar pacientes solo cuando no hay contexto de paciente fijo (para búsqueda)
  useEffect(() => {
    if (isOpen && recipeMode === 'generate' && !hasLockedPatientContext) {
      fetchPatients();
    }
  }, [isOpen, recipeMode, hasLockedPatientContext]);

  const fetchConsultations = async (patientId) => {
    try {
      const res = await fetch(getApiUrl(`/api/consultations/patient/${patientId}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConsultations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
      setConsultations([]);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.user?.firstName || ''} ${patient.user?.lastName || ''}`.toLowerCase();
    const email = patient.user?.email || '';
    const searchTerm = patientSearch.toLowerCase();
    return fullName.includes(searchTerm) || email.includes(searchTerm);
  });

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setPatientSearch(`${patient.user?.firstName} ${patient.user?.lastName}`);
    setShowPatientDropdown(false);
    fetchConsultations(patient.id);
  };

  const handlePatientSearchChange = (value) => {
    setPatientSearch(value);
    setShowPatientDropdown(true);
    if (!value) {
      setSelectedPatient(null);
    }
  };

  const addMedicamento = () => {
    setRecipeFormData(prev => ({
      ...prev,
      medicamentos: [...prev.medicamentos, { medicamento: '', dosis: '', frecuencia: '', duracion: '' }]
    }));
  };

  const removeMedicamento = (index) => {
    setRecipeFormData(prev => ({
      ...prev,
      medicamentos: prev.medicamentos.filter((_, i) => i !== index)
    }));
  };

  const updateMedicamento = (index, field, value) => {
    setRecipeFormData(prev => ({
      ...prev,
      medicamentos: prev.medicamentos.map((med, i) => 
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const addEstudio = () => {
    setRecipeFormData(prev => ({
      ...prev,
      estudios: [...prev.estudios, { nombreEstudio: '', indicaciones: '' }]
    }));
  };

  const removeEstudio = (index) => {
    setRecipeFormData(prev => ({
      ...prev,
      estudios: prev.estudios.filter((_, i) => i !== index)
    }));
  };

  const updateEstudio = (index, field, value) => {
    setRecipeFormData(prev => ({
      ...prev,
      estudios: prev.estudios.map((estudio, i) => 
        i === index ? { ...estudio, [field]: value } : estudio
      )
    }));
  };

  const generateRecipe = async () => {
    const patientToUse = selectedPatient || (hasLockedPatientContext && lockedPatientId ? { id: lockedPatientId, user: { firstName: lockedPatientDisplayName.split(' ')[0] || '', lastName: lockedPatientDisplayName.split(' ').slice(1).join(' ') || '' } } : null);
    if (!patientToUse) {
      toast.error('Selecciona un paciente');
      return;
    }

    if (!recipeFormData.esRecetaMedicamento && !recipeFormData.esSolicitudEstudios) {
      toast.error('Selecciona al menos un tipo de receta');
      return;
    }

    try {
      setGeneratingRecipe(true);
      
      const doctorId = JSON.parse(localStorage.getItem('user')).doctorId;
      const userId = JSON.parse(localStorage.getItem('user')).id;
      
      const recipeData = {
        doctorId,
        pacienteId: patientToUse.id,
        citaId: consultationId, // Associate with current consultation
        archivoPdf: 'receta_generada.pdf', // Placeholder
        observaciones: recipeFormData.observaciones,
        esRecetaMedicamento: recipeFormData.esRecetaMedicamento,
        esSolicitudEstudios: recipeFormData.esSolicitudEstudios,
        medicamentos: recipeFormData.esRecetaMedicamento ? recipeFormData.medicamentos.filter(m => m.medicamento.trim()) : [],
        estudios: recipeFormData.esSolicitudEstudios ? recipeFormData.estudios.filter(e => e.nombreEstudio.trim()) : [],
        realizadoPor: userId,
        vinculadoADoctor: doctorId
      };

      const res = await fetch(getApiUrl('/api/recipes'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(recipeData)
      });

      if (res.ok) {
        const recipeResponse = await res.json();
        toast.success('Receta generada exitosamente');
        
        // Add the generated recipe to the prescription files
        const firstName = patientToUse.user?.firstName || patientToUse.firstName || '';
        const lastName = patientToUse.user?.lastName || patientToUse.lastName || '';
        const generatedRecipeFile = {
          id: recipeResponse.data?.id,
          fileName: `Receta_${firstName}_${lastName}_${new Date().toISOString().split('T')[0]}.pdf`,
          fileType: 'application/pdf',
          size: 0, // Will be updated by backend
          url: recipeResponse.data?.archivoPdf,
          category: 'PRESCRIPTION_REQUEST'
        };
        
        setPrescriptionFiles(prev => [...prev, generatedRecipeFile]);
        setShowRecipeGenerator(false);
        setRecipeFormData({
          esRecetaMedicamento: true,
          esSolicitudEstudios: false,
          observaciones: '',
          medicamentos: [{ medicamento: '', dosis: '', frecuencia: '', duracion: '' }],
          estudios: [{ nombreEstudio: '', indicaciones: '' }]
        });
      } else {
        let errorMessage = 'Error al generar receta';
        try {
          const ct = res.headers.get('content-type');
          if (ct?.includes('application/json')) {
            const err = await res.json();
            errorMessage = err.message || errorMessage;
          } else {
            const text = await res.text();
            if (text && !text.startsWith('<')) errorMessage = text.substring(0, 150);
          }
        } catch (_) {}
        throw new Error(errorMessage);
      }
    } catch (error) {
      toast.error('Error al generar receta: ' + (error.message || 'Error desconocido'));
    } finally {
      setGeneratingRecipe(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Permitir submit si hay archivos en categorías permitidas para pacientes
    const hasAllowedFiles = canPatientUpload && (studyResults.length > 0 || patientPhotos.length > 0 || (links && links.length > 0));
    if (isSubmitting || (readOnly && !hasAllowedFiles)) return;

    setIsSubmitting(true);

      // Solo enviar links NUEVOS (sin id) y válidos para evitar duplicados (descripción opcional)
      const cleanedLinks = (links || [])
        .filter(link => !link.id && link.url && link.url.trim())
        .filter((link, idx, arr) => arr.findIndex(l => l.url === link.url) === idx)
        .map(link => ({ url: link.url, description: link.description || link.url }));

      // Para pacientes: solo permitir STUDY_RESULT, PATIENT_PHOTO y links
      // Bloquear completamente PRESCRIPTION_REQUEST y DOCTOR_PHOTO
      const filesToSend = isPatient ? {
        STUDY_RESULT: studyResults,
        PATIENT_PHOTO: patientPhotos,
        // No incluir PRESCRIPTION_REQUEST ni DOCTOR_PHOTO para pacientes
      } : {
        PRESCRIPTION_REQUEST: prescriptionFiles,
        DOCTOR_PHOTO: doctorPhotos,
        STUDY_RESULT: studyResults,
        PATIENT_PHOTO: patientPhotos,
      };

      const attachmentData = {
      consultationId,
      files: filesToSend,
        links: cleanedLinks,
    };

    onSubmit(attachmentData).finally(() => {
      setIsSubmitting(false);
      handleClose();
    });
  };

  const getFileCount = (category) => {
    const files = {
      PRESCRIPTION_REQUEST: prescriptionFiles,
      DOCTOR_PHOTO: doctorPhotos,
      STUDY_RESULT: studyResults,
      PATIENT_PHOTO: patientPhotos,
    }[category];
    return files?.length || 0;
  };

  return (
    <Dialog open={isOpen} onClose={() => {}} static className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <Dialog.Panel as="div" className="relative w-full max-w-4xl rounded-xl bg-gray-50 flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className={`flex-shrink-0 px-6 py-4 border-b border-gray-200 rounded-t-xl ${readOnly && !canPatientUpload ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <Dialog.Title className={`text-lg font-medium ${readOnly && !canPatientUpload ? 'text-white' : 'text-gray-900'}`}>
                Archivos y Documentos para: <span className={readOnly && !canPatientUpload ? 'text-blue-200' : 'text-blue-600'}>{patientName}</span>
                {padecimiento && <span className={readOnly && !canPatientUpload ? 'text-gray-200' : 'text-gray-700'}>— <span className="font-semibold">{padecimiento}</span></span>}
                {readOnly && !canPatientUpload && <span className="ml-4 px-3 py-1 rounded bg-gray-700 text-white text-xs font-semibold align-middle">Modo solo lectura</span>}
              </Dialog.Title>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg hover:bg-gray-100 ${readOnly && !canPatientUpload ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                disabled={isSubmitting}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-sm mt-2 ${readOnly && !canPatientUpload ? 'text-gray-300' : 'text-gray-600'}`}>
              Parte 2: Archivos y documentos asociados a la consulta
            </p>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto p-6 space-y-6 max-h-[60vh]" style={{ overflowAnchor: 'none', contain: 'layout' }}>
            
            {/* a) Recetas y Estudios Solicitados */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-gray-800">a) Recetas y Estudios Solicitados</h3>
                <span className="text-sm text-gray-500">El paciente solo puede consultar</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Documentos médicos como recetas, solicitudes de estudios, etc.
              </p>
              
              {/* Para pacientes: siempre solo lectura (solo ver archivos existentes) */}
              {isPatient ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-600">
                    {getFileCount('PRESCRIPTION_REQUEST') > 0 
                      ? `${getFileCount('PRESCRIPTION_REQUEST')} archivo(s) adjunto(s)`
                      : 'Sin archivos adjuntos'
                    }
                  </p>
                  {/* Mostrar lista de archivos existentes si hay */}
                  {initialData.files?.PRESCRIPTION_REQUEST && initialData.files.PRESCRIPTION_REQUEST.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {initialData.files.PRESCRIPTION_REQUEST.map((file, idx) => (
                        <div key={idx} className="text-sm text-gray-700">
                          • {file.fileName || file.name || 'Archivo'}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!readOnly && (
                    <div className="mb-4">
                      <div className="flex space-x-4 mb-4">
                        <button
                          type="button"
                          onClick={() => setRecipeMode('upload')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            recipeMode === 'upload'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <PaperClipIcon className="w-4 h-4 inline mr-2" />
                          Subir archivo escaneado
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipeMode('generate')}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                            recipeMode === 'generate'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <BeakerIcon className="w-4 h-4 inline mr-2" />
                          Generar receta digital
                        </button>
                      </div>
                    </div>
                  )}

                  {recipeMode === 'upload' && (
                    <>
                      {readOnly ? (
                        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                          <p className="text-gray-600">
                            {getFileCount('PRESCRIPTION_REQUEST') > 0 
                              ? `${getFileCount('PRESCRIPTION_REQUEST')} archivo(s) adjunto(s)`
                              : 'Sin archivos adjuntos'
                            }
                          </p>
                        </div>
                      ) : (
                        <FileUpload
                          files={initialData.files?.PRESCRIPTION_REQUEST || []}
                          onFilesSelected={setPrescriptionFiles}
                          category="PRESCRIPTION_REQUEST"
                          maxSize={10}
                          acceptedTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                        />
                      )}
                    </>
                  )}

                  {recipeMode !== 'upload' && (
                    <div className="space-y-4">
                      {!showRecipeGenerator ? (
                        <div className="text-center p-6 border-2 border-dashed border-gray-300 rounded-lg">
                          <BeakerIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h4 className="text-lg font-medium text-gray-900 mb-2">Generar Receta Digital</h4>
                          <p className="text-gray-600 mb-4">
                            Crea una receta digital usando el módulo integrado de la plataforma
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowRecipeGenerator(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <PlusIcon className="w-4 h-4 inline mr-2" />
                            Crear Receta
                          </button>
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-medium text-gray-900">Generar Receta Digital</h4>
                            <button
                              type="button"
                              onClick={() => setShowRecipeGenerator(false)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Selección de paciente */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Paciente *
                            </label>
                            {hasLockedPatientContext ? (
                              <div className="p-3 bg-gray-100 border border-gray-300 rounded-md">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-700 font-medium">
                                    {lockedPatientDisplayName || `${selectedPatient?.user?.firstName || ''} ${selectedPatient?.user?.lastName || ''}`.trim() || '—'}
                                  </span>
                                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                    Paciente de la consulta (no editable)
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="relative">
                                  <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                                    placeholder="Buscar paciente por nombre o email..."
                                    value={patientSearch}
                                    onChange={(e) => handlePatientSearchChange(e.target.value)}
                                    onFocus={() => setShowPatientDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowPatientDropdown(false), 100)}
                                  />
                                  {showPatientDropdown && (
                                    <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                      {filteredPatients.length > 0 ? (
                                        filteredPatients.map(p => (
                                          <div
                                            key={p.id}
                                            className="p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                                            onClick={() => handlePatientSelect(p)}
                                          >
                                            <div className="font-medium">
                                              {p.user?.firstName} {p.user?.lastName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                              {p.user?.email}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="p-3 text-center text-gray-500">
                                          {patientSearch ? 'No se encontraron pacientes' : 'Escribe para buscar pacientes...'}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {selectedPatient && (
                                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                                    <div className="text-sm font-medium text-green-800">
                                      ✓ Paciente seleccionado: {selectedPatient.user?.firstName} {selectedPatient.user?.lastName}
                                    </div>
                                    <div className="text-xs text-green-600">
                                      {selectedPatient.user?.email}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Tipo de receta */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Tipo de Receta
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={recipeFormData.esRecetaMedicamento}
                                  onChange={(e) => setRecipeFormData(prev => ({ ...prev, esRecetaMedicamento: e.target.checked }))}
                                  className="mr-2"
                                />
                                <span className="text-sm">Receta de Medicamentos</span>
                              </label>
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={recipeFormData.esSolicitudEstudios}
                                  onChange={(e) => setRecipeFormData(prev => ({ ...prev, esSolicitudEstudios: e.target.checked }))}
                                  className="mr-2"
                                />
                                <span className="text-sm">Solicitud de Estudios</span>
                              </label>
                            </div>
                          </div>

                          {/* Medicamentos */}
                          {recipeFormData.esRecetaMedicamento && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Medicamentos
                                </label>
                                <button
                                  type="button"
                                  onClick={addMedicamento}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  + Agregar medicamento
                                </button>
                              </div>
                              <div className="space-y-2">
                                {recipeFormData.medicamentos.map((med, index) => (
                                  <div key={index} className="grid grid-cols-4 gap-2 p-2 border border-gray-200 rounded">
                                    <input
                                      type="text"
                                      placeholder="Medicamento"
                                      value={med.medicamento}
                                      onChange={(e) => updateMedicamento(index, 'medicamento', e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Dosis"
                                      value={med.dosis}
                                      onChange={(e) => updateMedicamento(index, 'dosis', e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Frecuencia"
                                      value={med.frecuencia}
                                      onChange={(e) => updateMedicamento(index, 'frecuencia', e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1"
                                    />
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="text"
                                        placeholder="Duración"
                                        value={med.duracion}
                                        onChange={(e) => updateMedicamento(index, 'duracion', e.target.value)}
                                        className="text-sm border border-gray-300 rounded px-2 py-1 flex-1"
                                      />
                                      {recipeFormData.medicamentos.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeMedicamento(index)}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <XMarkIcon className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Estudios */}
                          {recipeFormData.esSolicitudEstudios && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                  Estudios Solicitados
                                </label>
                                <button
                                  type="button"
                                  onClick={addEstudio}
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  + Agregar estudio
                                </button>
                              </div>
                              <div className="space-y-2">
                                {recipeFormData.estudios.map((estudio, index) => (
                                  <div key={index} className="grid grid-cols-3 gap-2 p-2 border border-gray-200 rounded">
                                    <input
                                      type="text"
                                      placeholder="Nombre del estudio"
                                      value={estudio.nombreEstudio}
                                      onChange={(e) => updateEstudio(index, 'nombreEstudio', e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Indicaciones"
                                      value={estudio.indicaciones}
                                      onChange={(e) => updateEstudio(index, 'indicaciones', e.target.value)}
                                      className="text-sm border border-gray-300 rounded px-2 py-1"
                                    />
                                    <div className="flex items-center space-x-1">
                                      <div className="flex-1"></div>
                                      {recipeFormData.estudios.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => removeEstudio(index)}
                                          className="text-red-600 hover:text-red-800"
                                        >
                                          <XMarkIcon className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Observaciones */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Observaciones
                            </label>
                            <textarea
                              value={recipeFormData.observaciones}
                              onChange={(e) => setRecipeFormData(prev => ({ ...prev, observaciones: e.target.value }))}
                              rows={3}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                              placeholder="Observaciones adicionales..."
                            />
                          </div>

                          {/* Botones de acción */}
                          <div className="flex justify-end space-x-3">
                            <button
                              type="button"
                              onClick={() => setShowRecipeGenerator(false)}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={generateRecipe}
                              disabled={generatingRecipe || !selectedPatient}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {generatingRecipe ? 'Generando...' : 'Generar Receta'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* b) Fotos (Subidas por Doctor) */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-gray-800">b) Fotos (Subidas por el profesional)</h3>
                <span className="text-sm text-gray-500">El paciente solo puede consultar</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Imágenes clínicas, fotos de lesiones, etc.
              </p>
              {(isPatient || readOnly) ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-600">
                    {getFileCount('DOCTOR_PHOTO') > 0 
                      ? `${getFileCount('DOCTOR_PHOTO')} archivo(s) adjunto(s)`
                      : 'Sin archivos adjuntos'
                    }
                  </p>
                </div>
              ) : (
                <FileUpload
                  files={initialData.files?.DOCTOR_PHOTO || []}
                  onFilesSelected={setDoctorPhotos}
                  category="DOCTOR_PHOTO"
                  maxSize={10}
                  acceptedTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                />
              )}
            </div>

            {/* c) Resultados de Estudios */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-gray-800">c) Resultados de Estudios</h3>
                <span className="text-sm text-green-600">El paciente también puede subir archivos aquí</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Reportes de laboratorio, estudios de imagen, etc.
              </p>
              {!canUploadStudyResults ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-600">
                    {getFileCount('STUDY_RESULT') > 0 
                      ? `${getFileCount('STUDY_RESULT')} archivo(s) adjunto(s)`
                      : 'Sin archivos adjuntos'
                    }
                  </p>
                </div>
              ) : (
                <FileUpload
                  files={initialData.files?.STUDY_RESULT || []}
                  onFilesSelected={setStudyResults}
                  category="STUDY_RESULT"
                  maxSize={10}
                  acceptedTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                />
              )}
            </div>

            {/* d) Fotos Subidas por Paciente */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-gray-800">d) Fotos Subidas por Paciente</h3>
                <span className="text-sm text-blue-600">Categoría para archivos que el paciente podría subir en su portal</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Imágenes que el paciente puede subir desde su portal.
              </p>
              {!canUploadPatientPhotos ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-600">
                    {getFileCount('PATIENT_PHOTO') > 0 
                      ? `${getFileCount('PATIENT_PHOTO')} archivo(s) adjunto(s)`
                      : 'Sin archivos adjuntos'
                    }
                  </p>
                </div>
              ) : (
                <FileUpload
                  files={initialData.files?.PATIENT_PHOTO || []}
                  onFilesSelected={setPatientPhotos}
                  category="PATIENT_PHOTO"
                  maxSize={10}
                  acceptedTypes={['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                />
              )}
            </div>

            {/* Links asociados */}
            <div className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center">
                  <LinkIcon className="w-5 h-5 mr-2" />
                  Links asociados
                </h3>
              </div>
              {readOnly ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
                  <p className="text-gray-600">
                    {links.length > 0 
                      ? `${links.length} link(s) asociado(s)`
                      : 'No hay links registrados'
                    }
                  </p>
                </div>
              ) : (
                <LinkManager
                  links={links}
                  onChange={setLinks}
                />
              )}
            </div>

            {/* Resumen de archivos */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">Resumen de archivos</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{getFileCount('PRESCRIPTION_REQUEST')}</div>
                  <div className="text-blue-600">Recetas</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{getFileCount('DOCTOR_PHOTO')}</div>
                  <div className="text-blue-600">Fotos del profesional</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{getFileCount('STUDY_RESULT')}</div>
                  <div className="text-blue-600">Resultados</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-blue-600">{getFileCount('PATIENT_PHOTO')}</div>
                  <div className="text-blue-600">Fotos Paciente</div>
                </div>
              </div>
              <div className="mt-2 text-center">
                <div className="font-semibold text-blue-600">{links.length}</div>
                <div className="text-blue-600">Links asociados</div>
              </div>
            </div>

            {/* Botones de acción */}
            {(!readOnly || canPatientUpload) && (
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
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
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Archivos y Documentos'}
                </button>
              </div>
            )}
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ConsultationAttachmentsForm; 