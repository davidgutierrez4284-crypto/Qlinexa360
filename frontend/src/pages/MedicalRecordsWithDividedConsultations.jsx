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
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { searchPatients, getPatientDetails, createPatient, getFormTemplates, updatePatient } from '../services/doctorService';
import { debounce } from 'lodash';
import NewPatientModal from '../components/medical/NewPatientModal';
import ClinicalEvolutionTracker from '../components/medical/ClinicalEvolutionTracker';
import Modal from 'react-modal';
import PhotoHistoryViewer from '../components/medical/PhotoHistoryViewer';
import Tooltip from '../components/common/Tooltip';
import useMedicalRecords from '../hooks/useMedicalRecords';
import useClinicalCases from '../hooks/useClinicalCases';
import NewClinicalCaseModal from '../components/medical/NewClinicalCaseModal';
import Loader from '../components/common/Loader';
import { useAuth } from '../context/AuthContext';
import { calculateAge } from '../utils/ageUtils';

// Importar componentes del sistema de consultas divididas
import DividedConsultationManager from '../components/medical/DividedConsultationManager';
import { ConsultationStatusIndicator, ConsultationList, ConsultationStats, PendingConsultationsAlert } from '../components/medical/ConsultationStatusIndicator';
import useDividedConsultations from '../hooks/useDividedConsultations';

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
        console.error('Error searching patients:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

  const handleSelect = (patient) => {
    onSelectPatient(patient);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar paciente por nombre, email o teléfono..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      )}

      {results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((patient) => (
            <div
              key={patient.id}
              onClick={() => handleSelect(patient)}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <img
                    src={patient.profilePictureUrl || `https://ui-avatars.com/api/?name=${patient.firstName}+${patient.lastName}&background=random`}
                    alt={`${patient.firstName} ${patient.lastName}`}
                    className="h-10 w-10 rounded-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{patient.email}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PatientHeader = ({ patient, onOpenAdditional }) => {
  const [signedUrl, setSignedUrl] = useState(null);

  useEffect(() => {
    async function fetchSignedUrl() {
      if (patient.profilePictureUrl && patient.profilePictureUrl.startsWith('s3://')) {
        try {
          const response = await fetch(`/api/files/signed-url?key=${encodeURIComponent(patient.profilePictureUrl)}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSignedUrl(data.signedUrl);
          }
        } catch (error) {
          console.error('Error fetching signed URL:', error);
        }
      }
    }
    fetchSignedUrl();
  }, [patient.profilePictureUrl]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <img
            src={signedUrl || patient.profilePictureUrl || `https://ui-avatars.com/api/?name=${patient.firstName}+${patient.lastName}&background=random`}
            alt={`${patient.firstName} ${patient.lastName}`}
            className="h-16 w-16 rounded-full"
          />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            {patient.firstName} {patient.lastName}
          </h2>
          <p className="text-gray-600">{(() => {
            const raw = patient.email || patient.user?.email || '';
            return (raw && !String(raw).startsWith('patient-no-email@')) ? raw : 'Sin correo (agregar en Datos adicionales)';
          })()}</p>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
            <span>Edad: {calculateAge(patient.dateOfBirth || patient.dob) || 'Sin especificar'}</span>
            {patient.bloodType && <span>Grupo: {patient.bloodType}</span>}
            {patient.allergies && <span>Alergias: {patient.allergies}</span>}
          </div>
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={onOpenAdditional}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Datos Adicionales
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Componente Principal ---
const MedicalRecordsWithDividedConsultations = () => {
  const { patientId: pathPatientId } = useParams();
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId');
  const queryClinicalCaseId = searchParams.get('clinicalCaseId');
  
  const patientId = pathPatientId || queryPatientId;
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Estados principales
  const [patient, setPatient] = useState(null);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  const [isAdditionalModalOpen, setIsAdditionalModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [newlyCreatedPatient, setNewlyCreatedPatient] = useState(null);

  // Estados para casos clínicos
  const {
    cases: clinicalCases,
    loading: loadingCases,
    error: errorCases,
    selectedCase,
    setSelectedCase,
    createCase,
    refreshCases
  } = useClinicalCases(patientId);

  const [isNewCaseModalOpen, setIsNewCaseModalOpen] = useState(false);
  const [isCreatingCase, setIsCreatingCase] = useState(false);

  // Estados para consultas divididas
  const {
    consultations,
    pendingConsultations,
    stats,
    loading: loadingConsultations,
    error: errorConsultations,
    showDividedManager,
    openDividedManager,
    closeDividedManager,
    createBasicConsultation,
    addAttachmentsToConsultation,
    markConsultationComplete,
    refresh: refreshConsultations
  } = useDividedConsultations(patientId, selectedCase?.id);

  // Estados para registros médicos (sistema existente)
  const {
    medicalRecords,
    loading: loadingMedicalRecords,
    error: errorMedicalRecords,
    refreshMedicalRecords
  } = useMedicalRecords(patientId);

  // Estados para templates
  const [formTemplates, setFormTemplates] = useState([]);

  // Cargar templates al montar
  useEffect(() => {
    const loadFormTemplates = async () => {
      try {
        const templates = await getFormTemplates();
        setFormTemplates(templates);
      } catch (error) {
        console.error('Error loading form templates:', error);
      }
    };
    loadFormTemplates();
  }, []);

  // Cargar datos del paciente
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) return;
      
      try {
        const patientData = await getPatientDetails(patientId);
        setPatient(patientData);
      } catch (error) {
        console.error('Error fetching patient data:', error);
        setError('Error al cargar los datos del paciente');
      }
    };

    fetchPatientData();
  }, [patientId]);

  // Cargar registros médicos cuando cambie el caso clínico
  useEffect(() => {
    if (patientId && selectedCase) {
      refreshMedicalRecords({ clinicalCaseId: selectedCase.id });
    }
  }, [patientId, selectedCase, refreshMedicalRecords]);

  const handleSelectPatient = (selectedPatient) => {
    setPatient(selectedPatient);
    navigate(`/medical-records/${selectedPatient.id}`);
  };

  const handleCreatePatient = async (patientData) => {
    try {
      const newPatient = await createPatient(patientData);
      setNewlyCreatedPatient(newPatient);
      setPatient(newPatient);
      setIsNewPatientModalOpen(false);
      toast.success('Paciente creado exitosamente');
      navigate(`/medical-records/${newPatient.id}`);
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error('Error al crear el paciente');
    }
  };

  const handleCreateClinicalCase = async (caseData) => {
    try {
      setIsCreatingCase(true);
      await createCase(caseData);
      setIsNewCaseModalOpen(false);
      toast.success('Caso clínico creado exitosamente');
    } catch (error) {
      console.error('Error creating clinical case:', error);
      toast.error('Error al crear el caso clínico');
    } finally {
      setIsCreatingCase(false);
    }
  };

  const handleConsultationCreated = (consultation) => {
    toast.success('Consulta creada exitosamente');
    refreshConsultations();
  };

  const handleConsultationUpdated = (consultation) => {
    toast.success('Consulta actualizada exitosamente');
    refreshConsultations();
  };

  if (loadingConsultations || loadingMedicalRecords) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header con búsqueda */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <ArrowLeftIcon className="h-6 w-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Registros Médicos</h1>
            </div>
            <button
              onClick={() => setIsNewPatientModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <UserPlusIcon className="h-5 w-5" />
              <span>Nuevo Paciente</span>
            </button>
          </div>
          
          <SearchBar onSelectPatient={handleSelectPatient} newlyCreatedPatient={newlyCreatedPatient} />
        </div>

        {patient ? (
          <div className="space-y-6">
            {/* Header del paciente */}
            <PatientHeader 
              patient={patient} 
              onOpenAdditional={() => setIsAdditionalModalOpen(true)} 
            />

            {/* Estadísticas de consultas divididas */}
            <ConsultationStats stats={stats} />

            {/* Alerta de consultas pendientes */}
            <PendingConsultationsAlert 
              pendingCount={pendingConsultations.length}
              onClick={openDividedManager}
            />

            {/* Casos clínicos */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Casos Clínicos</h2>
                <button
                  onClick={() => setIsNewCaseModalOpen(true)}
                  className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Nuevo Caso</span>
                </button>
              </div>

              {loadingCases ? (
                <Loader />
              ) : clinicalCases.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clinicalCases.map((case_) => (
                    <div
                      key={case_.id}
                      onClick={() => setSelectedCase(case_)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedCase?.id === case_.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h3 className="font-medium text-gray-900">{case_.padecimiento}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {case_.medicalRecords?.length || 0} consultas
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">
                  No hay casos clínicos registrados
                </p>
              )}
            </div>

            {/* Consultas del caso seleccionado */}
            {selectedCase && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Consultas - {selectedCase.padecimiento}
                  </h2>
                  <button
                    onClick={openDividedManager}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <DocumentPlusIcon className="h-5 w-5" />
                    <span>Nueva Consulta</span>
                  </button>
                </div>

                {/* Lista de consultas con indicadores de estado */}
                <ConsultationList 
                  consultations={consultations}
                  onConsultationClick={(consultation) => {
                    // Aquí podrías abrir un modal para ver los detalles
                    console.log('Consultation clicked:', consultation);
                  }}
                />
              </div>
            )}

            {/* Evolución clínica */}
            {selectedCase && medicalRecords.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Evolución Clínica</h2>
                <ClinicalEvolutionTracker medicalRecords={medicalRecords} />
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay paciente seleccionado</h3>
            <p className="mt-1 text-sm text-gray-500">
              Busca un paciente para ver sus registros médicos
            </p>
          </div>
        )}

        {/* Modales */}
        <NewPatientModal
          isOpen={isNewPatientModalOpen}
          onClose={() => setIsNewPatientModalOpen(false)}
          onSubmit={handleCreatePatient}
        />

        <NewClinicalCaseModal
          isOpen={isNewCaseModalOpen}
          onClose={() => setIsNewCaseModalOpen(false)}
          onSubmit={handleCreateClinicalCase}
          patientId={patientId}
          isSubmitting={isCreatingCase}
        />

        {/* Modal de gestión de consultas divididas */}
        <DividedConsultationManager
          isOpen={showDividedManager}
          onClose={closeDividedManager}
          patientName={patient ? `${patient.firstName} ${patient.lastName}` : ''}
          padecimiento={selectedCase?.padecimiento}
          patientId={patientId}
          clinicalCaseId={selectedCase?.id}
          onConsultationCreated={handleConsultationCreated}
          onConsultationUpdated={handleConsultationUpdated}
        />
      </div>
    </div>
  );
};

export default MedicalRecordsWithDividedConsultations; 