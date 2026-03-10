import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  DocumentTextIcon, 
  CalendarIcon, 
  UserIcon,
  ClockIcon,
  DocumentPlusIcon,
  PlusIcon,
  ExclamationCircleIcon,
  MagnifyingGlassIcon,
  ArrowLeftIcon,
  PaperClipIcon,
  PhotoIcon,
  LinkIcon,
  InformationCircleIcon,
  UserPlusIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
// Importar componentes del sistema de consultas divididas
import DividedConsultationManager from '../components/medical/DividedConsultationManager';
import { ConsultationStatusIndicator, ConsultationStats, PendingConsultationsAlert } from '../components/medical/ConsultationStatusIndicator';
import ConsultationStatusHelp from '../components/medical/ConsultationStatusHelp';
import ConsultationAttachmentsForm from '../components/medical/ConsultationAttachmentsForm';
import BasicConsultationForm from '../components/medical/BasicConsultationForm';
import useDividedConsultations from '../hooks/useDividedConsultations';
import { toast } from 'react-toastify';
import { searchPatients, searchHealthProfessionals, getPatientDetails, createConsultation, uploadFile, createPatient, getFormTemplates, updatePatient } from '../services/doctorService';
import consultationService from '../services/consultationService';
import { debounce } from 'lodash';
import NewPatientModal from '../components/medical/NewPatientModal';
import ClinicalEvolutionTracker from '../components/medical/ClinicalEvolutionTracker';
import Modal from 'react-modal';
import PhotoHistoryViewer from '../components/medical/PhotoHistoryViewer';
import Tooltip from '../components/common/Tooltip';
import useMedicalRecords from '../hooks/useMedicalRecords';
import useClinicalCases from '../hooks/useClinicalCases';
import usePatientClinicalCases from '../hooks/usePatientClinicalCases';
import usePatientMedicalRecords from '../hooks/usePatientMedicalRecords';
import NewClinicalCaseModal from '../components/medical/NewClinicalCaseModal';
import DoctorFormTemplateManager from '../components/medical/DoctorFormTemplateManager';
import Loader from '../components/common/Loader';
import PhoneInput from '../components/common/PhoneInput';
import axios from 'axios';
import FileHistoryViewer from '../components/medical/FileHistoryViewer';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/api';
import { formatAgeForDisplay, formatAgeFieldValue } from '../utils/ageUtils';



// Función para formatear fecha en formato dd-MMM-yy
const formatDate = (date) => {
  if (!date) return '';
  
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear().toString().slice(-2);
  
  return `${day}-${month}-${year}`;
};

// --- Datos de ejemplo (Mock Data) ---
const mockPatient = {
  id: '1',
  name: 'Ana García Rodríguez',
  email: 'ana.garcia@email.com',
  profilePictureUrl: 'https://randomuser.me/api/portraits/women/75.jpg',
  dob: '15/08/1985',
  bloodType: 'O+',
  allergies: 'Penicilina, Nueces',
};

const mockConsultations = [
  {
    id: 'c3',
    date: '2024-07-22',
    reason: 'Consulta de seguimiento',
    doctor: 'Dr. Once',
  },
  {
    id: 'c2',
    date: '2024-06-15',
    reason: 'Revisión anual',
    doctor: 'Dr. Once',
  },
  {
    id: 'c1',
    date: '2024-03-10',
    reason: 'Gripe y fiebre',
    doctor: 'Dr. Once',
  },
];

// --- Componentes Anidados ---

