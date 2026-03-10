import React from 'react';
import { CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import Tooltip from '../common/Tooltip';

// Función para formatear fecha en formato dd-MMM-yy
const formatDate = (date) => {
  if (!date) return '';
  
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear().toString().slice(-2);
  
  return `${day}-${month}-${year}`;
};

// Definimos las fases en el orden correcto y con las etiquetas para mostrar
const ALL_PHASES = [
  { key: 'INITIAL_EVALUATION', label: 'Evaluación Inicial' },
  { key: 'CONFIRMED_DIAGNOSIS', label: 'Diagnóstico' },
  { key: 'TREATMENT_PLAN', label: 'Plan de Tratamiento' },
  { key: 'FOLLOW_UP', label: 'Seguimiento' },
  { key: 'STABILIZATION', label: 'Estabilización' },
  { key: 'MEDICAL_DISCHARGE', label: 'Alta Médica' },
  { key: 'READMISSION', label: 'Recaída' },
];

const ClinicalEvolutionTracker = ({ medicalRecords = [] }) => {
  // 1. Procesar los registros para encontrar la fecha más reciente de cada fase
  const completedPhases = new Map();
  if (medicalRecords && medicalRecords.length > 0) {
    // Ordenamos los registros por fecha para asegurarnos de que tomamos la última ocurrencia
    const sortedRecords = [...medicalRecords].sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt);
      const dateB = new Date(b.date || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    sortedRecords.forEach(record => {
      if (record.clinicalEvolution) {
        // Si ya existe la fase, solo la actualizamos si la fecha es más reciente
        if (!completedPhases.has(record.clinicalEvolution) || 
            new Date(record.date || record.createdAt) > new Date(completedPhases.get(record.clinicalEvolution))) {
          completedPhases.set(record.clinicalEvolution, record.date || record.createdAt);
        }
      }
    });
  }

  // 2. Determinar la fase actual (la más reciente)
  const latestRecord = medicalRecords && medicalRecords.length > 0
    ? [...medicalRecords].sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt);
        const dateB = new Date(b.date || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      })[0]
    : null;
  const currentPhaseKey = latestRecord?.clinicalEvolution;
  
  const completedCount = Array.from(completedPhases.keys()).filter(key => key !== 'READMISSION').length;
  const progressPercentage = (completedCount / 6) * 100;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md border border-gray-200">
      <div className="flex items-center mb-4 sm:mb-8"></div>
      {/* Scroll lateral en móvil para ver todas las etapas */}
      <div className="overflow-x-auto overflow-y-visible pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="text-xs text-gray-500 mb-2 sm:hidden">← Desliza para ver etapas →</div>
        <div className="flex items-center justify-between relative min-w-[360px] sm:min-w-0">
        {ALL_PHASES.map((phase, index) => {
          const isCompleted = completedPhases.has(phase.key);
          const isCurrent = phase.key === currentPhaseKey;
          const isRecaida = phase.key === 'READMISSION';
          
          let statusColorClasses = 'bg-gray-200'; // Pending
          if (isRecaida && isCompleted) {
            statusColorClasses = 'bg-red-500';
          } else if (isCurrent) {
            statusColorClasses = 'bg-blue-500 ring-4 ring-blue-200';
          } else if (isCompleted) {
            statusColorClasses = 'bg-green-500';
          }

          return (
            <React.Fragment key={phase.key}>
              <div className="flex flex-col items-center z-10 min-w-[56px] sm:min-w-[72px]">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg transition-all duration-300 ${statusColorClasses}`}
                  style={{ minWidth: 40, minHeight: 40 }}>
                  {isCompleted && !isRecaida ? <CheckCircleIcon className="w-8 h-8 text-white" /> : <span className="align-middle">{index + 1}</span>}
                </div>
                <p className="text-center text-[10px] sm:text-xs mt-2 font-semibold w-14 sm:w-20 min-h-[32px] flex items-center justify-center leading-tight">{phase.label}</p>
                <div className="min-h-[18px] flex items-center justify-center">
                  {isCompleted && (
                    <p className="text-center text-xs text-gray-500 mt-1">
                      {formatDate(completedPhases.get(phase.key))}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Connecting Lines */}
              {/* {index < ALL_PHASES.length - 1 && (
                <div className="flex-1 h-1 bg-gray-200"></div>
              )} */}
            </React.Fragment>
          );
        })}
        {/* Progress Bar Background */}
        <div className="absolute top-5 left-0 w-full h-1 bg-gray-200 -translate-y-1/2 -z-0"></div>
        {/* Progress Bar Foreground */}
        <div 
          className="absolute top-5 left-0 h-1 bg-green-500 -translate-y-1/2 -z-0 transition-all duration-500"
          style={{ width: `calc(${progressPercentage}% - 5%)` }} // Adjust width to not cover the last node fully
        ></div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalEvolutionTracker; 