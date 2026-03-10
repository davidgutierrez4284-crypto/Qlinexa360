import React from 'react';
import { CheckCircleIcon, ClockIcon, DocumentIcon, ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';

// --- Componente Principal ---
const ConsultationStatusIndicator = ({ consultation, onClick, className = '' }) => {
  const getStatusInfo = () => {
    // Verificar si hay archivos reales (files o links)
    const hasRealFiles = (consultation.files && consultation.files.length > 0) || 
                        (consultation.links && consultation.links.length > 0);
    
    // Si está bloqueada, mostrar estado de bloqueo
    if (consultation.isLocked) {
      return {
        icon: <LockClosedIcon className="w-5 h-5 text-gray-500" />,
        text: 'Bloqueada',
        color: 'text-gray-600',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      };
    }
    
    if (consultation.isComplete) {
      return {
        icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
        text: 'Completa',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    } else if (consultation.hasAttachments || hasRealFiles) {
      return {
        icon: <DocumentIcon className="w-5 h-5 text-blue-500" />,
        text: 'Con archivos',
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    } else {
      return {
        icon: <ClockIcon className="w-5 h-5 text-yellow-500" />,
        text: 'Sin archivos',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200'
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div 
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg border ${statusInfo.bgColor} ${statusInfo.borderColor} ${className}`}
      onClick={onClick}
    >
      {statusInfo.icon}
      <span className={`text-sm font-medium ${statusInfo.color}`}>
        {statusInfo.text}
      </span>
    </div>
  );
};

// --- Componente para lista de consultas ---
const ConsultationList = ({ consultations, onConsultationClick, showStatus = true }) => {
  return (
    <div className="space-y-3">
      {consultations.map((consultation) => (
        <div 
          key={consultation.id} 
          className="bg-white p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
          onClick={() => onConsultationClick(consultation)}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">
                {consultation.diagnosis}
              </h4>
              <p className="text-sm text-gray-600 mb-2">
                {consultation.reason}
              </p>
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>
                  {new Date(consultation.date || consultation.createdAt).toLocaleDateString('es-ES')}
                </span>
                <span>
                  Evolución: {consultation.clinicalEvolution}
                </span>
                {consultation.files && consultation.files.length > 0 && (
                  <span>
                    {consultation.files.length} archivo(s)
                  </span>
                )}
              </div>
            </div>
            {showStatus && (
              <ConsultationStatusIndicator consultation={consultation} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Componente para estadísticas ---
const ConsultationStats = ({ stats }) => {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="font-semibold text-lg text-gray-800 mb-4">Estadísticas de Consultas</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{stats.complete || 0}</div>
          <div className="text-sm text-gray-600">Completas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
          <div className="text-sm text-gray-600">Pendientes</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.withAttachments || 0}</div>
          <div className="text-sm text-gray-600">Con archivos</div>
        </div>
      </div>
    </div>
  );
};

// --- Componente para alertas de consultas pendientes ---
const PendingConsultationsAlert = ({ pendingCount, onClick, disabled = false }) => {
  if (pendingCount === 0) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
          <div>
            <h4 className="font-medium text-yellow-800">
              Consultas pendientes de completar
            </h4>
            <p className="text-sm text-yellow-700">
              {pendingCount} consulta(s) sin archivos adjuntos
            </p>
          </div>
        </div>
        <button
          onClick={onClick}
          disabled={disabled}
          title={disabled ? 'Solo puedes agregar archivos a la consulta más reciente' : ''}
          className={`px-4 py-2 text-white text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${disabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-700'}`}
        >
          Ver pendientes
        </button>
      </div>
    </div>
  );
};

export { ConsultationStatusIndicator, ConsultationList, ConsultationStats, PendingConsultationsAlert };
export default ConsultationStatusIndicator; 