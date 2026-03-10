import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';

/**
 * Hook para verificar si la aplicación está en modo solo lectura
 * debido a una suscripción cancelada o expirada
 */
export const useReadOnlyMode = () => {
  const { isReadOnly, isCancelled, isExpired } = useSubscription();
  const { user } = useAuth();

  // Solo aplicar modo solo lectura a doctores
  const readOnly = user?.role === 'DOCTOR' && isReadOnly;

  return {
    isReadOnly: readOnly,
    isCancelled: user?.role === 'DOCTOR' && isCancelled,
    isExpired: user?.role === 'DOCTOR' && isExpired,
    message: readOnly 
      ? (isCancelled 
          ? 'Tu suscripción está cancelada. Solo puedes consultar información.'
          : 'Tu suscripción está vencida. Solo puedes consultar información.')
      : null
  };
};

