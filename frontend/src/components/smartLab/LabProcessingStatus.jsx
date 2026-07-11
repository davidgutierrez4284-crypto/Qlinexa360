import React from 'react';
import { ArrowPathIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

const STATUS_MAP = {
  uploaded: { label: 'Subido', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: ClockIcon },
  processing: { label: 'Procesando', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: ArrowPathIcon, spin: true },
  pending_review: { label: 'Pendiente de revisión', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: ClockIcon },
  confirmed: { label: 'Confirmado', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircleIcon },
  extraction_failed: { label: 'Extracción fallida', color: 'text-red-700 bg-red-50 border-red-200', icon: XCircleIcon },
  rejected: { label: 'Rechazado', color: 'text-gray-700 bg-gray-100 border-gray-300', icon: XCircleIcon },
  archived: { label: 'Archivado', color: 'text-gray-600 bg-gray-50 border-gray-200', icon: ClockIcon },
};

const LabProcessingStatus = ({ status, confidence, note, className = '' }) => {
  const cfg = STATUS_MAP[status] || { label: status || 'Desconocido', color: 'text-gray-700 bg-gray-50 border-gray-200', icon: ClockIcon };
  const Icon = cfg.icon;
  return (
    <div className={'inline-flex flex-col gap-1 rounded-md border px-3 py-2 ' + cfg.color + ' ' + className}>
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Icon className={'h-5 w-5 ' + (cfg.spin ? 'animate-spin' : '')} />
        {cfg.label}
      </span>
      {note ? (
        <span className="text-xs opacity-90">{note}</span>
      ) : null}
      {typeof confidence === 'number' ? (
        <span className="text-xs opacity-80">Confianza de extracción: {Math.round(confidence * 100)}%</span>
      ) : null}
    </div>
  );
};

export default LabProcessingStatus;

