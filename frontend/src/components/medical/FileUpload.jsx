import React, { useState } from 'react';
import { EyeIcon, DocumentTextIcon, PhotoIcon, PaperClipIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import axios from 'axios';

const FileUpload = ({ files: controlledFiles = [], category, disabled = false, onFilesSelected }) => {
  const [loadingId, setLoadingId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const getFileIcon = (file) => {
    if (file.type?.includes('pdf') || file.fileType?.includes('pdf')) return <DocumentTextIcon className="h-5 w-5 text-red-500" />;
    if (file.type?.includes('image') || file.fileType?.includes('image')) return <PhotoIcon className="h-5 w-5 text-blue-500" />;
    return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const newSelectedFiles = [...selectedFiles, ...files];
    setSelectedFiles(newSelectedFiles);
    if (onFilesSelected) {
      // Combinar archivos existentes (controlledFiles) con los nuevos seleccionados
      const allFiles = [...(controlledFiles || []), ...newSelectedFiles];
      onFilesSelected(allFiles);
    }
  };

  const removeFile = (index, isExisting = false) => {
    if (isExisting) {
      // Remover archivo existente (controlledFiles)
      const newExistingFiles = controlledFiles.filter((_, i) => i !== index);
      if (onFilesSelected) {
        // Combinar archivos existentes restantes con los nuevos seleccionados
        const allFiles = [...newExistingFiles, ...selectedFiles];
        onFilesSelected(allFiles);
      }
    } else {
      // Remover archivo nuevo (selectedFiles)
      const newSelectedFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newSelectedFiles);
      if (onFilesSelected) {
        // Combinar archivos existentes con los nuevos seleccionados restantes
        const allFiles = [...(controlledFiles || []), ...newSelectedFiles];
        onFilesSelected(allFiles);
      }
    }
  };

  const getSignedUrl = async (fileUrl) => {
    try {
      const response = await axios.get('/api/files/signed-url', {
        params: { url: fileUrl },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      return response.data.url;
    } catch (error) {
      console.error('Error al obtener URL firmada:', error);
      return null;
    }
  };

  const handleFileView = async (file) => {
    if (file.url) {
      const signedUrl = await getSignedUrl(file.url);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
    }
  };

  // Si está deshabilitado, solo mostrar archivos existentes
  if (disabled) {
    return (
      <div className="space-y-2">
        {controlledFiles && controlledFiles.length > 0 ? (
          controlledFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center space-x-2">
                {getFileIcon(file)}
                <span className="text-sm text-gray-700">{file.fileName || file.originalName || file.name}</span>
                <span className="text-xs text-gray-500">
                  ({formatFileSize(file.size || 0)})
                </span>
              </div>
              <button
                onClick={() => handleFileView(file)}
                className="text-blue-600 hover:text-blue-800"
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">No hay archivos registrados.</p>
        )}
      </div>
    );
  }

  // Modo de edición - mostrar campos de subida
  return (
    <div className="space-y-4">
      {/* Archivos seleccionados */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Archivos seleccionados:</h4>
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded border">
              <div className="flex items-center space-x-2">
                {getFileIcon(file)}
                <span className="text-sm text-gray-700">{file.name}</span>
                <span className="text-xs text-gray-500">
                  ({formatFileSize(file.size)})
                </span>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-600 hover:text-red-800"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Campo de subida */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id={`file-upload-${category}`}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx"
        />
        <label
          htmlFor={`file-upload-${category}`}
          className="cursor-pointer flex flex-col items-center space-y-2"
        >
          <PaperClipIcon className="h-8 w-8 text-gray-400" />
          <div>
            <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
              Seleccionar archivos
            </span>
            <p className="text-xs text-gray-500 mt-1">
              PDF, JPG, PNG, GIF, TXT, DOC, DOCX (máx. 10MB)
            </p>
          </div>
        </label>
      </div>

      {/* Archivos existentes */}
      {controlledFiles && controlledFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Archivos existentes:</h4>
          {controlledFiles.map((file, index) => (
            <div key={`existing-${index}`} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
              <div className="flex items-center space-x-2">
                {getFileIcon(file)}
                <span className="text-sm text-gray-700">{file.fileName || file.originalName || file.name}</span>
                <span className="text-xs text-gray-500">
                  ({formatFileSize(file.size || 0)})
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleFileView(file)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Ver archivo"
                >
                  <EyeIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => removeFile(index, true)}
                  className="text-red-600 hover:text-red-800"
                  title="Eliminar archivo"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload; 