import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { uploadFile } from '../services/doctorService';

const useFileUpload = () => {
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files, category) => {
    if (!files || files.length === 0) {
      return [];
    }

    setIsUploading(true);
    setUploadProgress({});
    setUploadErrors({});

    const uploadedFiles = [];
    const errors = {};

    try {
      // Subir archivos en paralelo con control de progreso
      const uploadPromises = files.map(async (file) => {
        try {
          const result = await uploadFile(
            file,
            category,
            (progressEvent) => {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(prev => ({
                ...prev,
                [file.name]: percent
              }));
            }
          );

          // Marcar como completado
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: 100
          }));

          return result;
        } catch (error) {
          const errorMessage = error.response?.data?.message || error.message || 'Error al subir archivo';
          errors[file.name] = errorMessage;
          setUploadErrors(prev => ({
            ...prev,
            [file.name]: errorMessage
          }));
          
          toast.error(`Error al subir ${file.name}: ${errorMessage}`);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      
      // Filtrar archivos subidos exitosamente
      results.forEach((result, index) => {
        if (result) {
          uploadedFiles.push(result);
        }
      });

      // Mostrar resumen
      if (uploadedFiles.length > 0) {
        toast.success(`${uploadedFiles.length} de ${files.length} archivos subidos exitosamente`);
      }

      if (Object.keys(errors).length > 0) {
        toast.warning(`${Object.keys(errors).length} archivos no se pudieron subir`);
      }

    } catch (error) {
      console.error('Error general en la subida de archivos:', error);
      toast.error('Error al procesar la subida de archivos');
    } finally {
      setIsUploading(false);
    }

    return uploadedFiles;
  }, []);

  const clearProgress = useCallback(() => {
    setUploadProgress({});
    setUploadErrors({});
  }, []);

  const getUploadStatus = useCallback((fileName) => {
    if (uploadErrors[fileName]) {
      return { status: 'error', message: uploadErrors[fileName] };
    }
    if (uploadProgress[fileName] === 100) {
      return { status: 'completed', progress: 100 };
    }
    if (uploadProgress[fileName] > 0) {
      return { status: 'uploading', progress: uploadProgress[fileName] };
    }
    return { status: 'pending', progress: 0 };
  }, [uploadProgress, uploadErrors]);

  return {
    uploadFiles,
    uploadProgress,
    uploadErrors,
    isUploading,
    clearProgress,
    getUploadStatus
  };
};

export default useFileUpload; 