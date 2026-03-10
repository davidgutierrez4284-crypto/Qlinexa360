import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useReadOnlyMode } from '../../hooks/useReadOnlyMode';
import { useAuth } from '../../context/AuthContext';

/**
 * Componente flotante que muestra el botón "Reanudar suscripción"
 * cuando la suscripción está cancelada. Aparece en todas las páginas.
 */
const ResumeSubscriptionButton = () => {
  const navigate = useNavigate();
  const { isCancelled } = useReadOnlyMode();
  const { user } = useAuth();

  // Solo mostrar para doctores con suscripción cancelada
  if (!user || user.role !== 'DOCTOR' || !isCancelled) {
    return null;
  }

  const handleResumeClick = () => {
    navigate('/dashboard/resume-subscription');
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleResumeClick}
        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 transform hover:scale-105"
        title="Reanudar tu suscripción para recuperar todas las funcionalidades"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        Reanudar suscripción
      </button>
    </div>
  );
};

export default ResumeSubscriptionButton;

