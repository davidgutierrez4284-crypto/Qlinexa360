import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import {
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline';
import SmartForm from '../components/medical/SmartForm';
import FileUpload from '../components/medical/FileUpload';
import LinkManager from '../components/medical/LinkManager';

const PreConsultation = () => {
  const { token, segment } = useParams();
  const effectiveToken = token || segment;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [preConsultation, setPreConsultation] = useState(null);

  // Función para obtener la fecha actual en formato YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Estados del formulario - igual que NewConsultationModal
  const [date, setDate] = useState(getCurrentDate());
  const [reason, setReason] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(true); // Por defecto público para que el doctor lo vea
  const [clinicalEvolution, setClinicalEvolution] = useState('INITIAL_EVALUATION');
  const [prescriptionFiles, setPrescriptionFiles] = useState([]);
  const [doctorPhotos, setDoctorPhotos] = useState([]);
  const [studyResults, setStudyResults] = useState([]);
  const [patientPhotos, setPatientPhotos] = useState([]);
  const [links, setLinks] = useState([]);
  const [formData, setFormData] = useState({});
  const specialtyFormDataRef = useRef({});

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

  // Cargar información de la pre-consulta
  useEffect(() => {
    const loadPreConsultation = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/pre-consultations/token/${effectiveToken}`);
        
        if (response.data.success) {
          setPreConsultation(response.data.preConsultation);
          
          // Cargar datos guardados previamente si existen
          if (response.data.preConsultation.formData) {
            const savedData = response.data.preConsultation.formData;
            
            // Cargar campos básicos
            if (savedData.date) {
              const savedDate = new Date(savedData.date);
              const year = savedDate.getFullYear();
              const month = String(savedDate.getMonth() + 1).padStart(2, '0');
              const day = String(savedDate.getDate()).padStart(2, '0');
              setDate(`${year}-${month}-${day}`);
            }
            if (savedData.reason) setReason(savedData.reason);
            if (savedData.tags) setTags(Array.isArray(savedData.tags) ? savedData.tags.join(', ') : savedData.tags);
            if (savedData.notes) setNotes(savedData.notes);
            if (savedData.isPublic !== undefined) setIsPublic(savedData.isPublic);
            if (savedData.clinicalEvolution) setClinicalEvolution(savedData.clinicalEvolution);
            
            // Cargar archivos
            if (savedData.files) {
              if (savedData.files.PRESCRIPTION_REQUEST) setPrescriptionFiles(savedData.files.PRESCRIPTION_REQUEST);
              if (savedData.files.DOCTOR_PHOTO) setDoctorPhotos(savedData.files.DOCTOR_PHOTO);
              if (savedData.files.STUDY_RESULT) setStudyResults(savedData.files.STUDY_RESULT);
              if (savedData.files.PATIENT_PHOTO) setPatientPhotos(savedData.files.PATIENT_PHOTO);
            }
            
            // Cargar links
            if (savedData.links) setLinks(savedData.links);
            
            // Cargar datos de especialidad (formData sin los campos básicos)
            const basicFields = ['date', 'reason', 'tags', 'notes', 'isPublic', 'clinicalEvolution', 'files', 'links'];
            const specialtyData = {};
            Object.keys(savedData).forEach(key => {
              if (!basicFields.includes(key)) {
                specialtyData[key] = savedData[key];
              }
            });
            setFormData(specialtyData);
            specialtyFormDataRef.current = specialtyData;
          }
        } else {
          toast.error(response.data.message || 'Error al cargar la pre-consulta');
        }
      } catch (error) {
        console.error('Error cargando pre-consulta:', error);
        const message = error.response?.data?.message || 'Error al cargar la información de pre-consulta';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    if (effectiveToken) {
      loadPreConsultation();
    }
  }, [effectiveToken]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Subir archivos que aún no tienen URL (File objects)
      const uploadedFiles = {
        PRESCRIPTION_REQUEST: [],
        DOCTOR_PHOTO: [],
        STUDY_RESULT: [],
        PATIENT_PHOTO: []
      };

      // Función para subir archivos de una categoría
      const uploadFiles = async (files, category) => {
        const uploaded = [];
        for (const file of files) {
          // Si el archivo ya tiene una URL, es que ya está subido
          if (file.url) {
            uploaded.push(file);
            continue;
          }
          
          // Si es un File object, subirlo (usa endpoint de pre-consulta que no requiere login)
          if (file instanceof File) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('category', category);
              
              const uploadResponse = await axios.post(`/api/pre-consultations/token/${effectiveToken}/upload`, formData, {
                headers: {
                  'Content-Type': 'multipart/form-data'
                }
              });
              
              if (uploadResponse.data.file) {
                uploaded.push({
                  fileName: uploadResponse.data.file.fileName,
                  url: uploadResponse.data.file.url,
                  type: uploadResponse.data.file.type || uploadResponse.data.file.fileType,
                  size: uploadResponse.data.file.size
                });
              }
            } catch (uploadError) {
              console.error('Error subiendo archivo:', uploadError);
              toast.warning(`Error al subir ${file.name}. El archivo no se guardará en este guardado parcial.`);
            }
          } else {
            // Si no es File ni tiene URL, intentar guardarlo como está (puede ser un objeto con metadata)
            uploaded.push(file);
          }
        }
        return uploaded;
      };

      // Subir archivos de cada categoría
      uploadedFiles.PRESCRIPTION_REQUEST = await uploadFiles(prescriptionFiles, 'PRESCRIPTION_REQUEST');
      uploadedFiles.DOCTOR_PHOTO = await uploadFiles(doctorPhotos, 'DOCTOR_PHOTO');
      uploadedFiles.STUDY_RESULT = await uploadFiles(studyResults, 'STUDY_RESULT');
      uploadedFiles.PATIENT_PHOTO = await uploadFiles(patientPhotos, 'PATIENT_PHOTO');

      // Actualizar los estados con los archivos subidos (para que se reflejen en la UI)
      setPrescriptionFiles(uploadedFiles.PRESCRIPTION_REQUEST);
      setDoctorPhotos(uploadedFiles.DOCTOR_PHOTO);
      setStudyResults(uploadedFiles.STUDY_RESULT);
      setPatientPhotos(uploadedFiles.PATIENT_PHOTO);

      const processedTags = tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
      const validLinks = links.filter(link => link.url && link.url.trim());
      
      const dataToSave = {
        date,
        reason,
        notes,
        isPublic,
        clinicalEvolution,
        tags: processedTags,
        links: validLinks,
        files: uploadedFiles,
        ...specialtyFormDataRef.current
      };
      
      await axios.put(`/api/pre-consultations/token/${effectiveToken}/save`, {
        formData: dataToSave
      });
      
      toast.success('Datos guardados exitosamente. Puedes continuar completando el formulario más tarde.');
    } catch (error) {
      console.error('Error guardando:', error);
      toast.error(error.response?.data?.message || 'Error al guardar los datos');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!reason.trim()) {
      toast.error('Por favor, indica el motivo de la consulta');
      return;
    }
    if (!notes.trim()) {
      toast.error('Por favor, proporciona notas o información relevante');
      return;
    }
    
    setCompleting(true);
    
    try {
      // Subir archivos si hay
      const uploadedFiles = {
        PRESCRIPTION_REQUEST: [],
        DOCTOR_PHOTO: [],
        STUDY_RESULT: [],
        PATIENT_PHOTO: []
      };

      // Subir archivos de cada categoría
      const uploadFiles = async (files, category) => {
        const uploaded = [];
        for (const file of files) {
          // Si el archivo ya tiene una URL, es que ya está subido
          if (file.url) {
            uploaded.push(file);
            continue;
          }
          
          // Si es un File object, subirlo (usa endpoint de pre-consulta que no requiere login)
          if (file instanceof File) {
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('category', category);
              
              const uploadResponse = await axios.post(`/api/pre-consultations/token/${effectiveToken}/upload`, formData, {
                headers: {
                  'Content-Type': 'multipart/form-data'
                }
              });
              
              if (uploadResponse.data.file) {
                uploaded.push({
                  fileName: uploadResponse.data.file.fileName,
                  url: uploadResponse.data.file.url,
                  type: uploadResponse.data.file.type,
                  size: uploadResponse.data.file.size
                });
              }
            } catch (uploadError) {
              console.error('Error subiendo archivo:', uploadError);
              toast.warning(`Error al subir ${file.name}. Continuando...`);
            }
          }
        }
        return uploaded;
      };

      uploadedFiles.PRESCRIPTION_REQUEST = await uploadFiles(prescriptionFiles, 'PRESCRIPTION_REQUEST');
      uploadedFiles.DOCTOR_PHOTO = await uploadFiles(doctorPhotos, 'DOCTOR_PHOTO');
      uploadedFiles.STUDY_RESULT = await uploadFiles(studyResults, 'STUDY_RESULT');
      uploadedFiles.PATIENT_PHOTO = await uploadFiles(patientPhotos, 'PATIENT_PHOTO');

      const processedTags = tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);
      const validLinks = links.filter(link => link.url && link.url.trim());
      
      const dataToComplete = {
        date,
        reason,
        notes,
        isPublic,
        clinicalEvolution,
        tags: processedTags,
        links: validLinks,
        files: uploadedFiles,
        ...specialtyFormDataRef.current
      };
      
      const response = await axios.post(`/api/pre-consultations/token/${effectiveToken}/complete`, {
        formData: dataToComplete
      });
      
      if (response.data.success) {
        toast.success('¡Pre-consulta completada exitosamente! Tu profesional de la salud revisará esta información antes de tu cita.');
        setPreConsultation(prev => ({
          ...prev,
          status: 'COMPLETED',
          completedAt: new Date()
        }));
      }
    } catch (error) {
      console.error('Error completando pre-consulta:', error);
      toast.error(error.response?.data?.message || 'Error al completar la pre-consulta');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando formulario de pre-consulta...</p>
        </div>
      </div>
    );
  }

  if (!preConsultation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Link no válido</h2>
          <p className="text-gray-600">Este link de pre-consulta no es válido o ha expirado.</p>
        </div>
      </div>
    );
  }

  const isCompleted = preConsultation.status === 'COMPLETED';
  const appointmentDate = new Date(preConsultation.appointment.date);
  const formattedDate = appointmentDate.toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Pre-Consulta Inicial</h1>
              <p className="text-gray-600 mt-1">Completa tu información antes de tu cita</p>
              <p className="text-sm font-semibold text-blue-800 mt-2">Qlinexa360</p>
            </div>
            {isCompleted && (
              <div className="flex items-center text-green-600">
                <CheckCircleIcon className="h-6 w-6 mr-2" />
                <span className="font-semibold">Completada</span>
              </div>
            )}
          </div>
          
          {/* Información de la cita */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-start">
              <UserIcon className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Profesional de la salud</p>
                <p className="font-semibold text-gray-900">
                  {preConsultation.appointment.doctor.firstName} {preConsultation.appointment.doctor.lastName}
                </p>
                {preConsultation.appointment.doctor.specialization && (
                  <p className="text-sm text-gray-600">{preConsultation.appointment.doctor.specialization}</p>
                )}
              </div>
            </div>
            <div className="flex items-start">
              <CalendarIcon className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Fecha y hora de la cita</p>
                <p className="font-semibold text-gray-900 capitalize">{formattedDate}</p>
              </div>
            </div>
          </div>
          
          {!isCompleted && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start">
                <ClockIcon className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">Importante:</p>
                  <p>Completa este formulario antes de tu cita para que tu profesional de la salud pueda revisar tu información y optimizar el tiempo de atención.</p>
                  <p className="mt-2">Puedes guardar tu progreso y continuar más tarde si es necesario.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Formulario - Exactamente igual que NewConsultationModal */}
        {!isCompleted ? (
          <form onSubmit={handleComplete} className="space-y-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
              <h3 className="font-semibold text-lg text-gray-800">Detalles de la Consulta</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                    required 
                    className="form-input mt-1 w-full" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de la Consulta *</label>
                  <input 
                    type="text" 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    required 
                    placeholder="Ej: Revisión de resultados" 
                    className="form-input mt-1 w-full" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evolución Clínica del Paciente *
                </label>
                <select 
                  value={clinicalEvolution} 
                  onChange={e => setClinicalEvolution(e.target.value)} 
                  required 
                  className="form-select mt-1 w-full"
                >
                  <option value="">Selecciona la evolución clínica</option>
                  {clinicalEvolutionOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas (opcional)</label>
                <input 
                  type="text" 
                  value={tags} 
                  onChange={e => setTags(e.target.value)} 
                  placeholder="Ej: diabetes, control, seguimiento" 
                  className="form-input mt-1 w-full" 
                />
                <p className="text-xs text-gray-500 mt-1">Separa las etiquetas con comas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Diagnóstico / Tratamiento *</label>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  required 
                  rows={4} 
                  placeholder="Describe el diagnóstico, tratamiento, observaciones..." 
                  className="form-textarea mt-1 w-full"
                />
              </div>
          
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={e => setIsPublic(e.target.checked)}
                  className="form-checkbox"
                />
                <span className="text-sm text-gray-700">Nota pública (visible para el paciente)</span>
              </div>
            </div>

            {/* Formularios Inteligentes */}
            <SmartForm 
              values={formData}
              onChange={(data) => {
                specialtyFormDataRef.current = data;
              }}
              readOnly={false}
            />

            {/* Secciones de Archivos y Links */}
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">a) Recetas y Estudios Solicitados</h4>
                <p className="text-sm text-gray-500 mb-3">Puedes subir recetas o estudios que te hayan solicitado.</p>
                <FileUpload
                  onFilesSelected={files => {
                    // files ya incluye archivos existentes + nuevos (gracias a la lógica mejorada en FileUpload)
                    setPrescriptionFiles(files);
                  }}
                  category="PRESCRIPTION_REQUEST"
                  maxFiles={5}
                  disabled={false}
                  files={prescriptionFiles}
                />
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">b) Fotos (Subidas por el profesional)</h4>
                <p className="text-sm text-gray-500 mb-3">El paciente solo puede consultar.</p>
                <FileUpload
                  onFilesSelected={files => {
                    // files ya incluye archivos existentes + nuevos
                    setDoctorPhotos(files);
                  }}
                  category="DOCTOR_PHOTO"
                  maxFiles={10}
                  disabled={true}
                  files={doctorPhotos}
                />
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">c) Resultados de Estudios</h4>
                <p className="text-sm text-gray-500 mb-3">Puedes subir resultados de estudios médicos aquí.</p>
                <FileUpload
                  onFilesSelected={files => {
                    // files ya incluye archivos existentes + nuevos
                    setStudyResults(files);
                  }}
                  category="STUDY_RESULT"
                  maxFiles={10}
                  disabled={false}
                  files={studyResults}
                />
              </div>

              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <h4 className="font-semibold text-gray-800 mb-3">d) Fotos Subidas por Paciente</h4>
                <p className="text-sm text-gray-500 mb-3">Puedes subir fotos relevantes para tu consulta.</p>
                <FileUpload
                  onFilesSelected={files => {
                    // files ya incluye archivos existentes + nuevos
                    setPatientPhotos(files);
                  }}
                  category="PATIENT_PHOTO"
                  maxFiles={10}
                  disabled={false}
                  files={patientPhotos}
                />
              </div>

              <LinkManager 
                links={links} 
                onChange={setLinks} 
                readOnly={false} 
              />
            </div>

            {/* Botones de acción */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <BookmarkIcon className="h-5 w-5 mr-2" />
                  {saving ? 'Guardando...' : 'Guardar Progreso'}
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {completing ? 'Completando...' : 'Completar y Enviar'}
                  <ArrowRightIcon className="h-5 w-5 ml-2" />
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="text-center py-8">
              <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Pre-consulta completada!</h2>
              <p className="text-gray-600 mb-4">
                Tu información ha sido enviada a tu profesional de la salud.
              </p>
              <p className="text-sm text-gray-500">
                Tu profesional revisará esta información antes de tu cita programada para el {formattedDate}.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreConsultation;
