import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { 
  XMarkIcon, 
  DocumentTextIcon, 
  PhotoIcon, 
  PaperClipIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const FileViewer = ({ isOpen, onClose, file, onDownload }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signedUrl, setSignedUrl] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (isOpen && file) {
      loadFile();
    }
  }, [isOpen, file]);

  const loadFile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Obtener URL firmada para el archivo
      const response = await axios.get('/api/files/signed-url', { 
        params: { url: file.url },
        timeout: 10000
      });
      
      setSignedUrl(response.data.url);
    } catch (err) {
      console.error('Error al cargar el archivo:', err);
      setError('No se pudo cargar el archivo. Verifica tus permisos o intenta más tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!signedUrl) return;
    
    try {
      setDownloadProgress(0);
      
      const response = await axios.get(signedUrl, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setDownloadProgress(percent);
        }
      });

      // Crear URL del blob y descargar
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setDownloadProgress(0);
      if (onDownload) onDownload(file);
    } catch (err) {
      console.error('Error al descargar:', err);
      setError('Error al descargar el archivo');
    }
  };

  const getFileIcon = () => {
    if (file.fileType?.includes('pdf')) return <DocumentTextIcon className="h-8 w-8 text-red-500" />;
    if (file.fileType?.includes('image')) return <PhotoIcon className="h-8 w-8 text-blue-500" />;
    return <PaperClipIcon className="h-8 w-8 text-gray-500" />;
  };

  const renderPreview = () => {
    if (!signedUrl) return null;

    const fileType = file.fileType?.toLowerCase();

    if (fileType?.includes('image')) {
      return (
        <div className="relative">
          <img
            src={signedUrl}
            alt={file.fileName}
            className="max-w-full h-auto rounded-lg shadow-lg"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setError('Error al cargar la imagen');
              setIsLoading(false);
            }}
          />
        </div>
      );
    }

    if (fileType?.includes('pdf')) {
      return (
        <iframe
          src={signedUrl}
          className="w-full h-[600px] rounded-lg border"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setError('Error al cargar el PDF');
            setIsLoading(false);
          }}
        />
      );
    }

    // Para otros tipos de archivo, mostrar información
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        {getFileIcon()}
        <p className="mt-4 text-lg font-medium text-gray-700">{file.fileName}</p>
        <p className="text-sm text-gray-500">
          Tipo: {file.fileType} • Tamaño: {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Este tipo de archivo no se puede previsualizar
        </p>
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

        <div className="relative bg-white rounded-lg max-w-4xl w-full mx-auto shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              {getFileIcon()}
              <div>
                <Dialog.Title className="text-lg font-medium text-gray-900">
                  {file?.fileName}
                </Dialog.Title>
                <p className="text-sm text-gray-500">
                  {file?.fileType} • {formatFileSize(file?.size)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownload}
                disabled={!signedUrl || downloadProgress > 0}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {downloadProgress > 0 ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    {downloadProgress}%
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Descargar
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {isLoading && (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            )}

            {error ? (
              <div className="text-center py-12">
                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
                <p className="mt-1 text-sm text-gray-500">{error}</p>
                <button
                  onClick={loadFile}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Reintentar
                </button>
              </div>
            ) : (
              renderPreview()
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default FileViewer; 