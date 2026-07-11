import React from 'react';
import LabTrafficLight from './LabTrafficLight';

const LabHealthDashboard = ({ scores = [] }) => {
  if (!scores.length) {
    return <p className="text-sm text-gray-500">Aún no hay puntajes de salud por categoría. Confirma estudios de laboratorio.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {scores.map((s) => (
        <div key={s.id || s.category} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold text-gray-900">{s.label || s.category}</h4>
            <LabTrafficLight status={s.status} />
          </div>
          <p className="text-sm text-gray-600">{s.summary}</p>
          {s.score != null ? <p className="text-xs text-gray-400 mt-2">Índice: {Math.round(s.score)}</p> : null}
        </div>
      ))}
    </div>
  );
};

export default LabHealthDashboard;
