import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const SubscriptionContext = createContext();

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription debe ser usado dentro de un SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const [subscriptionStatus, setSubscriptionStatus] = useState('checking');
  const [loading, setLoading] = useState(true);

  const checkSubscriptionStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSubscriptionStatus('inactive');
      setLoading(false);
      return;
    }
    // Paciente / asistente: sin plan de pago; el backend devuelve ACTIVE, pero evitamos llamada
    // y estados "EXPIRED" raros mientras /auth/me aún no hidrata el rol en contexto
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.role === 'PATIENT' || u?.role === 'ASISTENTE') {
          setSubscriptionStatus('ACTIVE');
          setLoading(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    try {
      const response = await axios.get('/api/subscriptions/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptionStatus(response.data.status || 'inactive');
    } catch (error) {
      console.error('Error al verificar estado de suscripción:', error);
      if (error.response && [401, 403].includes(error.response.status)) {
        localStorage.removeItem('token');
      }
      setSubscriptionStatus('inactive');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubscriptionStatus();

    // Re-checar cuando cambie el usuario/sesión
    const handleUserUpdated = () => {
      // Reiniciar loading para evitar parpadeos inconsistentes
      setLoading(true);
      checkSubscriptionStatus();
    };

    // Re-checar cuando cambie el storage (p.ej., logout/login en esta u otra pestaña)
    const handleStorage = (e) => {
      if (e && e.key && e.key !== 'token') return;
      setLoading(true);
      checkSubscriptionStatus();
    };

    window.addEventListener('userUpdated', handleUserUpdated);
    window.addEventListener('storage', handleStorage);

    // Re-chequeo periódico de seguridad (cada 60s)
    const intervalId = setInterval(() => {
      checkSubscriptionStatus();
    }, 60000);

    return () => {
      window.removeEventListener('userUpdated', handleUserUpdated);
      window.removeEventListener('storage', handleStorage);
      clearInterval(intervalId);
    };
  }, []);

  const updateSubscriptionStatus = (status) => {
    setSubscriptionStatus(status);
  };

  const isExpired = subscriptionStatus === 'EXPIRED';
  const isCancelled = subscriptionStatus === 'CANCELLED';
  const isReadOnly = isExpired || isCancelled;

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        loading,
        isExpired,
        isCancelled,
        isReadOnly,
        updateSubscriptionStatus,
        checkSubscriptionStatus
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext; 