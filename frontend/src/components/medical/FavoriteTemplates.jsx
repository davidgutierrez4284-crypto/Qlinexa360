import React, { useState, useEffect } from 'react';
import { StarIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { 
  prescriptionTemplates,
  getFavoriteTemplates,
  saveFavoriteTemplate,
  removeFavoriteTemplate
} from '../../utils/medicalData';

const FavoriteTemplates = ({ onSelectTemplate }) => {
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    // Cargar favoritos al montar el componente
    const loadFavorites = () => {
      const favoriteIds = getFavoriteTemplates();
      const favoriteTemplates = prescriptionTemplates.filter(template => 
        favoriteIds.includes(template.id)
      );
      setFavorites(favoriteTemplates);
    };

    loadFavorites();

    // Suscribirse a cambios en localStorage
    const handleStorageChange = (e) => {
      if (e.key === 'favoriteTemplates') {
        loadFavorites();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleFavoriteToggle = (templateId, e) => {
    e.stopPropagation();
    const isFavorite = favorites.some(t => t.id === templateId);
    
    if (isFavorite) {
      removeFavoriteTemplate(templateId);
      setFavorites(prev => prev.filter(t => t.id !== templateId));
      toast.success('Plantilla removida de favoritos');
    } else {
      saveFavoriteTemplate(templateId);
      const template = prescriptionTemplates.find(t => t.id === templateId);
      if (template) {
        setFavorites(prev => [...prev, template]);
        toast.success('Plantilla agregada a favoritos');
      }
    }
  };

  if (favorites.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowFavorites(!showFavorites)}
        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
      >
        <StarIcon className="h-4 w-4 mr-1" />
        Favoritos ({favorites.length})
      </button>

      {showFavorites && (
        <div className="absolute z-10 mt-2 w-72 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 border-b">
              Plantillas Favoritas
            </div>
            {favorites.map((template) => (
              <div
                key={template.id}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  onSelectTemplate(template);
                  setShowFavorites(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-sm text-gray-500">{template.category}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleFavoriteToggle(template.id, e)}
                    className="text-yellow-400 hover:text-yellow-500"
                  >
                    <StarIcon className="h-5 w-5 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FavoriteTemplates; 