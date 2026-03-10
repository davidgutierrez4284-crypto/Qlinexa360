import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../hooks/useAuth';
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
  LockClosedIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const StudyDocuments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newDocument, setNewDocument] = useState({
    title: '',
    summary: '',
    type: 'pdf',
    file: null,
    youtubeUrl: '',
    isPublic: false,
    notes: ''
  });

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
            type: 'pdf',
            url: '#',
            createdAt: '2024-03-15',
            isPublic: true,
            notes: 'Documento compartido con pacientes diabéticos'
          },
          {
            id: 2,
            title: 'Ejercicios Terapéuticos para Rehabilitación',
            summary: 'Rutina de ejercicios para rehabilitación de rodilla con técnicas actualizadas',
            type: 'youtube',
            url: 'https://youtube.com/watch?v=example',
            createdAt: '2024-03-14',
            isPublic: false,
            notes: 'Referencia personal para consultas'
          },
          {
            id: 3,
            title: 'Protocolo de Emergencias Cardíacas',
            summary: 'Procedimientos médicos actualizados para situaciones de emergencia cardíaca',
            type: 'pdf',
            url: '#',
            createdAt: '2024-03-13',
            isPublic: true,
            notes: 'Protocolo compartido con el equipo médico'
          },
          {
            id: 4,
            title: 'Investigación sobre Nuevos Tratamientos',
            summary: 'Paper de investigación sobre tratamientos innovadores en cardiología',
            type: 'pdf',
            url: '#',
            createdAt: '2024-03-12',
            isPublic: false,
            notes: 'Documento privado para estudio personal'
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
    if (file && file.type === 'application/pdf') {
      setNewDocument(prev => ({ ...prev, file }));
    } else {
      toast.error('Solo se permiten archivos PDF');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (newDocument.title.length > 25) {
      toast.error('El título no puede tener más de 25 caracteres');
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
      
      if (newDocument.type === 'pdf' && newDocument.file) {
        formData.append('file', newDocument.file);
      } else if (newDocument.type === 'youtube') {
        formData.append('youtubeUrl', newDocument.youtubeUrl);
      }

      const response = await axios.post('/api/study-documents', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setDocuments(prev => [response.data, ...prev]);
      toast.success('Documento subido exitosamente');
      setShowUploadModal(false);
      setNewDocument({
        title: '',
        summary: '',
        type: 'pdf',
        file: null,
        youtubeUrl: '',
        isPublic: false,
        notes: ''
      });
    } catch (error) {
      console.error('Error al subir documento:', error);
      toast.error('Error al subir el documento');
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
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-normal max-w-xs z-10">
                  Esta sección Zona de estudio es para guardar documentos formales de investigación, videos, etc para que el doctor tenga una referencia accesible en todo momento, ofreciendo la posibilidad de compartir con los pacientes a través de la plataforma. No confundir el uso con GoogleDrive ni OneDrive ni carpeta en la nube para guardar archivos de trabajo
                </div>
              </div>
            </div>
            {user?.role === 'doctor' && (
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
                        {doc.type === 'pdf' ? (
                          <DocumentTextIcon className="h-8 w-8 text-red-500" />
                        ) : (
                          <PlayIcon className="h-8 w-8 text-red-500" />
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
                      {(user?.role?.toUpperCase() === 'DOCTOR' && doc.doctorId === user.doctorId) || user?.role?.toUpperCase() === 'HEALTH_STAFF' ? (
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
                      <span className="text-xs text-gray-400">
                        {new Date(doc.createdAt).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                                          <a
                      href={doc.signedUrl || doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        {doc.type === 'pdf' ? 'Ver PDF' : 'Ver Video'}
                      </a>
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
              {searchQuery ? 'No se encontraron materiales que coincidan con tu búsqueda.' : 'Comienza agregando tu primer material de estudio para mantenerte actualizado.'}
            </p>
            {user?.role === 'doctor' && !searchQuery && (
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

      {/* Modal de subida */}
      {showUploadModal && (
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
                  <option value="pdf">PDF (Papers, guías, protocolos)</option>
                  <option value="youtube">Video de YouTube</option>
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

              {newDocument.type === 'pdf' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Archivo PDF
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    required
                    className="mt-1 block w-full"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Sube papers, guías médicas, protocolos o cualquier documento PDF de investigación
                  </p>
                </div>
              ) : (
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
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
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

export default StudyDocuments; 