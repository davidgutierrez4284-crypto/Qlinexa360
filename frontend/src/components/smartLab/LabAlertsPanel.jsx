import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import LabTrafficLight from './LabTrafficLight';

const LabAlertsPanel = ({ alerts = [], onDismiss, dismissingId }) => (
  <div className="space-y-3">
    {!alerts.length ? (
      <p className="text-sm text-gray-500">No hay alertas activas.</p>
    ) : (
      alerts.map((a) => (
        <div key={a.id} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <LabTrafficLight status={a.severity || 'gray'} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900">{a.title}</p>
            <p className="text-sm text-gray-600 mt-1">{a.message}</p>
            <p className="text-xs text-gray-400 mt-1">{a.alertType}</p>
          </div>
          {onDismiss ? (
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              title="Descartar"
              disabled={dismissingId === a.id}
              onClick={() => onDismiss(a.id)}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ))
    )}
  </div>
);

export default LabAlertsPanel;
