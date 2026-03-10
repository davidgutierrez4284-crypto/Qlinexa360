import React from 'react';
import { LinkIcon, PlusIcon, TrashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

const LinkManager = ({ links = [], onChange, readOnly = false }) => {
  const validateUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getDomainFromUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return 'URL inválida';
    }
  };

  if (readOnly) {
    return (
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <LinkIcon className="h-5 w-5 text-blue-500" />
          <h4 className="font-semibold text-gray-800">Links asociados</h4>
        </div>
        {(!links || links.length === 0) ? (
          <div className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
            No hay links registrados en esta consulta.
          </div>
        ) : (
          <div className="space-y-2">
            {links.map((link, idx) => (
              <div key={link.id || link.url || idx} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <LinkIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm truncate"
                      title={link.url}
                    >
                      {link.description || link.label || getDomainFromUrl(link.url)}
                    </a>
                    <ArrowTopRightOnSquareIcon className="h-3 w-3 text-blue-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{link.url}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleAdd = () => {
    onChange([...links, { url: '', description: '' }]);
  };

  const handleChange = (idx, field, value) => {
    const updated = links.map((link, i) => i === idx ? { ...link, [field]: value } : link);
    onChange(updated);
  };

  const handleRemove = (idx) => {
    const updated = links.filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <LinkIcon className="h-5 w-5 text-blue-500" />
          <h4 className="font-semibold text-gray-800">Links asociados</h4>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center px-3 py-1.5 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Añadir link
        </button>
      </div>

      {(!links || links.length === 0) ? (
        <div className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg border border-gray-200">
          No hay links registrados. Haz clic en "Añadir link" para agregar vínculos relacionados con esta consulta.
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link, idx) => {
            const isValidUrl = link.url && validateUrl(link.url);
            return (
              <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-white">
                <div className="flex items-start space-x-3">
                  <LinkIcon className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        URL del vínculo
                      </label>
                      <input
                        type="url"
                        className={`form-input w-full text-sm ${!isValidUrl && link.url ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                        placeholder="https://ejemplo.com/recurso"
                        value={link.url || ''}
                        onChange={e => handleChange(idx, 'url', e.target.value)}
                        required
                      />
                      {!isValidUrl && link.url && (
                        <p className="text-xs text-red-600 mt-1">Por favor ingresa una URL válida</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descripción del vínculo
                      </label>
                      <input
                        type="text"
                        className="form-input w-full text-sm"
                        placeholder="Ej: Resultados de laboratorio, Artículo médico, etc."
                        value={link.description || link.label || ''}
                        onChange={e => handleChange(idx, 'description', e.target.value)}
                      />
                    </div>

                    {isValidUrl && (
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>Dominio: {getDomainFromUrl(link.url)}</span>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 inline-flex items-center"
                        >
                          <ArrowTopRightOnSquareIcon className="h-3 w-3 mr-1" />
                          Probar enlace
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                    title="Eliminar link"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LinkManager; 