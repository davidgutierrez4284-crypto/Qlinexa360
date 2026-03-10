import React from 'react';
import { InformationCircleIcon, CheckCircleIcon, ClockIcon, DocumentIcon } from '@heroicons/react/24/outline';

const ConsultationStatusHelp = ({ isOpen, onClose }) => {
  const statuses = [
    {
      icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
      title: 'Completa',
      description: 'La consulta tiene toda la información básica y archivos adjuntos.',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      icon: <DocumentIcon className="w-5 h-5 text-blue-500" />,
      title: 'Con archivos',
      description: 'La consulta tiene información básica y algunos archivos adjuntos.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      icon: <ClockIcon className="w-5 h-5 text-yellow-500" />,
      title: 'Sin archivos',
      description: 'La consulta solo tiene información básica. Puedes agregar archivos más tarde haciendo clic en la consulta.',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Estados de Consultas</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
          {statuses.map((status, index) => (
            <div key={index} className={`flex items-start space-x-3 p-3 rounded-lg border ${status.bgColor} ${status.borderColor}`}>
              {status.icon}
              <div className="flex-1">
                <h4 className={`font-medium ${status.color}`}>{status.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{status.description}</p>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <InformationCircleIcon className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm text-blue-800 font-medium">Sistema de Consultas Divididas</p>
              <p className="text-sm text-blue-700 mt-1">
                Puedes guardar la información básica primero y agregar archivos después haciendo clic en la consulta. 
                Esto te permite trabajar de forma más eficiente desde una sola vista.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultationStatusHelp; 