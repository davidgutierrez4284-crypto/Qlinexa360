import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { createPortal } from 'react-dom';
import { 
  XMarkIcon, 
  PhotoIcon, 
  CalendarIcon,
  ViewColumnsIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';

const PhotoHistoryViewer = ({ photoHistory, isOpen = false, onClose }) => {
  console.log('PhotoHistoryViewer renderizado con:', { photoHistory, isOpen });
  console.log('photoHistory length:', photoHistory?.length);
  console.log('photoHistory data:', photoHistory);
  const [view, setView] = useState('timeline'); // 'timeline' | 'gallery'
  const [gallerySize, setGallerySize] = useState('large'); // 'small' | 'medium' | 'large'
  const [selectedImage, setSelectedImage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = 100%, 2 = 200%, etc.
  const [hoveredImage, setHoveredImage] = useState(null);
  const [failedImageIds, setFailedImageIds] = useState(new Set());

  // Reset failed images cuando cambia el historial
  useEffect(() => {
    if (isOpen && photoHistory) setFailedImageIds(new Set());
  }, [isOpen, photoHistory]);

  // Agregar listener para la tecla Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (selectedImage) {
          setSelectedImage(null);
        } else if (isOpen) {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedImage, isOpen, onClose]);

  // Agregar listener para cerrar con clic en área oscura
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (selectedImage && e.target.classList.contains('modal-backdrop')) {
        setSelectedImage(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [selectedImage]);

  const handleViewImage = async (img, event) => {
    // Prevenir que el evento se propague
    if (event) {
      event.stopPropagation();
    }
    
    try {
      // Usar directamente la URL que ya viene firmada del backend
      console.log('Abriendo imagen en nueva ventana:', img.url);
      
      // Abrir en nueva ventana con parámetros para que aparezca en primer plano
      const newWindow = window.open(
        img.url, 
        '_blank',
        'width=1200,height=800,scrollbars=yes,resizable=yes,top=50,left=50,menubar=yes,toolbar=yes,location=yes,status=yes'
      );
      
      // Asegurar que la ventana esté en primer plano
      if (newWindow) {
        newWindow.focus();
        // Forzar el foco después de un pequeño delay
        setTimeout(() => {
          newWindow.focus();
        }, 100);
      }
    } catch (err) {
      console.error('Error al abrir imagen:', err);
      
      let errorMessage = 'No se pudo abrir la imagen. Por favor, inténtalo de nuevo.';
      
      if (err.response?.status === 401) {
        errorMessage = 'No estás autenticado. Por favor, inicia sesión.';
      } else if (err.response?.status === 403) {
        errorMessage = 'No tienes permisos para acceder a esta imagen.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Imagen no encontrada.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      alert(errorMessage);
    }
  };

  const handleImageClick = (img) => {
    setSelectedImage(img);
    setZoomLevel(1); // Reset zoom al abrir imagen
  };

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoomLevel(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleZoomReset = (e) => {
    e.stopPropagation();
    setZoomLevel(1);
  };

  const handleCloseImage = (e) => {
    e.stopPropagation();
    setSelectedImage(null);
  };

  const handleImageError = (imgId) => {
    setFailedImageIds(prev => new Set([...prev, imgId]));
  };

  const renderImageWithZoom = (img, containerClass, imageClass) => {
    const failed = failedImageIds.has(img.id);
    return (
    <div 
      key={img.id}
      className={`relative group ${containerClass} transition-all duration-300 ${
        hoveredImage === img.id ? 'z-10' : ''
      }`}
      onMouseEnter={() => setHoveredImage(img.id)}
      onMouseLeave={() => setHoveredImage(null)}
    >
      <div className="bg-gray-100 rounded-lg p-2 flex items-center justify-center min-h-[160px]">
        {failed ? (
          <div className={`${imageClass} flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 text-sm`}>
            <PhotoIcon className="h-8 w-8 text-gray-400 mb-1" />
            <span>Foto no disponible</span>
          </div>
        ) : (
          <img
            src={img.url}
            alt={img.fileName}
            className={`${imageClass} object-contain rounded-lg shadow-md border border-gray-200 cursor-pointer transition-all duration-300 ${
              hoveredImage === img.id ? 'scale-150 z-20 shadow-2xl' : 'hover:scale-110'
            }`}
            title={`${img.fileName} - ${img.date ? new Date(img.date).toLocaleDateString() : ''}`}
            onClick={() => handleImageClick(img)}
            onError={() => handleImageError(img.id)}
          />
        )}
      </div>
      {hoveredImage === img.id && !failed && (
        <div className="absolute top-2 right-2 flex space-x-1">
          <button
            onClick={(e) => handleViewImage(img, e)}
            className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1"
            title="Abrir en nueva ventana"
          >
            <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            Nueva ventana
          </button>
          <div className="bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-medium">
            Click para ampliar
          </div>
        </div>
      )}
    </div>
  );
  };

  const isEmpty = !photoHistory || photoHistory.length === 0;

  if (!isOpen) {
    return null;
  }

  // Orden cronológico (más antiguo primero) para evolución visual
  const sortedHistory = [...(photoHistory || [])].sort(
    (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
  );

  const renderTimelineView = () => (
    <div className="space-y-6 max-h-full overflow-y-auto">
      {sortedHistory.map(block => (
        <div key={block.medicalRecordId} className="border-l-4 border-blue-500 pl-6 py-4 bg-blue-50 rounded-r-lg">
          <div className="flex items-center gap-3 mb-4">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            <span className="text-lg font-semibold text-blue-700">
              {new Date(block.date).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
          {block.comment && (
            <p className="text-gray-600 text-sm mb-4 italic">"{block.comment}"</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {block.images.map(img => 
              renderImageWithZoom(img, '', 'max-w-full max-h-40')
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderGalleryView = () => {
    const allImages = sortedHistory.flatMap(block => 
      block.images.map(img => ({ ...img, date: block.date, comment: block.comment, medicalRecordId: block.medicalRecordId }))
    );

    const sizeClasses = {
      small: 'w-32 h-32',
      medium: 'w-40 h-40', 
      large: 'w-48 h-48'
    };

    return (
      <div className="max-h-full overflow-y-auto">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {allImages.map(img => 
            renderImageWithZoom(img, '', sizeClasses[gallerySize])
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Modal principal */}
      <Dialog
        open={isOpen}
        onClose={onClose}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

          <div className="relative bg-white rounded-xl max-w-[95vw] w-full max-h-[95vh] mx-auto shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <PhotoIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <Dialog.Title className="text-2xl font-bold text-gray-900">
                    Evolución Visual
                  </Dialog.Title>
                  <p className="text-sm text-gray-500">
                    {photoHistory?.length ?? 0} consulta(s) • {(photoHistory ?? []).flatMap(block => block.images).length} imagen(es)
                  </p>
                </div>
              </div>
              
              {/* Controles de vista */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setView('timeline')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      view === 'timeline' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ClockIcon className="h-4 w-4 inline mr-1" />
                    Línea de tiempo
                  </button>
                  <button
                    onClick={() => setView('gallery')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      view === 'gallery' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <ViewColumnsIcon className="h-4 w-4 inline mr-1" />
                    Galería
                  </button>
                </div>
                
                {view === 'gallery' && (
                  <select
                    value={gallerySize}
                    onChange={(e) => setGallerySize(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="small">Pequeño</option>
                    <option value="medium">Mediano</option>
                    <option value="large">Grande</option>
                  </select>
                )}
                
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {isEmpty ? (
                <div className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-300 rounded-lg">
                  <PhotoIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h2 className="text-xl font-semibold mt-2">No se ha registrado ninguna evolución visual aún.</h2>
                  <p className="mt-2">Puedes añadir una fotografía clínica desde "registrar consulta"</p>
                </div>
              ) : (
                view === 'timeline' ? renderTimelineView() : renderGalleryView()
              )}
            </div>
          </div>
        </div>
      </Dialog>

      {/* Modal para imagen seleccionada con zoom - Renderizado fuera del Dialog */}
      {selectedImage && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 modal-backdrop" 
          style={{ zIndex: 9999999 }}
          onClick={(e) => {
            if (e.target.classList.contains('modal-backdrop')) {
              setSelectedImage(null);
            }
          }}
        >
          <div className="relative bg-white rounded-xl max-w-6xl w-full mx-auto shadow-2xl" style={{ zIndex: 10000000 }}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <div className="text-lg font-medium text-gray-900">
                {selectedImage.fileName}
              </div>
              <div className="flex items-center space-x-2">
                {/* Controles de zoom */}
                <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleZoomOut(e);
                    }}
                    className="p-1 rounded hover:bg-gray-200 transition-colors border border-gray-300 cursor-pointer"
                    title="Zoom Out"
                  >
                    <MagnifyingGlassMinusIcon className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium min-w-[60px] text-center bg-white px-2 py-1 rounded border">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleZoomIn(e);
                    }}
                    className="p-1 rounded hover:bg-gray-200 transition-colors border border-gray-300 cursor-pointer"
                    title="Zoom In"
                  >
                    <MagnifyingGlassPlusIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleZoomReset(e);
                    }}
                    className="p-1 rounded hover:bg-gray-200 transition-colors text-xs border border-gray-300 cursor-pointer"
                    title="Reset Zoom"
                  >
                    Reset
                  </button>
                </div>
                
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleViewImage(selectedImage, e);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
                  title="Abrir en nueva ventana"
                >
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  Abrir en nueva ventana
                </button>
                
                {/* Botón de cerrar */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedImage(null);
                  }}
                  className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors font-bold text-lg"
                  title="Cerrar"
                >
                  X
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="flex items-center justify-center bg-gray-100 rounded-lg p-4 overflow-auto relative">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.fileName}
                  className="object-contain rounded-lg transition-transform duration-200"
                  style={{ 
                    transform: `scale(${zoomLevel})`,
                    maxWidth: '100%',
                    maxHeight: '70vh'
                  }}
                />
              </div>
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Fecha:</strong> {new Date(selectedImage.date).toLocaleDateString()}</p>
                {selectedImage.comment && (
                  <p><strong>Comentario:</strong> {selectedImage.comment}</p>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PhotoHistoryViewer; 