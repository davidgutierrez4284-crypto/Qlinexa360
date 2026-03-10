import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';

const SubscriptionBanner = () => {
  const navigate = useNavigate();
  const { isExpired, isCancelled, isReadOnly, loading } = useSubscription();
  const { user } = useAuth();

  // Solo mostrar para doctores
  if (!user || user.role !== 'DOCTOR' || loading) return null;

  if (isCancelled) {
    return (
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-3 z-50 shadow-lg">
        <div className="container mx-auto flex justify-center items-center">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm md:text-base font-medium">
              <strong>MODO SOLO LECTURA:</strong> Tu suscripción está cancelada. Solo puedes consultar información. No puedes añadir, modificar ni eliminar ningún dato.
            </p>
            <button
              onClick={() => navigate('/dashboard/profile')}
              className="ml-4 bg-white text-red-600 px-4 py-2 rounded-md font-semibold hover:bg-red-50 transition-colors text-sm"
            >
              Reanudar suscripción
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isExpired) {
    const handleRenewSubscription = () => {
      navigate('/pago');
    };

    return (
      <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-4 z-50 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex-1">
            <p className="text-sm md:text-base">
              Para continuar con la edición del historial clínico y la incorporación de nuevos pacientes debes de renovar tu suscripción
            </p>
          </div>
          <button
            onClick={handleRenewSubscription}
            className="ml-4 bg-white text-red-600 px-4 py-2 rounded-md font-semibold hover:bg-red-50 transition-colors"
          >
            Renovar suscripción
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default SubscriptionBanner; 