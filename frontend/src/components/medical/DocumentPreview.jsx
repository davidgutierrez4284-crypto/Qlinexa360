import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, DocumentIcon, PhotoIcon } from '@heroicons/react/24/outline';

const DocumentPreview = ({ isOpen, onClose, document }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const getFileType = (file) => {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (file.type === 'application/pdf') {
      return 'pdf';
    }
    return 'unknown';
  };

  const renderPreview = () => {
    if (!document) return null;

    const fileType = getFileType(document);

    switch (fileType) {
      case 'image':
        return (
          <div className="relative">
            <img
              src={URL.createObjectURL(document)}
              alt="Preview"
              className="max-w-full h-auto rounded-lg"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setError('Error al cargar la imagen');
                setIsLoading(false);
              }}
            />
          </div>
        );
      case 'pdf':
        return (
          <iframe
            src={URL.createObjectURL(document)}
            className="w-full h-[600px] rounded-lg"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setError('Error al cargar el PDF');
              setIsLoading(false);
            }}
          />
        );
      default:
        return (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
            <DocumentIcon className="h-12 w-12 text-gray-400" />
            <span className="ml-2 text-gray-500">Vista previa no disponible</span>
          </div>
        );
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

        <div className="relative bg-white rounded-lg max-w-4xl w-full mx-4 p-6">
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-medium text-gray-900">
              Vista Previa - {document?.name}
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            )}

            {error ? (
              <div className="text-center py-12">
                <XMarkIcon className="mx-auto h-12 w-12 text-red-500" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Error</h3>
                <p className="mt-1 text-sm text-gray-500">{error}</p>
              </div>
            ) : (
              renderPreview()
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default DocumentPreview; 