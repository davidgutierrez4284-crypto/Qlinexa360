import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { useSelectedDoctor } from '../context/SelectedDoctorContext';
import { 
  MagnifyingGlassIcon, 
  DocumentTextIcon,
  PlayIcon,
  PlusIcon,
  EyeIcon,
  TrashIcon,
  PencilIcon,
  InformationCircleIcon,
  ShareIcon,
  LockClosedIcon,
  LinkIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { formatDate } from '../utils/dateUtils';

const Documents = () => {
  const { user } = useAuth();
  const { hasPermission, selectedDoctor } = useSelectedDoctor();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    summary: '',
    type: 'file',
    file: null,
    youtubeUrl: '',
    externalUrl: '',
    isPublic: false,
    notes: ''
  });

  const canUpload =
    user?.role === 'DOCTOR' ||
    (user?.role === 'ASISTENTE' && hasPermission('studies') && selectedDoctor);

  const canDelete = (doc) =>
    (user?.role?.toUpperCase() === 'DOCTOR' && doc.doctorId === user?.doctorId) ||
    (user?.role?.toUpperCase() === 'ASISTENTE' &&
      hasPermission('studies') &&
      selectedDoctor &&
      doc.doctorId === selectedDoctor.doctorId) ||
    user?.role?.toUpperCase() === 'HEALTH_STAFF' ||
    user?.role?.toUpperCase() === 'HEALTHSTAFF';

  // Cargar documentos desde el backend
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/study-documents', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        setDocuments(response.data);
      } catch (error) {
        console.error('Error al cargar documentos:', error);
        toast.error('Error al cargar los documentos');
        // Datos de ejemplo si falla la API
        setDocuments([
          {
            id: 1,
            title: 'Guía de Nutrición para Diabetes Tipo 2',
            summary: 'Recomendaciones nutricionales actualizadas para pacientes con diabetes tipo 2 basadas en las últimas investigaciones',
            type: 'file',
            url: '#',
            createdAt: '2024-07-15',
            isPublic: true,
            notes: 'Documento compartido con pacientes diabéticos'
          },
          {
            id: 2,
            title: 'Ejercicios Terapéuticos para Rehabilitación',
            summary: 'Rutina de ejercicios para rehabilitación de rodilla con técnicas actualizadas',
            type: 'youtube',
            url: 'https://youtube.com/watch?v=example',
            createdAt: '2024-07-14',
            isPublic: false,
            notes: 'Referencia personal para consultas'
          },
          {
            id: 3,
            title: 'Protocolo de Emergencias Cardíacas',
            summary: 'Procedimientos médicos actualizados para situaciones de emergencia cardíaca',
            type: 'file',
            url: '#',
            createdAt: '2024-07-13',
            isPublic: true,
            notes: 'Protocolo compartido con el equipo médico'
          },
          {
            id: 4,
            title: 'Investigación sobre Nuevos Tratamientos',
            summary: 'Paper de investigación sobre tratamientos innovadores en cardiología',
            type: 'file',
            url: '#',
            createdAt: '2024-07-12',
            isPublic: false,
            notes: 'Documento privado para estudio personal'
          },
          {
            id: 5,
            title: 'Base de Datos de Medicamentos',
            summary: 'Enlace a la base de datos oficial de medicamentos y sus interacciones',
            type: 'link',
            url: 'https://www.vademecum.es',
            createdAt: '2024-07-11',
            isPublic: true,
            notes: 'Recurso compartido con el equipo médico'
          },
          {
            id: 6,
            title: 'Imágenes de Radiografías Normales',
            summary: 'Colección de imágenes de radiografías normales para referencia diagnóstica',
            type: 'file',
            url: '#',
            createdAt: '2024-07-10',
            isPublic: false,
            notes: 'Referencia personal para diagnóstico'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.notes.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validar tipo de archivo
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (allowedTypes.includes(file.type)) {
      // Validar tamaño (máximo 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo es demasiado grande. Máximo 10MB.');
        return;
      }
      setNewDocument(prev => ({ ...prev, file }));
    } else {
      toast.error('Tipo de archivo no permitido. Solo PDF, imágenes, documentos de texto y Word.');
    }
  };

  const handleYoutubeUrlChange = (e) => {
    const url = e.target.value;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      setNewDocument(prev => ({ ...prev, youtubeUrl: url }));
    } else {
      toast.error('URL de YouTube no válida');
    }
  };

  const handleExternalUrlChange = (e) => {
    const url = e.target.value;
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      setNewDocument(prev => ({ ...prev, externalUrl: url }));
    } else if (url === '') {
      setNewDocument(prev => ({ ...prev, externalUrl: '' }));
    } else {
      toast.error('URL no válida. Debe comenzar con http:// o https://');
    }
  };

  const resetForm = () => {
    setNewDocument({
      title: '',
      summary: '',
      type: 'file',
      file: null,
      youtubeUrl: '',
      externalUrl: '',
      isPublic: false,
      notes: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('=== INICIO handleSubmit ===');
    console.log('newDocument:', newDocument);
    
    if (newDocument.title.length > 50) {
      toast.error('El título no puede tener más de 50 caracteres');
      return;
    }

    if (newDocument.summary.length > 200) {
      toast.error('El resumen no puede tener más de 200 caracteres');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', newDocument.title);
      formData.append('summary', newDocument.summary);
      formData.append('type', newDocument.type);
      formData.append('isPublic', newDocument.isPublic);
      formData.append('notes', newDocument.notes);
      
      console.log('Tipo de documento:', newDocument.type);
      
      if (newDocument.type === 'file' && newDocument.file) {
        console.log('Agregando archivo:', newDocument.file.name);
        formData.append('file', newDocument.file);
      } else if (newDocument.type === 'youtube') {
        console.log('Agregando URL de YouTube:', newDocument.youtubeUrl);
        formData.append('youtubeUrl', newDocument.youtubeUrl);
      } else if (newDocument.type === 'link') {
        console.log('Agregando URL externa:', newDocument.externalUrl);
        formData.append('externalUrl', newDocument.externalUrl);
      }

      console.log('Token:', localStorage.getItem('token'));
      console.log('Enviando petición a /api/study-documents...');

      const response = await axios.post('/api/study-documents', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Respuesta exitosa:', response.data);
      setDocuments(prev => [response.data, ...prev]);
      toast.success('Documento subido exitosamente');
      setShowUploadModal(false);
      resetForm();
    } catch (error) {
      console.error('Error al subir documento:', error);
      console.error('Detalles del error:', error.response?.data);
      console.error('Status del error:', error.response?.status);
      const message = error.response?.data?.message || 'Error al subir el documento';
      toast.error(message);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar este documento?')) {
      return;
    }

    try {
      await axios.delete(`/api/study-documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
      toast.success('Documento eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar documento:', error);
      toast.error('Error al eliminar el documento');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header Section - Always Visible */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="sm:flex sm:items-center sm:justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Zona de Estudio</h1>
                <p className="mt-2 text-sm text-gray-700">
                  Repositorio de conocimiento médico y recursos de investigación
                </p>
              </div>
              <div className="relative group">
                <InformationCircleIcon className="h-5 w-5 text-blue-500 cursor-help" />
                                 <div className="absolute top-full left-0 mt-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-normal z-10 shadow-lg" style={{ width: '500px', maxWidth: '90vw' }}>
                   <div className="font-medium mb-1">Zona de Estudio</div>
                   <div className="text-xs leading-relaxed">
                     Esta sección es para guardar documentos formales de investigación, videos, papers, guías clínicas, etc. para que el Profesional de la Salud tenga una referencia accesible en todo momento, ofreciendo la posibilidad de compartir con los pacientes a través de la plataforma. 
                     <br /><br />
                     <strong>No confundir con:</strong> Google Drive, OneDrive o carpetas en la nube para guardar archivos de trabajo.
                   </div>
                 </div>
              </div>
            </div>
            {/* Solo mostrar botón de agregar para roles con permiso */}
            {canUpload && (
              <div className="mt-4 sm:mt-0">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Agregar Material
                </button>
              </div>
            )}
          </div>

          {/* Buscador moderno */}
          <div className="mb-4">
            <div className="relative max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Buscar por título, nombre de documento, archivo o nota..."
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Lista de documentos */}
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow duration-200"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {doc.type === 'file' ? (
                        <DocumentTextIcon className="h-8 w-8 text-red-500" />
                      ) : doc.type === 'youtube' ? (
                        <PlayIcon className="h-8 w-8 text-red-500" />
                      ) : (
                        <LinkIcon className="h-8 w-8 text-blue-500" />
                      )}
                      <div className="ml-3 flex-1">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {doc.title}
                        </h3>
                        <div className="flex items-center mt-1 space-x-2">
                          {doc.isPublic ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <ShareIcon className="h-3 w-3 mr-1" />
                              Compartido
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              <LockClosedIcon className="h-3 w-3 mr-1" />
                              Privado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {canDelete(doc) ? (
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Eliminar documento"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm text-gray-500 line-clamp-2">
                    {doc.summary}
                  </p>
                  {doc.notes && (
                    <p className="mt-2 text-xs text-gray-400 italic">
                      Nota: {doc.notes}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="text-xs text-gray-400">
                        {formatDate(doc.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <a
                        href={doc.signedUrl || doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        {doc.type === 'file' ? 'Ver Archivo' : doc.type === 'youtube' ? 'Ver Video' : 'Ver Enlace'}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Mensaje cuando no hay documentos */}
        {!isLoading && filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No hay materiales de estudio</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery 
                ? 'No se encontraron materiales que coincidan con tu búsqueda.' 
                : user?.role?.toUpperCase() === 'PATIENT'
                  ? 'Tu profesional de la salud aún no ha compartido materiales de estudio contigo.'
                  : 'Comienza agregando tu primer material de estudio para mantenerte actualizado.'}
            </p>
            {canUpload && !searchQuery && (
              <div className="mt-6">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Agregar Primer Material
                </button>
              </div>
            )}
          </div>
        )}

        {/* Información de resultados */}
        {!isLoading && filteredDocuments.length > 0 && (
          <div className="mt-6 text-sm text-gray-500 text-center">
            Mostrando {filteredDocuments.length} de {documents.length} materiales de estudio
          </div>
        )}
      </div>

      {/* Modal de subida - Solo para roles con permiso */}
      {showUploadModal && canUpload && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Agregar Material de Estudio
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Título del Material (máx. 50 caracteres)
                </label>
                <input
                  type="text"
                  value={newDocument.title}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, title: e.target.value }))}
                  maxLength={50}
                  required
                  placeholder="Ej: Guía de Nutrición para Diabetes"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Descripción (máx. 200 caracteres)
                </label>
                <textarea
                  value={newDocument.summary}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, summary: e.target.value }))}
                  maxLength={200}
                  required
                  rows={3}
                  placeholder="Breve descripción del contenido del material"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tipo de Material
                </label>
                <select
                  value={newDocument.type}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, type: e.target.value }))}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="file">Archivo (PDF, imágenes, documentos)</option>
                  <option value="youtube">Video de YouTube</option>
                  <option value="link">Enlace externo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Visibilidad
                </label>
                <div className="mt-1 space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="isPublic"
                      value="false"
                      checked={!newDocument.isPublic}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, isPublic: e.target.value === 'true' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Privado (solo para mi)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="isPublic"
                      value="true"
                      checked={newDocument.isPublic}
                      onChange={(e) => setNewDocument(prev => ({ ...prev, isPublic: e.target.value === 'true' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Compartido (disponible para pacientes)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nota Personal (opcional)
                </label>
                <textarea
                  value={newDocument.notes}
                  onChange={(e) => setNewDocument(prev => ({ ...prev, notes: e.target.value }))}
                  maxLength={100}
                  rows={2}
                  placeholder="Nota personal sobre este material"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>

              {newDocument.type === 'file' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Archivo
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx"
                    onChange={handleFileChange}
                    required
                    className="mt-1 block w-full"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Sube PDFs, imágenes, documentos de texto o Word. Máximo 10MB. Tipos permitidos: PDF, JPG, PNG, GIF, TXT, DOC, DOCX
                  </p>
                </div>
              ) : newDocument.type === 'youtube' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    URL de YouTube
                  </label>
                  <input
                    type="url"
                    value={newDocument.youtubeUrl}
                    onChange={handleYoutubeUrlChange}
                    required
                    placeholder="https://youtube.com/watch?v=..."
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enlaces a videos educativos, conferencias médicas o tutoriales relevantes
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Enlace Externo
                  </label>
                  <input
                    type="url"
                    value={newDocument.externalUrl}
                    onChange={handleExternalUrlChange}
                    required
                    placeholder="https://ejemplo.com/recurso"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Enlaces a artículos médicos, recursos web, bases de datos, etc.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  Agregar Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents; 