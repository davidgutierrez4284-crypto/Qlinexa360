import React from 'react';
import { DocumentTextIcon, PhotoIcon, PaperClipIcon, EyeIcon, FolderIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

const getFileIcon = (fileType) => {
  if (fileType?.includes('pdf')) return <DocumentTextIcon className="h-5 w-5 text-red-500" />;
  if (fileType?.includes('image')) return <PhotoIcon className="h-5 w-5 text-blue-500" />;
  return <PaperClipIcon className="h-5 w-5 text-gray-500" />;
};

const getCategoryLabel = (category) => {
  const labels = {
    'PRESCRIPTION_REQUEST': 'Recetas y Estudios',
    'DOCTOR_PHOTO': 'Fotos del profesional',
    'STUDY_RESULT': 'Resultados',
    'PATIENT_PHOTO': 'Fotos Paciente',
    'OTHER': 'Otros'
  };
  return labels[category] || category;
};

const getCategoryIcon = (category) => {
  const icons = {
    'PRESCRIPTION_REQUEST': <DocumentTextIcon className="h-4 w-4 text-red-500" />,
    'DOCTOR_PHOTO': <PhotoIcon className="h-4 w-4 text-blue-500" />,
    'STUDY_RESULT': <DocumentTextIcon className="h-4 w-4 text-green-500" />,
    'PATIENT_PHOTO': <PhotoIcon className="h-4 w-4 text-purple-500" />,
    'OTHER': <PaperClipIcon className="h-4 w-4 text-gray-500" />
  };
  return icons[category] || <PaperClipIcon className="h-4 w-4 text-gray-500" />;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileHistoryViewer = ({ files }) => {
  const handleViewFile = async (file) => {
    try {
      // Obtener el token del localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No estás autenticado. Por favor, inicia sesión.');
        return;
      }

      // Si es un PDF de receta (guardado localmente), usar el endpoint de recetas
      if (file.category === 'PRESCRIPTION_REQUEST' && file.url.startsWith('uploads/recipes/')) {
        // Extraer el ID de la receta del nombre del archivo
        const fileName = file.fileName;
        const recipeIdMatch = fileName.match(/receta_([a-f0-9-]+)_/);
        
        if (recipeIdMatch) {
          const recipeId = recipeIdMatch[1];
          
          try {
            // Obtener la URL segura de visualización
            const response = await axios.get(`/api/recipes/${recipeId}/pdf-view-url`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.data.success) {
              // Abrir el PDF usando la URL segura
              window.open(response.data.data.viewUrl, '_blank');
            } else {
              throw new Error('Error al generar URL de visualización');
            }
          } catch (error) {
            console.error('Error obteniendo URL de visualización:', error);
            alert('Error al abrir el PDF. Inténtalo nuevamente.');
          }
          return;
        }
      }

      // Para otros archivos, usar el endpoint de URLs firmadas
      const response = await axios.get('/api/files/signed-url', { 
        params: { url: file.url },
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      window.open(response.data.url, '_blank');
    } catch (err) {
      console.error('Error al obtener archivo:', err);
      const status = err.response?.status;
      const msg = err.response?.data?.message;
      if (status === 404 || msg?.includes('no encontrado')) {
        alert('Archivo no encontrado. El archivo podría no estar disponible en este ambiente (por ejemplo, datos de otra base de datos o archivos eliminados).');
      } else if (status === 401) {
        alert('No estás autenticado. Por favor, inicia sesión.');
      } else if (status === 403) {
        alert('No tienes permisos para acceder a este archivo.');
      } else {
        alert(msg || 'No se pudo obtener el archivo. Verifica tu conexión e intenta de nuevo.');
      }
    }
  };

  if (!files || files.length === 0) {
    return (
      <div className="text-center py-8">
        <PaperClipIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No hay archivos</h3>
        <p className="mt-1 text-sm text-gray-500">No se han registrado archivos en esta consulta.</p>
      </div>
    );
  }

  // Agrupar archivos por categoría
  const filesByCategory = files.reduce((acc, file) => {
    const category = file.category || 'OTHER';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(file);
    return acc;
  }, {});

  return (
    <>
      <div className="divide-y divide-gray-200">
        {Object.entries(filesByCategory).map(([category, categoryFiles]) => (
          <div key={category}>
            <button
              className="w-full flex items-center justify-between px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-t-lg focus:outline-none"
              // Aquí puedes agregar lógica para expandir/collapse si lo deseas
            >
              <span className="flex items-center gap-2">
                {getCategoryIcon(category)}
                <span className="font-semibold text-gray-800">{getCategoryLabel(category)}</span>
              </span>
              <span className="text-xs text-gray-500">{categoryFiles.length} archivo(s)</span>
            </button>
            <div className="border-t border-gray-200">
              <div className="p-4 space-y-3">
                {categoryFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getFileIcon(file.fileType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                          <span>{formatFileSize(file.size)}</span>
                          {file.date && (
                            <span>{new Date(file.date).toLocaleDateString()}</span>
                          )}
                        </div>
                        {file.comment && (
                          <p className="text-xs text-gray-600 mt-1 truncate">{file.comment}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleViewFile(file)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Ver archivo"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        Ver
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default FileHistoryViewer; 