const SearchBar = ({ onSelectPatient, newlyCreatedPatient }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedSearch = useCallback(
    debounce(async (searchQuery) => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const data = await searchPatients(searchQuery);
        setResults(data);
      } catch (error) {
        console.error('Error al buscar pacientes:', error);
        toast.error('No se pudo realizar la búsqueda.');
      }
      setIsLoading(false);
    }, 500),
    []
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  // Efecto para añadir el paciente recién creado a los resultados
  useEffect(() => {
    if (newlyCreatedPatient) {
      // Si hay un paciente recién creado, lo añadimos a los resultados
      setResults(prev => {
        // Verificar si ya existe en los resultados para evitar duplicados
        const exists = prev.some(p => p.id === newlyCreatedPatient.id);
        if (!exists) {
          return [newlyCreatedPatient, ...prev];
        }
        return prev;
      });
    }
  }, [newlyCreatedPatient]);

  const handleSelect = (patient) => {
    setQuery('');
    setResults([]);
    onSelectPatient(patient);
  };

  return (
    <div className="relative">
      <div className="flex items-center">
        <MagnifyingGlassIcon className="absolute left-3 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar paciente por nombre, email o padecimiento..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {isLoading && <p className="absolute w-full mt-1 text-sm text-gray-500">Buscando...</p>}
      {results.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((patient) => (
            <li
              key={patient.id}
              onClick={() => handleSelect(patient)}
              className={`px-4 py-2 hover:bg-blue-50 cursor-pointer ${
                newlyCreatedPatient && newlyCreatedPatient.id === patient.id 
                  ? 'bg-green-50 border-l-4 border-green-500' 
                  : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <span>{patient.firstName} {patient.lastName} ({patient.email})</span>
                {newlyCreatedPatient && newlyCreatedPatient.id === patient.id && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    Recién creado
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const PatientHeader = ({ patient, onOpenAdditional }) => {
  const [signedProfileUrl, setSignedProfileUrl] = useState('');
  const rawEmail = patient.email || patient.user?.email || '';
  const displayEmail = (rawEmail && !String(rawEmail).startsWith('patient-no-email@')) ? rawEmail : '';

  useEffect(() => {
    async function fetchSignedUrl() {
      if (patient.profilePictureUrl) {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get(getApiUrl('/api/files/signed-url'), {
            params: { url: patient.profilePictureUrl },
            headers: { Authorization: `Bearer ${token}` }
          });
          setSignedProfileUrl(res.data.url);
        } catch {
          setSignedProfileUrl('');
        }
      } else {
        setSignedProfileUrl('');
      }
    }
    fetchSignedUrl();
  }, [patient.profilePictureUrl]);

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between bg-white p-4 sm:p-6 rounded-xl shadow-md mb-4">
      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
        {signedProfileUrl ? (
          <img
            className="h-12 w-12 sm:h-16 sm:w-16 rounded-full object-cover border-2 border-blue-400 flex-shrink-0"
            src={signedProfileUrl}
            alt="Foto de perfil"
          />
        ) : (
          <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-teal-600 flex items-center justify-center text-white text-lg sm:text-2xl font-bold flex-shrink-0">
            {patient.firstName?.[0]}{patient.lastName?.[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-lg sm:text-2xl font-bold text-gray-800 truncate">{patient.firstName} {patient.lastName}</div>
          <div className="text-gray-600 text-xs sm:text-sm truncate">Email: {displayEmail || 'Sin correo (agregar en Datos adicionales)'}</div>
          <div className="text-gray-600 text-xs sm:text-sm">Fecha de nacimiento: {patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString('es-ES') : (patient.dob || '')} {formatAgeForDisplay(patient.dateOfBirth || patient.dob)}</div>
          <div className="text-gray-600 text-xs sm:text-sm">Teléfono: {patient.phone}</div>
        </div>
      </div>
      <button
        onClick={onOpenAdditional}
        className="mt-3 md:mt-0 px-3 py-2 sm:px-4 bg-white border border-gray-300 rounded-md shadow text-gray-800 hover:bg-gray-100 text-sm flex-shrink-0"
      >
        Datos adicionales
      </button>
    </div>
  );
};

const getFileIcon = (file) => {
  if (file.fileType?.includes('pdf')) return <DocumentTextIcon className="h-5 w-5 text-red-500" title="PDF" />;
  if (file.fileType?.includes('image')) return <PhotoIcon className="h-5 w-5 text-blue-500" title="Imagen" />;
  return <PaperClipIcon className="h-5 w-5 text-gray-500" title="Archivo" />;
};

const getLinkIcon = () => <LinkIcon className="h-5 w-5 text-green-500" title="Link" />;

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FILE_CATEGORY_LABELS = {
  PRESCRIPTION_REQUEST: 'Recetas',
  DOCTOR_PHOTO: 'Fotos del profesional',
  STUDY_RESULT: 'Resultados',
  PATIENT_PHOTO: 'Fotos Paciente',
  OTHER: 'Otros',
};

// Diccionario para mostrar la etiqueta legible de clinicalEvolution
const CLINICAL_EVOLUTION_LABELS = {
  INITIAL_EVALUATION: 'Evaluación Inicial',
  CONFIRMED_DIAGNOSIS: 'Diagnóstico Confirmado',
  TREATMENT_PLAN: 'Plan de Tratamiento',
  FOLLOW_UP: 'Seguimiento',
  STABILIZATION: 'Estabilización',
  MEDICAL_DISCHARGE: 'Alta Médica',
  READMISSION: 'Reingreso',
};

const MedicalRecordsConsultationList = ({ consultations, onNewConsultation, onSelectConsultation }) => {
  const { user } = useAuth();
  const total = consultations.length;
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  
  // Logging para debuggear el número de consultas
  console.log('=== FRONTEND: MedicalRecordsConsultationList ===');
  console.log('consultations.length:', consultations.length);
  console.log('consultations:', consultations);
  console.log('=== FIN FRONTEND ===');
  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-2 sm:space-x-3">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Historial de Consultas</h3>
          <button
            onClick={() => setShowStatusHelp(true)}
            className="inline-flex items-center px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
            title="Ayuda sobre estados de consultas"
          >
            <InformationCircleIcon className="w-4 h-4 mr-1" />
            ¿Qué significan los estados?
          </button>
        </div>
        {/* Solo mostrar botón de registrar consulta para doctores */}
        {user && user.role === 'DOCTOR' && (
          <button
            onClick={onNewConsultation}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Registrar Consulta
          </button>
        )}
      </div>
      <div className="space-y-4">
        {consultations && consultations.length > 0 ? (
          consultations.map((consultation, idx) => {
            // Agrupar archivos por categoría
            const filesByCategory = (consultation.files || []).reduce((acc, file) => {
              const cat = file.category || 'OTHER';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(file);
              return acc;
            }, {});
            const isOwn = user && (consultation.autorConsultaId === user.userId || consultation.userId === user.userId);
            return (
              <div 
                key={consultation.id} 
                className={`p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center gap-3 min-w-0 ${isOwn ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                onClick={() => onSelectConsultation(consultation)}
              >
                {/* Fila superior en móvil: número + estado */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 font-bold text-lg">
                    {total - idx}
                  </div>
                  <ConsultationStatusIndicator consultation={consultation} />
                </div>
                {/* Contenido principal - ancho completo en móvil */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-base sm:text-lg text-blue-600 break-words">{consultation.notes || 'Consulta General'}</p>
                    {consultation.isEditable === false && (
                      <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full font-semibold shrink-0" title="Consulta en solo lectura">
                        Solo lectura
                      </span>
                    )}
                  </div>
                  <span className="inline-block text-xs text-blue-700 bg-blue-100 rounded px-2 py-0.5 font-semibold mb-1 mt-1">
                    {CLINICAL_EVOLUTION_LABELS[consultation.clinicalEvolution] || consultation.clinicalEvolution || 'Sin evolución'}
                  </span>
                  <p className="text-sm text-gray-600">Fecha: {formatDate(consultation.date || consultation.createdAt)}</p>
                  {consultation.user && (
                    <p className="text-sm text-gray-500 break-words">
                      Atendido por: {consultation.user.firstName} {consultation.user.lastName}
                    </p>
                  )}
                </div>
                {/* Archivos y links - en su propia fila en móvil */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Archivos agrupados por categoría */}
                  {Object.keys(filesByCategory).length > 0 && (
                    <div className="flex items-center gap-2">
                      {Object.entries(filesByCategory).map(([cat, files]) => (
                        <div key={cat} className="flex items-center group relative">
                          <div className="flex items-center px-2 py-1 bg-gray-100 rounded-full">
                            {getFileIcon(files[0])}
                            <span className="ml-1 text-xs text-gray-700 font-semibold">{files.length}</span>
                          </div>
                          {/* Tooltip mejorado */}
                          <div className="absolute bottom-full left-0 mb-2 w-72 p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                            <div className="font-semibold mb-2 text-blue-300">{FILE_CATEGORY_LABELS[cat] || cat}</div>
                            <div className="space-y-1">
                              {files.map(file => (
                                <div key={file.id} className="flex items-center justify-between">
                                  <span className="truncate flex-1">{file.fileName}</span>
                                  <span className="text-gray-400 ml-2">{formatFileSize(file.size)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Links adjuntos */}
                  {consultation.links && consultation.links.length > 0 && (
                    <div className="flex items-center group relative">
                      <div className="flex items-center px-2 py-1 bg-blue-100 rounded-full">
                        {getLinkIcon()}
                        <span className="ml-1 text-xs text-blue-700 font-semibold">{consultation.links.length}</span>
                      </div>
                      {/* Tooltip para links */}
                      <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                        <div className="font-semibold mb-2 text-blue-300">Links adjuntos:</div>
                        <div className="space-y-1">
                          {consultation.links.map((link, idx) => (
                            <div key={idx} className="truncate">
                              <div className="font-medium">{link.description || 'Sin descripción'}</div>
                              <div className="text-gray-400 text-xs truncate">{link.url}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-gray-500 py-4">Este paciente aún no tiene consultas registradas.</p>
        )}
      </div>
      
      {/* Modal de ayuda sobre estados */}
      <ConsultationStatusHelp 
        isOpen={showStatusHelp}
        onClose={() => setShowStatusHelp(false)}
      />
    </div>
  );
};

const ConsultationDetailView = ({ consultation, onBack, fieldLabels, formTemplates, onAddAttachments, onConsultationUpdated, patient, selectedCase, refreshMedicalRecords, refreshDividedConsultations }) => {
  const { user } = useAuth();
  const [showAddAttachments, setShowAddAttachments] = useState(false);
  const [showEditConsultation, setShowEditConsultation] = useState(false);
  
  if (!consultation) return null;

  const canEdit = consultation.isEditable !== false && (user?.role === 'DOCTOR' || user?.role === 'ASISTENTE');

  const handleEditConsultationSubmit = async (data) => {
    if (!consultation?.id) return;
    const payload = {
      notes: data.notes,
      reason: data.reason,
      date: data.date,
      tags: data.tags,
      clinicalEvolution: data.clinicalEvolution,
      formData: data.formData,
      isPublic: data.isPublic
    };
    const response = await consultationService.updateConsultation(consultation.id, payload);
    const updated = response?.data ?? response;
    toast.success('Consulta actualizada correctamente.');
    setShowEditConsultation(false);
    refreshMedicalRecords?.();
    refreshDividedConsultations?.();
    onConsultationUpdated?.(updated);
  };

  const handleAttachmentsSubmit = async (data) => {
    try {
      if (user?.role === 'ASISTENTE') {
        toast.error('No tienes permisos para modificar el historial clínico.');
        return;
      }

      const { consultationId, files, links } = data || {};
      const isPatient = user?.role === 'PATIENT';
      
      // Estructura para enviar archivos por categoría
      const filesByCategory = {};
      
      if (files && typeof files === 'object') {
        for (const [category, list] of Object.entries(files)) {
          // Para pacientes: solo procesar categorías permitidas
          if (isPatient && category !== 'STUDY_RESULT' && category !== 'PATIENT_PHOTO') {
            console.log(`Ignorando categoría ${category} para paciente`);
            continue;
          }
          
          if (Array.isArray(list) && list.length > 0) {
            const uploadedFilesForCategory = [];
            for (const file of list) {
              try {
                // Si el archivo ya tiene id (ya fue subido), solo agregarlo
                if (file.id) {
                  uploadedFilesForCategory.push({
                    id: file.id,
                    fileName: file.fileName || file.name,
                    fileType: file.fileType || file.type,
                    size: file.size,
                    url: file.url,
                    category: category
                  });
                } else {
                  // Si es un archivo nuevo, subirlo primero
                  try {
                    const up = await uploadFile(file, category);
                    if (up) {
                      // El backend devuelve response.data.file directamente
                      uploadedFilesForCategory.push({
                        id: up.id,
                        fileName: up.fileName || file.name,
                        fileType: up.fileType || file.type,
                        size: up.size || file.size,
                        url: up.url,
                        category: up.category || category
                      });
                    }
                  } catch (uploadError) {
                    console.error(`Error subiendo archivo ${file?.name} en categoría ${category}:`, uploadError);
                    throw uploadError; // Re-lanzar para que se capture en el catch externo
                  }
                }
              } catch (e) {
                console.error('Error subiendo archivo', file?.name, e);
                toast.error(`Error al subir ${file?.name || 'archivo'}: ${e.message || 'Error desconocido'}`);
              }
            }
            if (uploadedFilesForCategory.length > 0) {
              filesByCategory[category] = uploadedFilesForCategory;
            }
          }
        }
      }

      // Enviar al backend para asociar a la consulta
      // El backend espera un objeto con categorías: { PRESCRIPTION_REQUEST: [...], STUDY_RESULT: [...], etc. }
      console.log('Enviando archivos al backend:', {
        consultationId,
        filesByCategory,
        linksCount: Array.isArray(links) ? links.length : 0
      });
      
      const resp = await consultationService.addAttachmentsToConsultation(consultationId, {
        files: filesByCategory,
        links: Array.isArray(links) ? links : []
      });
      
      console.log('RESP ADJUNTOS:', resp);
      toast.success('Archivos agregados exitosamente');
      // Forzar refresco de registros para ver los archivos reflejados
      await refreshMedicalRecords();
      await refreshDividedConsultations();
      setShowAddAttachments(false);
    } catch (err) {
      console.error('Error al agregar archivos:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error al agregar archivos';
      toast.error(errorMessage);
    }
  };

  // Función auxiliar para verificar si un valor está vacío
  const isEmptyValue = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  };

  // Campos del sistema que no deben mostrarse como campos de formulario
  // Incluir variaciones en diferentes casos (case-insensitive)
  const SYSTEM_FIELDS = [
    'reason', 'tags', 'fecha', 'notas', 'etiquetas', 'notapublica', 'nota_publica',
    'motivoconsulta', 'motivo_consulta', 'evolucionclinica', 'evolucion_clinica',
    'date', 'notes', 'diagnosis', 'treatment', 'clinicalevolution', 'clinical_evolution',
    'ispublic', 'is_public', 'iseditable', 'is_editable', 'createdat', 'created_at',
    'updatedat', 'updated_at', 'userid', 'user_id', 'patientid', 'patient_id',
    'doctorpatientid', 'doctor_patient_id', 'clinicalcaseid', 'clinical_case_id'
  ];
  
  // Función helper para verificar si un campo es del sistema (case-insensitive)
  const isSystemField = (fieldId) => {
    const normalizedFieldId = String(fieldId).trim().toLowerCase();
    return SYSTEM_FIELDS.includes(normalizedFieldId);
  };
  
  // Agrupar los campos de formData por template
  const { formData } = consultation;
  const fieldsByTemplate = {};
  const unmappedFields = []; // Campos que no se encontraron en ningún template
  
  if (formData && typeof formData === 'object') {
    // Crear un mapa de fieldId -> { templateName, label } para búsqueda rápida
    // Usar dos mapas: uno con IDs originales y otro normalizado (para comparación case-insensitive)
    const fieldIdToInfo = {};
    const normalizedIdToInfo = {};
    
    if (formTemplates && formTemplates.length > 0) {
      formTemplates.forEach(template => {
        template.fields.forEach(field => {
          const fieldId = String(field.id).trim();
          // Mapa con ID original (por si acaso hay coincidencia exacta)
          fieldIdToInfo[fieldId] = {
            originalId: field.id,
            templateName: template.name,
            label: field.label,
            fieldType: field.fieldType
          };
          
          // Mapa normalizado (lowercase) para comparación case-insensitive
          const normalizedId = fieldId.toLowerCase();
          // IMPORTANTE: Si hay múltiples campos con el mismo ID normalizado, mantener el último
          normalizedIdToInfo[normalizedId] = {
            originalId: field.id,
            templateName: template.name,
            label: field.label,
            fieldType: field.fieldType
          };
        });
      });
      
      // Debug: Verificar que los campos problemáticos estén en el mapa
      const datosMedicosTemplate = formTemplates.find(t => t.name === 'Datos médicos generales');
      if (datosMedicosTemplate) {
        console.log('📋 Verificando campos de "Datos médicos generales":');
        datosMedicosTemplate.fields
          .filter(f => ['Peso', 'Talla', 'Edad'].some(label => f.label.includes(label)))
          .forEach(f => {
            const normalized = String(f.id).trim().toLowerCase();
            console.log(`   Campo "${f.label}": ID original="${f.id}", normalized="${normalized}"`);
            console.log(`   ¿En normalizedIdToInfo? ${!!normalizedIdToInfo[normalized]}`);
          });
      }
    }
    
    // Debug: Verificar construcción de mapas
    console.log('=== DEBUG FORM DATA DISPLAY ===');
    console.log('formTemplates count:', formTemplates?.length || 0);
    console.log('normalizedIdToInfo size después de construcción:', Object.keys(normalizedIdToInfo).length);
    
    // Verificar que los campos problemáticos estén en normalizedIdToInfo
    // Los UUIDs vienen con mayúsculas en formData, pero necesitamos compararlos normalizados
    const problematicUUIDs = ['8c6ce043-6469-4441-8746-d3fcab182248', '9885e84d-1f56-4c3d-93af-af26363c77c3', 'c1fd3b54-112e-49b3-8130-ec19f9270dfd'];
    console.log('🔍 Verificando UUIDs problemáticos en normalizedIdToInfo:');
    problematicUUIDs.forEach(uuid => {
      const normalized = uuid.toLowerCase();
      const found = normalizedIdToInfo[normalized];
      if (found) {
        console.log(`✅ UUID ${uuid} (normalized: ${normalized}) encontrado:`, found);
      } else {
        console.log(`❌ UUID ${uuid} (normalized: ${normalized}) NO encontrado`);
        // Buscar IDs similares en el mapa
        const similarKeys = Object.keys(normalizedIdToInfo).filter(k => 
          k.includes(uuid.substring(0, 8)) || uuid.includes(k.substring(0, 8))
        );
        if (similarKeys.length > 0) {
          console.log(`   📝 IDs similares encontrados:`, similarKeys.slice(0, 3));
        }
      }
    });
    
    // También verificar qué UUIDs están realmente en formData
    const formDataUUIDs = Object.keys(formData).filter(k => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)
    );
    console.log('🔍 UUIDs en formData (primeros 5):', formDataUUIDs.slice(0, 5).map(uuid => ({
      original: uuid,
      normalized: uuid.toLowerCase(),
      enMapa: !!normalizedIdToInfo[uuid.toLowerCase()]
    })));
    
    // Agrupar campos por template, solo los que tienen valores
    Object.keys(formData).forEach(fieldId => {
      // Ignorar campos del sistema (case-insensitive)
      if (isSystemField(fieldId)) return;
      
      const value = formData[fieldId];
      // Filtrar campos vacíos
      if (isEmptyValue(value)) return;
      
      // Intentar encontrar el campo en los templates
      // Normalizar el ID para búsqueda (case-insensitive)
      const trimmedFieldId = String(fieldId).trim();
      const normalizedFieldId = trimmedFieldId.toLowerCase();
      
      // Primero: búsqueda exacta por ID original
      let fieldInfo = fieldIdToInfo[trimmedFieldId];
      
      // Segundo: búsqueda normalizada (case-insensitive) - esto es clave para UUIDs
      if (!fieldInfo && normalizedIdToInfo[normalizedFieldId]) {
        fieldInfo = normalizedIdToInfo[normalizedFieldId];
      }
      
      // Tercero: búsqueda directa en templates (último recurso, pero con normalización)
      if (!fieldInfo && formTemplates && formTemplates.length > 0) {
        for (const template of formTemplates) {
          const foundField = template.fields.find(f => {
            const templateFieldId = String(f.id).trim().toLowerCase();
            return templateFieldId === normalizedFieldId;
          });
          
          if (foundField) {
            fieldInfo = {
              templateName: template.name,
              label: foundField.label,
              fieldType: foundField.fieldType
            };
            // Actualizar los mapas para futuras búsquedas
            fieldIdToInfo[trimmedFieldId] = fieldInfo;
            normalizedIdToInfo[normalizedFieldId] = fieldInfo;
            break;
          }
        }
      }
      
      // Cuarto: Si aún no se encontró, intentar buscar por valor conocido
      // Esto es útil cuando los IDs cambian pero los valores son únicos (peso=95, talla=173, edad=42)
      if (!fieldInfo && formTemplates && formTemplates.length > 0) {
        // Crear un mapa de valores conocidos a labels
        const valueToLabelMap = {
          95: ['Peso'],
          173: ['Talla', 'Altura'],
          42: ['Edad']
        };
        
        // Buscar en el template "Datos médicos generales"
        const datosMedicosTemplate = formTemplates.find(t => t.name === 'Datos médicos generales');
        if (datosMedicosTemplate && valueToLabelMap[value]) {
          const possibleLabels = valueToLabelMap[value];
          const foundField = datosMedicosTemplate.fields.find(f => 
            possibleLabels.some(label => f.label.includes(label))
          );
          
          if (foundField) {
            fieldInfo = {
              templateName: datosMedicosTemplate.name,
              label: foundField.label,
              fieldType: foundField.fieldType
            };
            console.log(`🔧 Mapeado por valor conocido: ${value} -> "${foundField.label}"`);
            // Actualizar los mapas para futuras búsquedas
            fieldIdToInfo[trimmedFieldId] = fieldInfo;
            normalizedIdToInfo[normalizedFieldId] = fieldInfo;
          }
        }
      }
      
      // Debug específico para campos problemáticos
      if (!fieldInfo && (value === 95 || value === 173 || value === 42 || value === '95' || value === '173' || value === '42')) {
        console.log(`🔍 DEBUG campo problemático: ${trimmedFieldId}`);
        console.log(`   Normalized: ${normalizedFieldId}`);
        console.log(`   En normalizedIdToInfo: ${!!normalizedIdToInfo[normalizedFieldId]}`);
        if (normalizedIdToInfo[normalizedFieldId]) {
          console.log(`   ¡DEBERÍA ESTAR MAPEADO!`, normalizedIdToInfo[normalizedFieldId]);
        }
      }
      
      if (fieldInfo) {
        // Campo encontrado en un template - usar el label del template
        console.log(`✅ MAPEADO CORRECTAMENTE: ${fieldId} -> "${fieldInfo.label}" en template "${fieldInfo.templateName}"`);
        if (!fieldsByTemplate[fieldInfo.templateName]) {
          fieldsByTemplate[fieldInfo.templateName] = [];
        }
        fieldsByTemplate[fieldInfo.templateName].push({
          label: fieldInfo.label, // Usar el label del template, no el ID
          value: value,
          fieldType: fieldInfo.fieldType
        });
      } else {
        // Campo no encontrado en templates
        console.log(`❌ NO MAPEADO: ${fieldId} = ${value} (no se encontró en ningún template)`);
        unmappedFields.push({
          id: fieldId,
          label: fieldId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          value: value
        });
      }
    });
    
    console.log('=== RESUMEN DE MAPEO ===');
    console.log(`Total campos en formData: ${Object.keys(formData).length}`);
    console.log(`Campos mapeados por template:`, Object.keys(fieldsByTemplate));
    Object.keys(fieldsByTemplate).forEach(templateName => {
      console.log(`  - ${templateName}: ${fieldsByTemplate[templateName].length} campos`);
    });
    console.log(`Campos no mapeados: ${unmappedFields.length}`);
    if (unmappedFields.length > 0) {
      console.log('  Campos sin mapear:', unmappedFields.map(f => f.id));
    }
    console.log('=== END DEBUG ===');
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
        >
          <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" />
          Volver al Historial
        </button>
        
        <div className="flex gap-2">
          {canEdit && (
            <button
              onClick={() => setShowEditConsultation(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              title="Añadir o editar notas, diagnóstico y datos de la consulta"
            >
              <PencilIcon className="-ml-1 mr-2 h-5 w-5" />
              Editar consulta
            </button>
          )}
          <button
            onClick={() => setShowAddAttachments(true)}
            disabled={!canEdit}
            title={
              !canEdit
                ? 'Consulta bloqueada o sin permisos'
                : 'Agregar archivos y enlaces'
            }
            className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              !canEdit
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Agregar Archivos
          </button>
        </div>
      </div>
      <div className="border-b pb-4 mb-4">
        <h3 className="text-2xl font-bold text-gray-800">Detalle de la Consulta</h3>
        <p className="text-sm text-gray-500">
          {formatDate(consultation.date || consultation.createdAt)}
        </p>
        {/* Mostrar evolución clínica */}
        {consultation.clinicalEvolution && (
          <span className="inline-block text-xs text-blue-700 bg-blue-100 rounded px-2 py-0.5 font-semibold mt-1">
            Evolución clínica: {CLINICAL_EVOLUTION_LABELS[consultation.clinicalEvolution] || consultation.clinicalEvolution}
          </span>
        )}
      </div>
      <div className="space-y-6">
        <div>
          <h4 className="font-semibold text-lg text-gray-700">Notas (Diagnóstico y Tratamiento)</h4>
          <p className="mt-1 text-gray-600 whitespace-pre-wrap">{consultation.notes || 'No se proporcionaron notas.'}</p>
        </div>
        {(Object.entries(fieldsByTemplate).some(([_, fields]) => fields.some(f => !isEmptyValue(f.value))) || unmappedFields.some(f => !isEmptyValue(f.value))) && (
          <div>
            <h4 className="font-semibold text-lg text-gray-700 mb-2">Formularios especiales</h4>
            <div className="space-y-6">
              {Object.entries(fieldsByTemplate).map(([templateName, fields]) => {
                // Filtrar campos vacíos antes de renderizar
                const fieldsWithValues = fields.filter(({ value }) => !isEmptyValue(value));
                
                if (fieldsWithValues.length === 0) return null;
                
                return (
                  <div key={templateName} className="p-4 border rounded-md bg-gray-50 mb-4">
                    <h5 className="font-bold text-blue-700 mb-3 text-lg">{templateName}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fieldsWithValues.map(({ label, value, fieldType }, idx) => {
                        // Formatear el valor según el tipo de campo
                        let displayValue = value;
                        if (label && label.toLowerCase().includes('edad')) {
                          displayValue = formatAgeFieldValue(value) || String(value);
                        } else if (fieldType === 'SELECT' && Array.isArray(value)) {
                          displayValue = value.join(', ');
                        } else if (fieldType === 'TEXTAREA') {
                          displayValue = String(value);
                        } else {
                          displayValue = String(value);
                        }
                        
                        const isAgeField = label && label.toLowerCase().includes('edad');
                        return (
                          <div key={`${templateName}-${idx}`} className="border-b border-gray-200 pb-2">
                            <p className="font-medium text-sm text-gray-800 mb-1 flex items-center gap-1">
                              {label}
                              {isAgeField && (
                                <Tooltip text="Edad en el momento de la consulta o análisis" placement="top">
                                  <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
                                </Tooltip>
                              )}
                            </p>
                            <p className="text-gray-600 text-sm whitespace-pre-wrap break-words">{displayValue}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              
              {/* Mostrar campos no mapeados si existen (solo los que tienen valores) */}
              {unmappedFields.filter(({ value }) => !isEmptyValue(value)).length > 0 && (
                <div className="p-4 border rounded-md bg-yellow-50 mb-4">
                  <h5 className="font-bold text-yellow-700 mb-3 text-lg">Campos adicionales</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unmappedFields
                      .filter(({ value }) => !isEmptyValue(value))
                      .map(({ id, label, value }) => {
                        let displayValue = value;
                        if (Array.isArray(value)) {
                          displayValue = value.join(', ');
                        } else {
                          displayValue = String(value);
                        }
                        
                        return (
                          <div key={id} className="border-b border-yellow-200 pb-2">
                            <p className="font-medium text-sm text-gray-800 mb-1">{label || id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                            <p className="text-gray-600 text-sm whitespace-pre-wrap break-words">{displayValue}</p>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        
        {/* Archivos adjuntos con información extendida */}
        {consultation.files && consultation.files.length > 0 && (
          <div>
            <h4 className="font-semibold text-lg text-gray-700 mb-2">Archivos Adjuntos ({consultation.files.length})</h4>
            <FileHistoryViewer files={consultation.files} />
          </div>
        )}
        {/* Links de internet */}
        {consultation.links && consultation.links.length > 0 && (
          <div>
            <h4 className="font-semibold text-lg text-gray-700 mb-2">Vínculos de Internet ({consultation.links.length})</h4>
            <ul className="list-disc pl-5">
              {consultation.links.map((link, idx) => (
                <li key={idx} className="flex items-center gap-2 mb-1">
                  {getLinkIcon()}
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{link.url}</a>
                  <span className="text-xs text-gray-500 ml-2">{link.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Modal para agregar archivos adicionales */}
      {showAddAttachments && user && (
        <ConsultationAttachmentsForm
          isOpen={showAddAttachments}
          onClose={() => setShowAddAttachments(false)}
          onSubmit={handleAttachmentsSubmit}
          consultationId={consultation?.id}
          patientName={user?.role === 'PATIENT' 
            ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() 
            : `${patient?.user?.firstName || ''} ${patient?.user?.lastName || ''}`.trim()}
          padecimiento={selectedCase?.padecimiento || ''}
          initialData={{ files: consultation?.files || [], links: consultation?.links || [] }}
          readOnly={user?.role === 'PATIENT' ? false : !consultation?.isEditable}
          userRole={user?.role}
          isConsultationEditable={consultation?.isEditable}
          refreshMedicalRecords={refreshMedicalRecords}
          patient={patient}
          clinicalCase={selectedCase}
        />
      )}

      {/* Modal para editar consulta */}
      {showEditConsultation && user && patient && selectedCase && (
        <BasicConsultationForm
          key={`edit-${consultation?.id}`}
          isOpen={showEditConsultation}
          onClose={() => setShowEditConsultation(false)}
          onSubmit={handleEditConsultationSubmit}
          patientName={`${patient?.user?.firstName || ''} ${patient?.user?.lastName || ''}`.trim()}
          padecimiento={selectedCase?.padecimiento || ''}
          initialData={{
            date: consultation?.date || consultation?.formData?.fecha,
            reason: consultation?.reason || consultation?.formData?.motivoConsulta,
            notes: consultation?.notes,
            tags: Array.isArray(consultation?.tags) ? consultation.tags : (consultation?.formData?.etiquetas || []),
            clinicalEvolution: consultation?.clinicalEvolution || consultation?.formData?.evolucionClinica,
            isPublic: consultation?.isPublic ?? consultation?.formData?.notaPublica ?? false,
            formData: consultation?.formData || {},
            doctorCustomFormData: consultation?.doctorCustomFormData || []
          }}
          readOnly={false}
        />
      )}
    </div>
  );
};

// Modal para datos adicionales
const AdditionalDataModal = ({ isOpen, onClose, patient, lastDiagnosis, onSave }) => {
  useEffect(() => {
    if (isOpen) {
      console.log('emergencyContacts al abrir modal:', patient.emergencyContacts);
      if (patient.emergencyContacts && patient.emergencyContacts.length > 0) {
        console.log('Primer contacto de emergencia:', patient.emergencyContacts[0]);
      } else {
        console.log('No hay contacto de emergencia registrado');
      }
    }
  }, [isOpen, patient]);

  // Ajuste: siempre tomar el primer contacto de emergencia si existe
  const emergencyContact = patient.emergencyContacts && patient.emergencyContacts.length > 0 ? patient.emergencyContacts[0] : {};
  const getDisplayEmail = () => {
    const raw = patient.email || patient.user?.email || '';
    return (raw && !String(raw).startsWith('patient-no-email@')) ? raw : '';
  };

  const [form, setForm] = useState({
    email: getDisplayEmail(),
    phone: patient.phone || '',
    taxName: patient.taxName || '',
    taxId: patient.taxId || '',
    taxAddress: patient.taxAddress || '',
    gender: patient.gender || '',
    birthDate: patient.birthDate || patient.dateOfBirth ? (patient.birthDate || patient.dateOfBirth).slice(0,10) : '',
    bloodType: patient.bloodType || '',
    allergies: patient.allergies || '',
    chronicDiseases: patient.chronicDiseases || '',
    taxCertificate: null,
    taxCertificateUrl: patient.taxCertificateUrl || '',
    emergencyContactFirstName: emergencyContact.firstName || '',
    emergencyContactLastName: emergencyContact.lastName || '',
    emergencyContactEmail: emergencyContact.email || '',
    emergencyContactPhone: emergencyContact.phone || '',
    emergencyContactRelationship: emergencyContact.relationship || '',
  });

  useEffect(() => {
    if (isOpen) {
      const emergencyContact = patient.emergencyContacts && patient.emergencyContacts.length > 0 ? patient.emergencyContacts[0] : {};
      const raw = patient.email || patient.user?.email || '';
      const displayEmail = (raw && !String(raw).startsWith('patient-no-email@')) ? raw : '';
      setForm({
        email: displayEmail,
        phone: patient.phone || '',
        taxName: patient.taxName || '',
        taxId: patient.taxId || '',
        taxAddress: patient.taxAddress || '',
        gender: patient.gender || '',
        birthDate: patient.birthDate || patient.dateOfBirth ? (patient.birthDate || patient.dateOfBirth).slice(0,10) : '',
        bloodType: patient.bloodType || '',
        allergies: patient.allergies || '',
        chronicDiseases: patient.chronicDiseases || '',
        taxCertificate: null,
        taxCertificateUrl: patient.taxCertificateUrl || '',
        emergencyContactFirstName: emergencyContact.firstName || '',
        emergencyContactLastName: emergencyContact.lastName || '',
        emergencyContactEmail: emergencyContact.email || '',
        emergencyContactPhone: emergencyContact.phone || '',
        emergencyContactRelationship: emergencyContact.relationship || '',
      });
    }
  }, [isOpen, patient.id, patient.emergencyContacts, patient.email, patient.user?.email]);

  const [signedTaxUrl, setSignedTaxUrl] = useState('');

  useEffect(() => {
    async function fetchSignedTaxUrl() {
      if (form.taxCertificateUrl) {
        try {
          const token = localStorage.getItem('token');
          const res = await axios.get('/api/files/signed-url', {
            params: { url: form.taxCertificateUrl },
            headers: { Authorization: `Bearer ${token}` }
          });
          setSignedTaxUrl(res.data.url);
        } catch {
          setSignedTaxUrl('');
        }
      } else {
        setSignedTaxUrl('');
      }
    }
    fetchSignedTaxUrl();
  }, [form.taxCertificateUrl]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;
    if (type === 'file') {
      setForm({ ...form, [name]: files[0] });
    } else {
      setForm({ ...form, [name]: value });
    }
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    const { emergencyContactFirstName, emergencyContactLastName, emergencyContactEmail, emergencyContactPhone, emergencyContactRelationship, ...rest } = form;
    const emergencyContact = {
      firstName: emergencyContactFirstName,
      lastName: emergencyContactLastName,
      email: emergencyContactEmail,
      phone: emergencyContactPhone,
      relationship: emergencyContactRelationship
    };
    onSave({ ...rest, emergencyContact });
  };
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Datos adicionales"
      className="bg-white rounded-xl p-6 max-w-lg mx-auto mt-24 shadow-xl border border-gray-200 outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
      ariaHideApp={false}
    >
      <h2 className="text-2xl font-bold mb-4">Datos adicionales del paciente</h2>
      <div className="max-h-[70vh] overflow-y-auto pr-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 flex items-center">
              Correo electrónico del paciente
              <div className="relative ml-1 group">
                <InformationCircleIcon className="h-4 w-4 text-blue-500 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                  Puedes actualizar el correo de tu paciente, a este mail le llegarán las recetas, citas y eventos de calendario. Al registrar el correo el paciente recibirá una invitación para entrar a la plataforma y ver únicamente su información.
                </div>
              </div>
            </label>
            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="Agregar correo si no estaba registrado" className="form-input mt-1 w-full" />
            {!getDisplayEmail() && (
              <p className="text-xs text-amber-600 mt-1">Puedes agregar el correo aquí para vincularlo al historial sin crear un nuevo registro.</p>
            )}
          </div>
          <div>
            <PhoneInput name="phone" label="Teléfono" value={form.phone} onChange={handleChange} placeholder="Ej: 55 1234 5678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Género</label>
            <select name="gender" value={form.gender} onChange={handleChange} className="form-input mt-1 w-full">
              <option value="">Selecciona...</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de nacimiento</label>
            <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de sangre</label>
            <select name="bloodType" value={form.bloodType} onChange={handleChange} className="form-input mt-1 w-full">
              <option value="">Selecciona...</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Alergias</label>
            <textarea name="allergies" value={form.allergies} onChange={handleChange} className="form-input mt-1 w-full" rows="2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Enfermedades crónicas</label>
            <textarea name="chronicDiseases" value={form.chronicDiseases} onChange={handleChange} className="form-input mt-1 w-full" rows="2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contacto de emergencia - Nombre</label>
            <input type="text" name="emergencyContactFirstName" value={form.emergencyContactFirstName} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contacto de emergencia - Apellido</label>
            <input type="text" name="emergencyContactLastName" value={form.emergencyContactLastName} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contacto de emergencia - Email</label>
            <input type="email" name="emergencyContactEmail" value={form.emergencyContactEmail} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <PhoneInput name="emergencyContactPhone" label="Contacto de emergencia - Teléfono" value={form.emergencyContactPhone} onChange={handleChange} placeholder="Ej: 55 1234 5678" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contacto de emergencia - Relación</label>
            <input type="text" name="emergencyContactRelationship" value={form.emergencyContactRelationship} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Razón social</label>
            <input type="text" name="taxName" value={form.taxName} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">RFC</label>
            <input type="text" name="taxId" value={form.taxId} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dirección fiscal</label>
            <input type="text" name="taxAddress" value={form.taxAddress} onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Constancia de situación fiscal</label>
            {form.taxCertificateUrl && signedTaxUrl && (
              <a href={signedTaxUrl} target="_blank" rel="noopener noreferrer" className="block text-blue-600 underline mb-2">Ver archivo actual</a>
            )}
            <input type="file" name="taxCertificate" accept=".pdf,.jpg,.jpeg,.png" onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Foto de perfil</label>
            <input type="file" name="profilePicture" accept="image/*" onChange={handleChange} className="form-input mt-1 w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md text-gray-700">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">Guardar</button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

const DoctorSearchModal = ({ isOpen, onClose, onSelect, loading, error, clinicalCaseId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = React.useRef();
  const dropdownRef = React.useRef();
  const minChars = 2;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) && 
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  useEffect(() => {
    if (query.length >= minChars) {
      setSearching(true);
      setSearchError('');
      const token = localStorage.getItem('token');
      if (!token) {
        setSearchError('No hay token de autenticación');
        setSearching(false);
        return;
      }
      searchHealthProfessionals(query)
        .then((data) => {
          // Solo mostrar rol DOCTOR; nunca ASISTENTE ni PACIENTE
          const filtered = Array.isArray(data) ? data.filter((p) => p.role === 'DOCTOR') : [];
          setResults(filtered);
          setShowDropdown(true);
        })
        .catch((error) => {
          console.error('Search error:', error);
          const msg = error.response?.data?.message || error.message;
          setSearchError(`Error al buscar: ${msg}`);
          setResults([]);
        })
        .finally(() => setSearching(false));
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query]);

  const handleSelectDoctor = (professional) => {
    setSelectedDoctor(professional);
    setShowDropdown(false);
    const roleText = 'Profesional'; // Solo DOCTOR en colaboración
    const specializationText = professional.specialization ? ` - ${professional.specialization}` : '';
    const displayText = `${professional.firstName} ${professional.lastName} (${roleText}${specializationText})`;
    setQuery(displayText);
    professional.displayText = displayText;
  };

  const [externalEmail, setExternalEmail] = useState('');
  const [sendingExternal, setSendingExternal] = useState(false);
  const [externalMsg, setExternalMsg] = useState('');

  const handleInviteExternal = async () => {
    setExternalMsg('');
    if (!externalEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail)) {
      setExternalMsg('Ingresa un correo válido');
      return;
    }
    if (!clinicalCaseId) {
      setExternalMsg('Error: No se ha seleccionado un caso clínico');
      return;
    }
    try {
      setSendingExternal(true);
      const { data } = await axios.post('/api/collaboration/invite-external', {
        email: externalEmail,
        clinicalCaseId
      });
      setExternalMsg(data.message || 'Invitación enviada');
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'No se pudo enviar la invitación';
      setExternalMsg(msg);
    } finally {
      setSendingExternal(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Agregar colaborador"
      className="bg-white rounded-xl p-6 max-w-2xl w-full mx-auto mt-24 shadow-xl border border-gray-200 outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
      ariaHideApp={false}
    >
      <h2 className="text-xl font-bold mb-4">Agregar colaborador</h2>
      <div className="relative mb-4">
        <input
          ref={inputRef}
          type="text"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none w-full text-base"
          placeholder="Buscar Profesional de la Salud por nombre, apellido o email"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            if (selectedDoctor) {
              const currentDisplayText = selectedDoctor.displayText || `${selectedDoctor.firstName} ${selectedDoctor.lastName} (${selectedDoctor.role === 'DOCTOR' ? 'Profesional' : 'Asistente'}${selectedDoctor.specialization ? ` - ${selectedDoctor.specialization}` : ''})`;
              if (e.target.value !== currentDisplayText) {
                setSelectedDoctor(null);
              }
            }
          }}
          onFocus={() => { if (query.length >= minChars) setShowDropdown(true); }}
          autoComplete="off"
        />
        {searching && <span className="absolute right-3 top-3 w-4 h-4 animate-spin border-2 border-blue-400 border-t-transparent rounded-full"></span>}
        {showDropdown && (results.length > 0 || searching) && (
          <div ref={dropdownRef} className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-y-auto">
            {searching && (
              <div className="px-4 py-2 text-gray-500 text-center">Buscando...</div>
            )}
            {!searching && results.length > 0 && results.map(professional => (
              <div
                key={professional.id}
                className={`px-4 py-2 cursor-pointer hover:bg-blue-100 ${selectedDoctor && selectedDoctor.id === professional.id ? 'bg-blue-200' : ''}`}
                onClick={() => handleSelectDoctor(professional)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{professional.firstName} {professional.lastName}</span>
                    <span className="ml-2 text-xs text-gray-500">{professional.email}</span>
                  </div>
                  <div className="text-xs text-blue-600">
                    Profesional
                    {professional.specialization && ` - ${professional.specialization}`}
                  </div>
                </div>
              </div>
            ))}
            {!searching && results.length === 0 && query.length >= minChars && (
              <div className="px-4 py-2 text-gray-500 text-center">No se encontraron Profesionales de la Salud.</div>
            )}
            {!searching && results.length === 0 && query.length > 0 && query.length < minChars && (
              <div className="px-4 py-2 text-gray-500 text-center">Escribe al menos {minChars} caracteres para buscar...</div>
            )}
          </div>
        )}
      </div>
      {searchError && <p className="text-red-500 mb-2">{searchError}</p>}
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <div className="mt-6 border-t pt-4">
        <div className="mb-2 text-sm text-gray-600">¿El Profesional no aparece en la búsqueda? Envíale una invitación por correo:</div>
        <div className="flex gap-2 items-center">
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={externalEmail}
            onChange={e => setExternalEmail(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none"
          />
          <button
            onClick={handleInviteExternal}
            disabled={sendingExternal}
            className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {sendingExternal ? 'Enviando...' : 'Invitar por correo'}
          </button>
        </div>
        {externalMsg && (
          <div className={`mt-2 text-sm ${externalMsg.includes('enviada') || externalMsg.includes('enviado') ? 'text-green-600' : 'text-red-600'}`}>
            {externalMsg}
          </div>
        )}
        <div className="mt-2 text-xs text-gray-500">
          Le llegará un mensaje por correo al Profesional de la Salud donde lo invitas a colaborar en el expediente clínico de este paciente y padecimiento en específico, con un link para que se registre en la plataforma
        </div>
      </div>
      <div className="flex justify-end mt-6 gap-2">
        <button onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">Cancelar</button>
        <button
          onClick={() => onSelect(selectedDoctor)}
          disabled={!selectedDoctor || loading}
          className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Compartiendo...' : 'Confirmar'}
        </button>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        <Tooltip placement="bottom" text="Al compartir el historial compartirás este historial clínico completo de este padecimiento con otro Profesional de la Salud y alimentarán este historial clínico. Las consultas quedarán guardadas a nombre del Profesional que lo haya realizado. En automático se enviará por mail al Profesional de la salud colaborador el Aviso de Privacidad del paciente.">
          <span className="underline cursor-help">¿Qué significa compartir?</span>
        </Tooltip>
      </div>
    </Modal>
  );
};

// --- Componente Principal ---

const MedicalRecords = () => {
  const { patientId: pathPatientId } = useParams();
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId');
  const queryClinicalCaseId = searchParams.get('clinicalCaseId');
  const { user } = useAuth();
  
  // Si el usuario es PACIENTE, no usar user.id como patientId (user.id !== patient.id).
  // Para doctores/asistentes, usar el patientId proveniente de la ruta o query.
  const patientId = user?.role === 'PATIENT' ? null : (pathPatientId || queryPatientId);
  
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isDoctorTemplateModalOpen, setIsDoctorTemplateModalOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  // Estados para consultas divididas
  const [showDividedConsultationManager, setShowDividedConsultationManager] = useState(false);
  const [isViewConsultationModalOpen, setIsViewConsultationModalOpen] = useState(false);
  const [consultationToView, setConsultationToView] = useState(null);
  const [error, setError] = useState('');
  const [fieldLabels, setFieldLabels] = useState({});
  const [isAdditionalModalOpen, setIsAdditionalModalOpen] = useState(false);
  const [photoHistory, setPhotoHistory] = useState([]);
  const [filteredPhotoHistory, setFilteredPhotoHistory] = useState([]);
  const [photoHistoryRefreshKey, setPhotoHistoryRefreshKey] = useState(0);
  const [isPhotoHistoryOpen, setIsPhotoHistoryOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [newlyCreatedPatient, setNewlyCreatedPatient] = useState(null);
  // Usar el hook correcto según el rol del usuario
  const {
    cases: clinicalCases,
    loading: loadingCases,
    error: errorCases,
    isSubmitting: isSubmittingCase,
    selectedCase,
    setSelectedCase,
    createCase,
    updateCase,
    deleteCase,
    refreshCases
  } = user?.role === 'PATIENT' 
    ? usePatientClinicalCases() 
    : useClinicalCases(patientId);
  
  // Hook para consultas divididas (después de que selectedCase esté disponible)
  const {
    consultations: dividedConsultations,
    pendingConsultations,
    stats: consultationStats,
    loading: loadingDividedConsultations,
    createBasicConsultation,
    addAttachmentsToConsultation,
    markConsultationComplete,
    refresh: refreshDividedConsultations
  } = useDividedConsultations(patient?.id, selectedCase?.id || null);
  
  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [refreshTimeout, setRefreshTimeout] = useState(null);
  const [autoRefreshMessage, setAutoRefreshMessage] = useState('');
  const [formTemplates, setFormTemplates] = useState([]);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [selectedCaseForCollab, setSelectedCaseForCollab] = useState(null);
  const [collabLoading, setCollabLoading] = useState(false);
  const [collabError, setCollabError] = useState('');

  const handleOpenCollab = (caso) => {
    setSelectedCaseForCollab(caso);
    setCollabModalOpen(true);
  };
  const handleCloseCollab = () => {
    setCollabModalOpen(false);
    setSelectedCaseForCollab(null);
    setCollabError('');
  };
  const handleSelectDoctor = async (doctor) => {
    if (!doctor || !selectedCaseForCollab) return;
    setCollabLoading(true);
    setCollabError('');
    try {
      const requestBody = {
        patientId: selectedCaseForCollab.patientId,
        padecimientoId: selectedCaseForCollab.id,
        doctorId: doctor.id,
        rol: 'colaborador'
      };
      const token = localStorage.getItem('token');
      const { data } = await axios.post(getApiUrl('/api/collaborative-work/collaborators'), requestBody, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });
      toast.success(data.message || 'Caso clínico compartido correctamente. El doctor recibirá un email y una notificación (campanita) para colaborar en este caso.');
      refreshCases();
      handleCloseCollab();
    } catch (err) {
      const apiError = err.response?.data?.error || err.response?.data?.message || err.message;
      setCollabError(apiError || 'No se pudo agregar colaborador. Intenta de nuevo.');
      toast.error(apiError || 'No se pudo agregar colaborador.');
    } finally {
      setCollabLoading(false);
    }
  };
  
  // Cargar plantillas de formularios
  useEffect(() => {
    const loadFormTemplates = async () => {
      try {
        const templates = await getFormTemplates();
        setFormTemplates(templates);
      } catch (error) {
        console.error('Error al cargar formTemplates:', error);
      }
    };
    loadFormTemplates();
  }, []);

  // Hook real de notas clínicas - usar el hook correcto según el rol
  const {
    medicalRecords,
    loading: loadingRecords,
    error: errorRecords,
    createMedicalRecord,
    updateMedicalRecord,
    deleteMedicalRecord,
    refreshMedicalRecords,
    setClinicalCaseId
  } = user?.role === 'PATIENT' 
    ? usePatientMedicalRecords(selectedCase?.id)
    : useMedicalRecords(patientId);

  // Obtener el padecimiento de la última nota clínica
  const lastConsultation = medicalRecords && medicalRecords.length > 0 ? medicalRecords[0] : null;
  const lastDiagnosis = lastConsultation?.diagnosis || lastConsultation?.notes || '';
  const lastTag = lastConsultation?.tags && lastConsultation.tags.length > 0 ? lastConsultation.tags[0] : '';

  const getAssistantDoctorHeader = () => {
    if (user?.role !== 'ASISTENTE') return {};
    const selectedDoctorId = localStorage.getItem('selectedDoctorId');
    if (!selectedDoctorId) return {};
    return { 'X-Selected-Doctor-Id': selectedDoctorId };
  };

  useEffect(() => {
    const fetchPatientData = async () => {
      if (patientId) {
        setError('');
        try {
          const patientDetails = await getPatientDetails(patientId);
          setPatient(patientDetails);
          // Fetch photo history
          const token = localStorage.getItem('token');
          console.log('=== Cargando photoHistory ===');
          console.log('URL:', `/api/patients/${patientId}/photo-history`);
          console.log('Token:', token ? 'Disponible' : 'NO disponible');
          
          const resp = await fetch(getApiUrl(`/api/patients/${patientId}/photo-history`), {
            headers: {
              Authorization: `Bearer ${token}`,
              ...getAssistantDoctorHeader()
            }
          });
          
          console.log('Respuesta status:', resp.status);
          console.log('Respuesta headers:', Object.fromEntries(resp.headers.entries()));
          
          if (resp.status === 404) {
            console.log('Endpoint no encontrado (404)');
            setPhotoHistory([]);
          } else if (resp.ok) {
            const photos = await resp.json();
            console.log('Photos cargadas:', photos);
            console.log('Photos length:', photos?.length);
            setPhotoHistory(photos);
          } else {
            console.error('Error en respuesta:', resp.status, resp.statusText);
            const errorText = await resp.text();
            console.error('Error body:', errorText);
            setPhotoHistory([]);
          }
        } catch (err) {
          console.error('Error al cargar photoHistory:', err);
          setError('No se pudo cargar la información del paciente.');
          setPatient(null);
          setPhotoHistory([]);
        }
      } else if (user?.role === 'PATIENT') {
        // Vista de PACIENTE: no llamar a getPatientDetails (requiere patientId).
        // Inicializar datos mínimos del paciente desde el usuario autenticado.
        // Incluir profilePictureUrl para que se muestre en el círculo del Historial Clínico.
        setPatient({
          id: 'self',
          profilePictureUrl: user.profilePictureUrl || null,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          dateOfBirth: null,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone || ''
          }
        });
        // Cargar su propio photoHistory
        setError('');
        try {
          const token = localStorage.getItem('token');
          console.log('=== Cargando photoHistory del paciente ===');
          console.log('URL:', `/api/patients/my/photo-history`);
          console.log('Token:', token ? 'Disponible' : 'NO disponible');
          
          const resp = await fetch(getApiUrl(`/api/patients/my/photo-history`), {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          console.log('Respuesta status:', resp.status);
          console.log('Respuesta headers:', Object.fromEntries(resp.headers.entries()));
          
          if (resp.status === 404) {
            console.log('Endpoint no encontrado (404)');
            setPhotoHistory([]);
          } else if (resp.ok) {
            const photos = await resp.json();
            console.log('Photos cargadas:', photos);
            console.log('Photos length:', photos?.length);
            setPhotoHistory(photos);
          } else {
            console.error('Error en respuesta:', resp.status, resp.statusText);
            const errorText = await resp.text();
            console.error('Error body:', errorText);
            setPhotoHistory([]);
          }
        } catch (err) {
          console.error('Error al cargar photoHistory del paciente:', err);
          setError('No se pudo cargar la información del paciente.');
          setPhotoHistory([]);
        }
      } else {
        setPatient(null);
        setPhotoHistory([]);
      }
      setSelectedConsultation(null);
    };
    fetchPatientData();
  }, [patientId, user?.role, photoHistoryRefreshKey]);

  useEffect(() => {
    getFormTemplates().then(templates => {
      setFormTemplates(templates);
      const labels = {};
      templates.forEach(t => t.fields.forEach(f => { labels[f.id] = f.label; }));
      setFieldLabels(labels);
    });
  }, []);

  // Filtrar photoHistory cuando cambie el caso clínico seleccionado
  useEffect(() => {
    console.log('=== Filtrando photoHistory ===');
    console.log('selectedCase:', selectedCase);
    console.log('photoHistory:', photoHistory);
    console.log('photoHistory.length:', photoHistory?.length);
    
    if (selectedCase && photoHistory.length > 0) {
      const filtered = photoHistory.filter(block => block.clinicalCaseId === selectedCase.id);
      console.log('Filtrado por caso clínico:', selectedCase.id);
      console.log('Resultado filtrado:', filtered);
      setFilteredPhotoHistory(filtered);
    } else {
      console.log('No hay caso seleccionado o photoHistory vacío');
      setFilteredPhotoHistory([]);
    }
  }, [selectedCase, photoHistory]);

  // Actualizar clinicalCaseId cuando se selecciona un caso clínico
  useEffect(() => {
    console.log('=== FRONTEND: Actualizando clinicalCaseId ===');
    console.log('selectedCase:', selectedCase);
    if (selectedCase) {
      console.log('Estableciendo clinicalCaseId:', selectedCase.id);
      setClinicalCaseId(selectedCase.id);
    } else {
      console.log('Limpiando clinicalCaseId');
      setClinicalCaseId(null);
    }
    console.log('=== FIN FRONTEND ===');
  }, [selectedCase, setClinicalCaseId]);

  // Seleccionar automáticamente el caso clínico si se proporciona en query parameters
  useEffect(() => {
    console.log('=== FRONTEND: Selección automática de caso clínico ===');
    console.log('queryClinicalCaseId:', queryClinicalCaseId);
    console.log('clinicalCases:', clinicalCases);
    console.log('clinicalCases.length:', clinicalCases?.length);

    if (clinicalCases && clinicalCases.length > 0) {
      if (queryClinicalCaseId) {
        const targetCase = clinicalCases.find(case_ => case_.id === queryClinicalCaseId);
        if (targetCase) {
          setSelectedCase(targetCase);
        } else {
          // Fallback: elegir el más reciente y actualizar la URL
          const mostRecent = [...clinicalCases].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          setSelectedCase(mostRecent);
          if (patientId && mostRecent?.id) {
            navigate(`/dashboard/medical-records?patientId=${patientId}&clinicalCaseId=${mostRecent.id}`, { replace: true });
          }
          toast.info('El caso solicitado no existe. Se abrió el caso clínico más reciente.');
        }
      }
    } else {
      console.log('No se puede seleccionar automáticamente:', {
        queryClinicalCaseId: !!queryClinicalCaseId,
        clinicalCases: !!clinicalCases,
        clinicalCasesLength: clinicalCases?.length
      });
    }
    console.log('=== FIN FRONTEND ===');
  }, [queryClinicalCaseId, clinicalCases, patientId, navigate]);

  useEffect(() => {
    if (isCreatingCase && (loadingCases || loadingRecords)) {
      setShowLoader(true);
      if (!refreshTimeout) {
        const timeout = setTimeout(() => {
          setAutoRefreshMessage('Hubo un problema al crear el caso clínico. La página se recargará automáticamente...');
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }, 10000); // 10 segundos
        setRefreshTimeout(timeout);
      }
    } else {
      setShowLoader(false);
      setAutoRefreshMessage('');
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        setRefreshTimeout(null);
      }
    }
    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
    };
  }, [isCreatingCase, loadingCases, loadingRecords]);

  const handleSelectPatient = (selectedPatient) => {
    navigate(`/dashboard/medical-records/${selectedPatient.id}`);
  };

  const handleCreatePatient = async (patientData) => {
    try {
        const newPatient = await createPatient(patientData);
        toast.success(`Paciente ${newPatient.firstName} registrado con éxito.`);
        setIsNewPatientModalOpen(false);
        
        // Establecer el paciente recién creado para mostrarlo en la búsqueda
        setNewlyCreatedPatient(newPatient);
        
        // Navegar al historial del nuevo paciente
        handleSelectPatient(newPatient);
        
        // Limpiar el paciente recién creado después de 10 segundos
        setTimeout(() => {
          setNewlyCreatedPatient(null);
        }, 10000);
        
    } catch(err) {
        toast.error(err.message || 'Error al registrar al paciente.');
    }
  };

  // Nueva consulta/nota clínica
  // Handlers para consultas divididas
  const handleConsultationCreated = (consultation) => {
    toast.success('Consulta creada exitosamente');
    refreshDividedConsultations();
    refreshMedicalRecords();
  };

  const handleConsultationUpdated = (consultation) => {
    toast.success('Consulta actualizada exitosamente');
    refreshDividedConsultations();
    refreshMedicalRecords();
  };

  const handleNewConsultationSubmit = async (consultationData) => {
    console.log('Payload enviado al crear consulta:', consultationData);
    const patientIdToUse = patientId || patient?.id;
    if (!patientIdToUse) {
      toast.error('No se ha seleccionado un paciente.');
      return;
    }
    try {
      setUploadProgress({});
      setUploadErrors({});
      toast.info('Subiendo archivos, por favor espera...', { toastId: 'uploading' });
      
      // 1. Subir todos los archivos de todas las categorías
      const allFiles = [];
      if (consultationData.files) {
        Object.entries(consultationData.files).forEach(([category, files]) => {
          if (Array.isArray(files)) {
            files.forEach(file => {
              allFiles.push({ file, category });
            });
          }
        });
      }

      // Si no hay archivos, continuar directamente
      if (allFiles.length === 0) {
        toast.dismiss('uploading');
        // Continuar con la creación de la consulta sin archivos
        const finalPayload = {
          notes: consultationData.notes,
          reason: consultationData.reason,
          diagnosis: consultationData.diagnosis || consultationData.notes,
          treatment: consultationData.treatment || consultationData.notes,
          tags: consultationData.tags,
          links: consultationData.links,
          clinicalEvolution: consultationData.clinicalEvolution,
          formData: consultationData.formData,
          fileIds: [],
          date: consultationData.date ? new Date(consultationData.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          clinicalCaseId: selectedCase?.id,
          isPublic: consultationData.isPublic,
        };
        
        await createMedicalRecord(finalPayload);
        await refreshMedicalRecords();
        await refreshCases();
        setIsNewConsultationModalOpen(false);
        setSelectedConsultation(null);
        toast.success('Nota clínica registrada exitosamente.');
        return;
      }

      // Subir archivos en paralelo con feedback
      const uploadResults = await Promise.allSettled(
        allFiles.map(({ file, category }) =>
          uploadFile(
            file,
            category,
            progressEvent => {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
            }
          )
        )
      );

      // Analizar resultados
      const successfulUploads = [];
      const failedUploads = [];
      uploadResults.forEach((result, index) => {
        const { file, category } = allFiles[index];
        if (result.status === 'fulfilled') {
          successfulUploads.push(result.value);
          setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        } else {
          const errorMessage = result.reason?.message || 'Error desconocido';
          failedUploads.push({ file: file.name, error: errorMessage });
          setUploadErrors(prev => ({ ...prev, [file.name]: errorMessage }));
        }
      });

      toast.dismiss('uploading');

      // Mostrar resultados
      if (successfulUploads.length > 0) {
        toast.success(`${successfulUploads.length} archivo(s) subido(s) correctamente.`);
      }

      if (failedUploads.length > 0) {
        const errorMessages = failedUploads.map(f => `${f.file}: ${f.error}`).join('\n');
        toast.error(
          `${failedUploads.length} archivo(s) no se pudieron subir:\n${errorMessages}`,
          { autoClose: 8000 }
        );
        
        // Preguntar al usuario si quiere continuar sin los archivos fallidos
        const shouldContinue = window.confirm(
          `${failedUploads.length} archivo(s) no se pudieron subir debido a restricciones de seguridad (tamaño, tipo de archivo, etc.).\n\n¿Deseas continuar guardando la consulta sin estos archivos?`
        );
        
        if (!shouldContinue) {
          return; // El usuario decidió no continuar
        }
      }

      const fileIds = successfulUploads.map(f => f.id).filter(Boolean);
      
      // Fecha: siempre guardar en formato YYYY-MM-DD (local)
      let dateToSave = consultationData.date;
      if (dateToSave) {
        // Asegurar que la fecha esté en formato YYYY-MM-DD
        if (typeof dateToSave === 'string' && dateToSave.includes('-')) {
          // Ya está en formato correcto
          dateToSave = dateToSave;
        } else {
          // Convertir a formato YYYY-MM-DD
          const d = new Date(dateToSave);
          dateToSave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        }
      } else {
        // Si no hay fecha, usar la fecha actual
        const today = new Date();
        dateToSave = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      }

      console.log('Fecha a guardar:', dateToSave);

      const finalPayload = {
        notes: consultationData.notes,
        reason: consultationData.reason,
        diagnosis: consultationData.diagnosis || consultationData.notes,
        treatment: consultationData.treatment || consultationData.notes,
        tags: consultationData.tags,
        links: consultationData.links,
        clinicalEvolution: consultationData.clinicalEvolution,
        formData: consultationData.formData,
        fileIds,
        date: dateToSave,
        clinicalCaseId: selectedCase?.id,
        isPublic: consultationData.isPublic,
      };

      console.log('Payload enviado a createMedicalRecord:', finalPayload);
      console.log('formData en payload:', JSON.stringify(consultationData.formData));
      console.log('Tipo de formData:', typeof consultationData.formData);
      console.log('formData es null/undefined:', consultationData.formData === null || consultationData.formData === undefined);
      
      await createMedicalRecord(finalPayload);
      await refreshMedicalRecords();
      await refreshCases();
      
      // Cierra el modal y limpia el estado solo después de refrescar
      setIsNewConsultationModalOpen(false);
      setSelectedConsultation(null);
      setUploadProgress({});
      setUploadErrors({});
      toast.success('Nota clínica registrada exitosamente.');
    } catch (err) {
      toast.dismiss('uploading');
      toast.error(err.message || 'Error al registrar la nota clínica.');
    }
  };

  const handleSaveAdditionalData = async (formData) => {
    try {
      let dataToSend = formData;
      const hasFiles = formData.taxCertificate || formData.profilePicture;
      if (hasFiles) {
        const fd = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
          if (key === 'emergencyContact' && typeof value === 'object') {
            fd.append('emergencyContact', JSON.stringify(value));
          } else if (value !== null && value !== undefined) {
            fd.append(key, value);
          }
        });
        dataToSend = fd;
      }
      await updatePatient(patient.id, dataToSend);
      toast.success('Datos guardados correctamente');
      // Refresca los datos del paciente para ver los cambios reflejados
      const updated = await getPatientDetails(patient.id);
      setPatient(updated);
      // Espera a que el estado se actualice antes de cerrar el modal
      setTimeout(() => {
        setIsAdditionalModalOpen(false);
      }, 100); // 100ms para asegurar el re-render
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Error al guardar los datos';
      toast.error(msg);
    }
  };

  // Al crear un nuevo caso clínico
  const handleCreateClinicalCase = async (caseData) => {
    setIsCreatingCase(true);
    try {
      // 1. Crear el caso clínico
      const newCase = await createCase({
        padecimiento: caseData.padecimiento
      });
      await refreshCases();
      setIsNewCaseModalOpen(false);
      setSelectedCase(newCase);
      toast.success('Caso clínico creado');
    } catch (err) {
      toast.error(err.message || 'Error al crear el caso clínico');
    } finally {
      setIsCreatingCase(false);
    }
  };

  // Handler para ver una consulta antigua (solo lectura)
  const handleViewConsultation = (consultation) => {
    console.log('=== DEBUG HANDLE VIEW CONSULTATION ===');
    console.log('consultation recibida:', consultation);
    console.log('consultation.formData:', consultation.formData);
    console.log('formTemplates:', formTemplates);
    
    // Extraer reason y tags desde formData si están ahí
    const reason = consultation.reason || consultation.formData?.reason || '';
    const tags = consultation.tags || consultation.formData?.tags || [];
    
    // Mapear specialtyFields según los campos presentes en formData
    let specialtyFields = [];
    if (consultation.formData && formTemplates.length > 0) {
      formTemplates.forEach(template => {
        template.fields.forEach(field => {
          if (consultation.formData.hasOwnProperty(field.id)) {
            specialtyFields.push(field);
          }
        });
      });
    }
    
    console.log('specialtyFields mapeados:', specialtyFields);
    
    // Crear el objeto mapeado correctamente
    const mappedConsultation = {
      ...consultation,
      reason: reason,
      tags: tags,
      specialtyFields: specialtyFields,
      files: consultation.files || [], // Mantener los archivos originales
      formData: consultation.formData || {},
    };
    
    console.log('mappedConsultation final:', mappedConsultation);
    console.log('=== FIN DEBUG ===');
    
    setConsultationToView(mappedConsultation);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section - sticky en desktop, compacto en móvil para no tapar pantalla */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold text-gray-800">Historial Clínico</h1>
            {/* Solo mostrar botones para doctores */}
            {user && user.role === 'DOCTOR' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setIsNewPatientModalOpen(true)}
                  className="inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <UserIcon className="-ml-1 mr-2 h-5 w-5" />
                  Registrar Nuevo Paciente
                </button>
                <button
                  onClick={() => setIsDoctorTemplateModalOpen(true)}
                  className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <DocumentTextIcon className="-ml-1 mr-2 h-5 w-5" />
                  Formularios personalizados
                </button>
              </div>
            )}
          </div>
          
          {/* Buscador - Solo para doctores */}
          {user && user.role === 'DOCTOR' && (
            <div className="w-full mb-4">
              <SearchBar onSelectPatient={handleSelectPatient} newlyCreatedPatient={newlyCreatedPatient} />
            </div>
          )}
          
          {/* Patient Header */}
          {patient && (
            <PatientHeader patient={patient} onOpenAdditional={() => {
              console.log('Click en Datos adicionales');
              setIsAdditionalModalOpen(true);
            }} />
          )}
        </div>
      </div>

      {/* Scrollable Content Section - min-w-0 para permitir scroll correcto en móvil */}
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-8 min-w-0">
        {(showLoader || autoRefreshMessage) && isCreatingCase && (
          <Loader text={autoRefreshMessage || 'Creando caso clínico...'} />
        )}
        
        {/* Tarjetas de casos clínicos - scroll lateral en móvil, layout vertical en móvil cuando hay pocos */}
        <div className="mt-4 min-w-0">
          <div className="w-full overflow-x-auto overflow-y-visible pb-2 sm:overflow-visible" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="text-xs text-gray-500 mb-2 sm:hidden">← Desliza para ver casos clínicos →</div>
            <div className="flex gap-4 items-stretch mb-4 min-w-max sm:min-w-0 flex-nowrap sm:flex-wrap">
            {loadingCases ? (
              <span className="flex-shrink-0 px-1">Cargando casos clínicos...</span>
            ) : clinicalCases.length === 0 ? (
              <span className="flex-shrink-0 px-1">No hay casos clínicos registrados para este paciente.</span>
            ) : (
              clinicalCases.map(caso => (
                <div
                  key={caso.id}
                  className={`p-4 rounded-lg border shadow cursor-pointer min-w-[220px] ${selectedCase && selectedCase.id === caso.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}
                  onClick={() => {
                    setSelectedCase(caso);
                    if (user?.role === 'PATIENT') {
                      setTimeout(() => refreshMedicalRecords(), 100);
                    }
                  }}
                >
                  <div className="font-bold text-lg text-blue-800 mb-1 flex items-center justify-between">
                    <span>{caso.padecimiento}</span>
                    {/* Solo mostrar botón colaborativo para doctores */}
                    {user && user.role === 'DOCTOR' && (
                      <Tooltip placement="bottom" text="Comparte este expediente clínico en particular e historial de consultas con otro profesional de la salud. Cada uno podrá elaborar sus propias consultas y podrán colaborar en el expediente compartiendo la información.">
                        <button
                          className="ml-2 px-2 py-1 flex items-center gap-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold"
                          onClick={e => { 
                            console.log('=== COLABORATIVO BUTTON CLICKED ===');
                            e.stopPropagation(); 
                            handleOpenCollab(caso); 
                          }}
                        >
                          <UserPlusIcon className="w-4 h-4" /> Colaborativo
                        </button>
                      </Tooltip>
                    )}
                  </div>
                  {/* Solo mostrar botones de edición para doctores */}
                  {user && user.role === 'DOCTOR' && (
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        className="p-1 text-gray-500 hover:text-gray-700"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const nuevo = window.prompt('Nuevo nombre del caso clínico', caso.padecimiento);
                          if (!nuevo || !nuevo.trim()) return;
                          const name = nuevo.trim();
                          if (name.length > 20) {
                            toast.error('El nombre debe tener máximo 20 caracteres');
                            return;
                          }
                          try {
                            const updated = await updateCase(caso.id, { padecimiento: name });
                            if (selectedCase && selectedCase.id === caso.id) {
                              setSelectedCase(updated);
                            }
                          } catch {}
                        }}
                        title="Renombrar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1 text-red-600 hover:text-red-700"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = window.confirm('¿Eliminar este caso clínico? Solo se permitirá si no tiene consultas asociadas.');
                          if (!ok) return;
                          try {
                            await deleteCase(caso.id);
                          } catch (err) {
                            // El backend devolverá un mensaje claro si tiene consultas
                          }
                        }}
                        title="Eliminar"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">Creado: {formatDate(caso.createdAt)}</div>
                </div>
              ))
            )}
            {/* Solo mostrar botón de nuevo caso clínico para doctores */}
            {user && user.role === 'DOCTOR' && (
              <button
                className="p-4 rounded-lg border-2 border-dashed border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100 min-w-[220px] flex flex-col items-center justify-center"
                onClick={() => setIsNewCaseModalOpen(true)}
              >
                <PlusIcon className="w-8 h-8 mb-1" />
                <span className="font-semibold">Nuevo caso clínico</span>
              </button>
            )}
            </div>
          </div>
        </div>
        
                 {/* Contenido Dinámico */}
         <div className="mt-6">
           {loadingRecords ? (
             <p className="text-center text-gray-500">Cargando paciente...</p>
           ) : error ? (
             <p className="text-center text-red-500">{error}</p>
           ) : patient && selectedCase ? (
            <div className="space-y-6">
              {/* Cenefa de evolución clínica del paciente - compacta en móvil */}
              <div className="mb-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-white rounded-t-xl px-4 sm:px-6 py-3 border border-b-0 border-gray-200 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0">
                    <span className="text-base sm:text-xl font-bold text-gray-800">Evolución clínica del paciente</span>
                    {selectedCase && (
                      <span className="text-blue-700 font-semibold text-sm sm:text-lg">{selectedCase.padecimiento}</span>
                    )}
                    <Tooltip text="Este progreso se llena en automático con lo capturado en el historial clínico de cada consulta, es importante que el profesional capture dicha evolución en cada consulta">
                      <InformationCircleIcon className="h-5 w-5 text-gray-400 ml-1 sm:ml-2 flex-shrink-0" />
                    </Tooltip>
                  </div>
                  <Tooltip text="A través de este visor de fotografías capturadas en la consulta médica podrás observar a manera de timeline y como galería el progreso de curación de tu paciente">
                    <button
                      className="inline-flex items-center px-3 py-2 sm:px-4 border border-gray-300 rounded-md bg-white text-blue-700 hover:bg-blue-100 text-xs sm:text-sm shadow flex-shrink-0"
                      onClick={() => setIsPhotoHistoryOpen(true)}
                    >
                      <PhotoIcon className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 text-blue-500" />
                      Evolución visual
                    </button>
                  </Tooltip>
                </div>
                <div className="bg-white rounded-b-xl px-6 pb-6 pt-4 border border-t-0 border-gray-200 shadow-sm">
                  <ClinicalEvolutionTracker medicalRecords={medicalRecords} />
                </div>
              </div>

              {/* (Removido) Estadísticas de consultas divididas */}

              {/* Alerta de consultas pendientes */}
              {pendingConsultations && pendingConsultations.length > 0 && (
                <PendingConsultationsAlert 
                  pendingCount={pendingConsultations.length}
                  onClick={() => setShowDividedConsultationManager(true)}
                  disabled={Boolean(consultationToView) ? consultationToView.isEditable === false : false}
                />
              )}
              {/* Historial de consultas/notas del caso seleccionado */}
              {consultationToView && patient && selectedCase && (
                <ConsultationDetailView
                  consultation={consultationToView}
                  onBack={() => setConsultationToView(null)}
                  fieldLabels={fieldLabels}
                  formTemplates={formTemplates}
                  patient={patient}
                  selectedCase={selectedCase}
                  refreshMedicalRecords={refreshMedicalRecords}
                  refreshDividedConsultations={refreshDividedConsultations}
                  onConsultationUpdated={(updated) => {
                    setConsultationToView(prev => prev?.id === updated?.id ? { ...prev, ...updated } : prev);
                  }}
                  onAddAttachments={(files, links) => {
                    console.log('Agregando archivos a la consulta:', files, links);
                  }}
                />
              )}
              {!consultationToView && (
                <MedicalRecordsConsultationList
                  consultations={medicalRecords}
                  onNewConsultation={() => setShowDividedConsultationManager(true)}
                  onSelectConsultation={handleViewConsultation}
                />
              )}
            </div>
          ) : (
            <div className="text-center py-10 border-2 border-dashed border-gray-300 rounded-lg">
              {user?.role === 'PATIENT' ? (
                <>
                  <h2 className="text-xl font-semibold text-gray-700">Cargando tu historial clínico...</h2>
                  <p className="mt-1 text-gray-500">Por favor espera mientras se cargan tus datos médicos.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-gray-700">Seleccione un caso clínico para ver su evolución y consultas.</h2>
                  <p className="mt-1 text-gray-500">Usa la barra de búsqueda para encontrar el historial de un paciente.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Modal de datos adicionales SIEMPRE disponible si hay paciente */}
      {isAdditionalModalOpen && patient && (
        <>
          {console.log('Valor de patient en render modal:', patient)}
          {patient && (
            <>
              {console.log('Renderizando AdditionalDataModal')}
              <AdditionalDataModal
                isOpen={isAdditionalModalOpen}
                onClose={() => {
                  console.log('Cerrando modal de datos adicionales');
                  setIsAdditionalModalOpen(false);
                }}
                patient={patient}
                lastDiagnosis={lastDiagnosis}
                onSave={handleSaveAdditionalData}
              />
            </>
          )}
        </>
      )}
      {/* Modal visor fotográfico */}
      <PhotoHistoryViewer 
        photoHistory={filteredPhotoHistory}
        isOpen={isPhotoHistoryOpen}
        onClose={() => setIsPhotoHistoryOpen(false)}
      />
      {/* Sistema de consultas divididas */}
      {showDividedConsultationManager && patient && selectedCase && (
        <DividedConsultationManager
          isOpen={showDividedConsultationManager}
          onClose={() => {
            setShowDividedConsultationManager(false);
            // Refrescar automáticamente los casos, registros médicos y evolución visual
            refreshCases();
            refreshMedicalRecords();
            refreshDividedConsultations();
            setPhotoHistoryRefreshKey(k => k + 1);
          }}
          patientName={`${patient.firstName} ${patient.lastName}`}
          padecimiento={selectedCase.padecimiento}
          patientId={patient.id}
          clinicalCaseId={selectedCase.id}
          onConsultationCreated={handleConsultationCreated}
          onConsultationUpdated={handleConsultationUpdated}
        />
      )}
      {isNewPatientModalOpen && (
        <NewPatientModal
          isOpen={isNewPatientModalOpen}
          onClose={() => setIsNewPatientModalOpen(false)}
          onSubmit={handleCreatePatient}
        />
      )}
      {/* Modal para nuevo caso clínico */}
      <NewClinicalCaseModal
        isOpen={isNewCaseModalOpen}
        onClose={() => setIsNewCaseModalOpen(false)}
        onSubmit={handleCreateClinicalCase}
        loading={isSubmittingCase}
      />
      <DoctorSearchModal
        key={selectedCaseForCollab?.id || 'closed'}
        isOpen={collabModalOpen}
        onClose={handleCloseCollab}
        onSelect={handleSelectDoctor}
        loading={collabLoading}
        error={collabError}
        clinicalCaseId={selectedCaseForCollab?.id}
      />
      <DoctorFormTemplateManager
        isOpen={isDoctorTemplateModalOpen}
        onClose={() => setIsDoctorTemplateModalOpen(false)}
      />
    </div>
  );
};

export default MedicalRecords; 