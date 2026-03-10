import React, { useState, useRef } from 'react';
import { 
  DocumentIcon, 
  PhotoIcon, 
  XMarkIcon,
  PlusIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

const FILE_CATEGORIES = {
  DOCTOR_PHOTO: {
    label: 'Foto del profesional',
    icon: PhotoIcon,
    description: 'Fotos tomadas por el profesional durante la consulta',
    color: 'bg-blue-100 text-blue-800'
  },
  PATIENT_PHOTO: {
    label: 'Foto del Paciente',
    icon: PhotoIcon,
    description: 'Fotos del paciente o de lesiones/heridas',
    color: 'bg-green-100 text-green-800'
  },
  PRESCRIPTION: {
    label: 'Receta',
    icon: DocumentIcon,
    description: 'Recetas médicas emitidas',
    color: 'bg-purple-100 text-purple-800'
  },
  LAB_STUDY_REQUEST: {
    label: 'Solicitud de Laboratorio',
    icon: DocumentIcon,
    description: 'Solicitudes de estudios de laboratorio',
    color: 'bg-yellow-100 text-yellow-800'
  },
  LAB_STUDY_RESULT: {
    label: 'Resultado de Laboratorio',
    icon: DocumentIcon,
    description: 'Resultados de estudios de laboratorio',
    color: 'bg-orange-100 text-orange-800'
  },
  XRAY: {
    label: 'Radiografía',
    icon: DocumentIcon,
    description: 'Radiografías y estudios de imagen',
    color: 'bg-red-100 text-red-800'
  },
  OTHER: {
    label: 'Otro',
    icon: DocumentIcon,
    description: 'Otros documentos',
    color: 'bg-gray-100 text-gray-800'
  }
};

const FileUploadWithCategories = ({ 
  onFilesSelected, 
  onLinksAdded, 
  isConsultationLocked = false,
  existingFiles = [],
  existingLinks = []
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileCategories, setFileCategories] = useState({});
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState({ url: '', description: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const newFiles = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      fileName: file.name,
      fileType: file.type,
      size: file.size,
      category: 'OTHER' // Categoría por defecto
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
    
    // Asignar categorías automáticamente basado en el nombre del archivo
    const autoCategories = {};
    newFiles.forEach(fileObj => {
      const fileName = fileObj.fileName.toLowerCase();
      let category = 'OTHER';

      if (fileName.includes('receta') || fileName.includes('prescription')) {
        category = 'PRESCRIPTION';
      } else if (fileName.includes('lab') || fileName.includes('laboratorio') || fileName.includes('blood')) {
        category = 'LAB_STUDY_RESULT';
      } else if (fileName.includes('rayos') || fileName.includes('xray') || fileName.includes('radiografia')) {
        category = 'XRAY';
      } else if (fileName.includes('solicitud') || fileName.includes('request')) {
        category = 'LAB_STUDY_REQUEST';
      } else if (fileObj.fileType.startsWith('image/')) {
        // Por defecto, las imágenes del doctor van a DOCTOR_PHOTO
        category = 'DOCTOR_PHOTO';
      }

      autoCategories[fileObj.id] = category;
    });

    setFileCategories(prev => ({ ...prev, ...autoCategories }));
  };

  const handleCategoryChange = (fileId, category) => {
    setFileCategories(prev => ({
      ...prev,
      [fileId]: category
    }));
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
    setFileCategories(prev => {
      const newCategories = { ...prev };
      delete newCategories[fileId];
      return newCategories;
    });
  };

  const addLink = () => {
    if (newLink.url && newLink.description) {
      setLinks(prev => [...prev, { ...newLink, id: Math.random().toString(36).substr(2, 9) }]);
      setNewLink({ url: '', description: '' });
    }
  };

  const removeLink = (linkId) => {
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const handleSubmit = async () => {
    if (isConsultationLocked) {
      alert('Esta consulta está bloqueada y no se puede modificar.');
      return;
    }

    setIsUploading(true);

    try {
      // Simular subida de archivos
      const filesWithCategories = selectedFiles.map(fileObj => ({
        ...fileObj,
        category: fileCategories[fileObj.id] || 'OTHER'
      }));

      await onFilesSelected(filesWithCategories);
      await onLinksAdded(links);

      // Limpiar después de subir
      setSelectedFiles([]);
      setFileCategories({});
      setLinks([]);

    } catch (error) {
      console.error('Error al subir archivos:', error);
      alert('Error al subir archivos. Inténtalo de nuevo.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isConsultationLocked) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-2" />
          <span className="text-yellow-800 font-medium">
            Esta consulta está bloqueada y no se puede modificar
          </span>
        </div>
        <p className="text-yellow-700 text-sm mt-1">
          Las consultas se bloquean automáticamente cuando se crea una nueva consulta para el mismo padecimiento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Archivos existentes */}
      {existingFiles.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-3">Archivos Existentes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {existingFiles.map((file, index) => {
              const category = FILE_CATEGORIES[file.category] || FILE_CATEGORIES.OTHER;
              const IconComponent = category.icon;
              
              return (
                <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                  <IconComponent className="h-5 w-5 text-gray-500 mr-2" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${category.color}`}>
                      {category.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subir nuevos archivos */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Agregar Nuevos Archivos</h4>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Seleccionar Archivos
          </button>
          
          <p className="mt-2 text-sm text-gray-500">
            PNG, JPG, PDF hasta 10MB
          </p>
        </div>

        {/* Lista de archivos seleccionados */}
        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            <h5 className="font-medium text-gray-900">Archivos Seleccionados</h5>
            {selectedFiles.map((fileObj) => {
              const category = FILE_CATEGORIES[fileCategories[fileObj.id]] || FILE_CATEGORIES.OTHER;
              const IconComponent = category.icon;
              
              return (
                <div key={fileObj.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center flex-1">
                    <IconComponent className="h-5 w-5 text-gray-500 mr-3" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{fileObj.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {(fileObj.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <select
                      value={fileCategories[fileObj.id] || 'OTHER'}
                      onChange={(e) => handleCategoryChange(fileObj.id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1"
                    >
                      {Object.entries(FILE_CATEGORIES).map(([key, cat]) => (
                        <option key={key} value={key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => removeFile(fileObj.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Agregar enlaces */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 mb-3">Agregar Enlaces</h4>
        
        <div className="space-y-3">
          <div className="flex space-x-2">
            <input
              type="url"
              placeholder="https://ejemplo.com"
              value={newLink.url}
              onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="Descripción"
              value={newLink.description}
              onChange={(e) => setNewLink(prev => ({ ...prev, description: e.target.value }))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={addLink}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Agregar
            </button>
          </div>
          
          {links.length > 0 && (
            <div className="space-y-2">
              {links.map((link) => (
                <div key={link.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{link.url}</p>
                    <p className="text-xs text-gray-500">{link.description}</p>
                  </div>
                  <button
                    onClick={() => removeLink(link.id)}
                    className="text-red-500 hover:text-red-700 ml-2"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Botón de guardar */}
      {(selectedFiles.length > 0 || links.length > 0) && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isUploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? 'Guardando...' : 'Guardar Archivos'}
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploadWithCategories; 