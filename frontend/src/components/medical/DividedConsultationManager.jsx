import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, CheckCircleIcon, ClockIcon, DocumentIcon, PlusIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import BasicConsultationForm from './BasicConsultationForm';
import ConsultationAttachmentsForm from './ConsultationAttachmentsForm';
import { uploadFile } from '../../services/doctorService';
import { saveDoctorFormData } from '../../services/doctorFormTemplateService';
import { getApiUrl } from '../../utils/api';

// --- Componente Principal ---
const DividedConsultationManager = ({ 
  isOpen, 
  onClose, 
  patientName, 
  padecimiento, 
  patientId,
  clinicalCaseId,
  onConsultationCreated,
  onConsultationUpdated
}) => {
  const [currentStep, setCurrentStep] = useState(1); // 1: Básica, 2: Archivos
  const [consultationId, setConsultationId] = useState(null);
  const [basicConsultationData, setBasicConsultationData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados para mostrar diferentes modales
  const [showBasicForm, setShowBasicForm] = useState(false);
  const [showAttachmentsForm, setShowAttachmentsForm] = useState(false);
  const [showPendingConsultations, setShowPendingConsultations] = useState(false);

  // Estados para consultas pendientes
  const [pendingConsultations, setPendingConsultations] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Cargar consultas pendientes al abrir
  useEffect(() => {
    if (isOpen && patientId) {
      loadPendingConsultations();
    }
  }, [isOpen, patientId]);

  const loadPendingConsultations = async () => {
    try {
      setLoadingPending(true);
      const response = await fetch(getApiUrl(`/api/consultations/pending/${patientId}?clinicalCaseId=${clinicalCaseId}`), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingConsultations(data.data || []);
      } else {
        console.error('Error al cargar consultas pendientes');
      }
    } catch (error) {
      console.error('Error al cargar consultas pendientes:', error);
    } finally {
      setLoadingPending(false);
    }
  };

  const handleCreateBasicConsultation = async (data) => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch(getApiUrl('/api/consultations/basic'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          patientId,
          clinicalCaseId
        })
      });

      if (response.ok) {
        const result = await response.json();
        const consultationId = result.data.id;
        setConsultationId(consultationId);
        setBasicConsultationData(result.data);

        const doctorCustomFormData = data.doctorCustomFormData || [];
        if (doctorCustomFormData.length > 0 && patientId) {
          try {
            await Promise.all(
              doctorCustomFormData.map(({ templateId, data: formData }) =>
                saveDoctorFormData(consultationId, templateId, patientId, formData)
              )
            );
          } catch (err) {
            console.error('Error al guardar formularios personalizados:', err);
            toast.warning('Consulta creada, pero hubo un error al guardar algunos datos personalizados.');
          }
        }

        toast.success('Consulta básica creada exitosamente');
        
        // Pasar al siguiente paso
        setCurrentStep(2);
        setShowBasicForm(false);
        setShowAttachmentsForm(true);
        
        if (onConsultationCreated) {
          onConsultationCreated(result.data);
        }
      } else {
        let errorMessage = 'Error al crear la consulta básica';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } else {
            const text = await response.text();
            if (text) errorMessage = text.substring(0, 200);
          }
        } catch (_) {
          errorMessage = response.status === 403
            ? 'Sin permiso. Verifica tu suscripción o acceso al paciente.'
            : `Error del servidor (${response.status}). Intenta de nuevo.`;
        }
        console.error('[Consulta] Error al guardar:', response.status, errorMessage);
        toast.error(errorMessage, { autoClose: 8000 });
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error al crear consulta básica:', error);
      toast.error(error.message || 'Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAttachments = async (data) => {
    try {
      setIsSubmitting(true);
      
      const { files: filesRaw, links } = data || {};
      const filesByCategory = {};
      
      // Subir archivos nuevos (File objects) antes de enviar al API
      if (filesRaw && typeof filesRaw === 'object') {
        for (const [category, list] of Object.entries(filesRaw)) {
          if (Array.isArray(list) && list.length > 0) {
            const uploadedFilesForCategory = [];
            for (const file of list) {
              try {
                if (file.id || file.url) {
                  uploadedFilesForCategory.push({
                    id: file.id,
                    fileName: file.fileName || file.name,
                    fileType: file.fileType || file.type,
                    size: file.size,
                    url: file.url,
                    category: file.category || category
                  });
                } else if (file instanceof File) {
                  const up = await uploadFile(file, category);
                  if (up) {
                    uploadedFilesForCategory.push({
                      id: up.id,
                      fileName: up.fileName || file.name,
                      fileType: up.fileType || file.type,
                      size: up.size || file.size,
                      url: up.url,
                      category: up.category || category
                    });
                  }
                }
              } catch (e) {
                console.error('Error subiendo archivo', file?.name, e);
                toast.error(`Error al subir ${file?.name || 'archivo'}`);
              }
            }
            if (uploadedFilesForCategory.length > 0) {
              filesByCategory[category] = uploadedFilesForCategory;
            }
          }
        }
      }
      
      const attachmentPayload = {
        files: filesByCategory,
        links: Array.isArray(links) ? links.filter(l => l.url && (l.description || l.url.trim())) : []
      };
      
      const response = await fetch(getApiUrl(`/api/consultations/${consultationId}/attachments`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(attachmentPayload)
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Archivos agregados exitosamente');
        
        // Marcar como completa
        await markConsultationComplete();
        
        setShowAttachmentsForm(false);
        onClose();
        
        if (onConsultationUpdated) {
          onConsultationUpdated(result.data);
        }
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error al agregar archivos');
      }
    } catch (error) {
      console.error('Error al agregar archivos:', error);
      toast.error(error.message || 'Error al agregar archivos');
    } finally {
      setIsSubmitting(false);
    }
  };

  const markConsultationComplete = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/consultations/${consultationId}/complete`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Consulta marcada como completa');
      } else {
        console.error('Error al marcar consulta como completa');
      }
    } catch (error) {
      console.error('Error al marcar consulta como completa:', error);
    }
  };

  const handleAddAttachmentsToExisting = (consultation) => {
    setConsultationId(consultation.id);
    setBasicConsultationData(consultation);
    setCurrentStep(2);
    setShowPendingConsultations(false);
    setShowAttachmentsForm(true);
  };

  const handleClose = () => {
    setCurrentStep(1);
    setConsultationId(null);
    setBasicConsultationData(null);
    setShowBasicForm(false);
    setShowAttachmentsForm(false);
    setShowPendingConsultations(false);
    onClose();
  };

  const getStepIcon = (step) => {
    if (step === 1) {
      return currentStep >= 1 ? <CheckCircleIcon className="w-5 h-5 text-green-500" /> : <ClockIcon className="w-5 h-5 text-gray-400" />;
    } else {
      return currentStep >= 2 ? <CheckCircleIcon className="w-5 h-5 text-green-500" /> : <DocumentIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  // Normalizar initialData para ConsultationAttachmentsForm: acepta files[] (Prisma) o formData.files (pre-consulta)
  const normalizeInitialDataForAttachments = (data) => {
    if (!data) return { files: {}, links: [] };
    const filesByCategory = {};
    let links = [];
    
    if (data.formData?.files && typeof data.formData.files === 'object') {
      Object.assign(filesByCategory, data.formData.files);
    }
    if (data.formData?.links && Array.isArray(data.formData.links)) {
      links = data.formData.links;
    }
    if (data.files && Array.isArray(data.files)) {
      data.files.forEach((f) => {
        const cat = f.category || 'STUDY_RESULT';
        if (!filesByCategory[cat]) filesByCategory[cat] = [];
        filesByCategory[cat].push({
          id: f.id,
          fileName: f.fileName,
          url: f.url,
          type: f.fileType,
          size: f.size
        });
      });
    }
    if (data.links && Array.isArray(data.links)) {
      links = data.links.map((l) => ({ id: l.id, url: l.url, description: l.description || l.url }));
    }
    return { files: filesByCategory, links };
  };

  return (
    <>
      {/* Modal principal de selección */}
      <Dialog open={isOpen && !showBasicForm && !showAttachmentsForm && !showPendingConsultations} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
          <Dialog.Panel className="relative w-full max-w-2xl rounded-xl bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  Nueva Consulta para: <span className="text-blue-600">{patientName}</span>
                  {padecimiento && <span className="text-gray-700">— <span className="font-semibold">{padecimiento}</span></span>}
                </Dialog.Title>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Opciones */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">¿Qué desea hacer?</h3>
                
                {/* Crear nueva consulta */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-blue-900">Crear nueva consulta</h4>
                      <p className="text-sm text-blue-700 mt-1">Crear una consulta desde cero</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={`/dashboard/nueva-consulta?patientId=${patientId}${clinicalCaseId ? `&clinicalCaseId=${clinicalCaseId}` : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
                        title="Abrir en página completa (recomendado para formularios largos)"
                      >
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        Página completa
                      </a>
                      <button
                        onClick={() => setShowBasicForm(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title="Crear en ventana actual"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Agregar archivos a consulta existente */}
                {pendingConsultations.length > 0 && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-yellow-900">Consultas pendientes</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          {pendingConsultations.length} consulta(s) sin archivos adjuntos
                        </p>
                      </div>
                      <button
                        onClick={() => setShowPendingConsultations(true)}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      >
                        Ver pendientes
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Progreso del sistema */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-3">Sistema de Consultas Divididas</h4>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getStepIcon(1)}
                    <span className="text-sm font-medium">Parte 1: Datos básicos</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <div className="flex items-center space-x-2">
                    {getStepIcon(2)}
                    <span className="text-sm font-medium">Parte 2: Archivos</span>
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Modal de consultas pendientes */}
      {showPendingConsultations && (
        <Dialog open={true} onClose={() => setShowPendingConsultations(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
            <Dialog.Panel className="relative w-full max-w-2xl rounded-xl bg-white">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-medium text-gray-900">
                    Consultas Pendientes
                  </Dialog.Title>
                  <button
                    onClick={() => setShowPendingConsultations(false)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {loadingPending ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Cargando consultas pendientes...</p>
                  </div>
                ) : pendingConsultations.length > 0 ? (
                  <div className="space-y-3">
                    {pendingConsultations.map((consultation) => (
                      <div key={consultation.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-gray-900">{consultation.diagnosis}</h4>
                            <p className="text-sm text-gray-600">
                              {new Date(consultation.date || consultation.createdAt).toLocaleDateString('es-ES')}
                            </p>
                            <p className="text-xs text-gray-500">
                              Evolución: {consultation.clinicalEvolution}
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddAttachmentsToExisting(consultation)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                          >
                            Agregar archivos
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No hay consultas pendientes</p>
                  </div>
                )}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      )}

      {/* Formulario básico */}
      {showBasicForm && (
        <BasicConsultationForm
          isOpen={true}
          onClose={() => setShowBasicForm(false)}
          onSubmit={handleCreateBasicConsultation}
          patientName={patientName}
          padecimiento={padecimiento}
        />
      )}

      {/* Formulario de archivos */}
      {showAttachmentsForm && consultationId && (
        <ConsultationAttachmentsForm
          isOpen={true}
          onClose={() => setShowAttachmentsForm(false)}
          onSubmit={handleAddAttachments}
          consultationId={consultationId}
          patientName={patientName}
          padecimiento={padecimiento}
          patientId={patientId}
          initialData={normalizeInitialDataForAttachments(basicConsultationData)}
        />
      )}
    </>
  );
};

export default DividedConsultationManager; 