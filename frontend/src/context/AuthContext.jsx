import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as loginService, setupTwoFactor as setupTwoFactorService, verifyTwoFactor as verifyTwoFactorService, sendTwoFactorRecoveryEmail as sendTwoFactorRecoveryEmailService, verifyTwoFactorRecovery as verifyTwoFactorRecoveryService } from '../api/auth';
import { getApiUrl } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Comprobar si hay un token en localStorage al cargar la app
    const token = localStorage.getItem('token');
    if (token) {
      // Obtener datos actualizados del usuario desde el backend
      // Esto asegura que profilePictureUrl y otros datos estén actualizados
      const fetchCurrentUser = async () => {
        try {
          const response = await fetch(getApiUrl('/api/auth/me'), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              console.log('AuthContext: Usuario cargado desde /api/auth/me:', data.user);
              setUser(data.user);
              localStorage.setItem('user', JSON.stringify(data.user));
              setIsAuthenticated(true);
              // Disparar evento para notificar a otros componentes (como Header)
              window.dispatchEvent(new CustomEvent('userUpdated', {
                detail: { user: data.user }
              }));
            } else {
              // Si no hay datos de usuario, usar los del localStorage como fallback
              const storedUser = localStorage.getItem('user');
              if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setIsAuthenticated(true);
              }
            }
          } else {
            // Si el token es inválido, limpiar localStorage
            if (response.status === 401) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            } else {
              // Para otros errores, usar los datos del localStorage como fallback
              const storedUser = localStorage.getItem('user');
              if (storedUser) {
                setUser(JSON.parse(storedUser));
                setIsAuthenticated(true);
              }
            }
          }
        } catch (error) {
          console.error('Error obteniendo datos del usuario:', error);
          // En caso de error, usar los datos del localStorage como fallback
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsAuthenticated(true);
          }
        } finally {
          setLoading(false);
        }
      };

      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const stored = localStorage.getItem('trustedDevice');
      let trustedDeviceToken = null;
      if (stored) {
        try {
          const { email: storedEmail, token } = JSON.parse(stored);
          if (storedEmail?.toLowerCase() === email?.toLowerCase()) trustedDeviceToken = token;
        } catch {}
      }
      const data = await loginService(email, password, trustedDeviceToken);
      if (data?.requiresTwoFactor) {
        localStorage.setItem('twoFactorTempToken', data.tempToken);
        return data;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('twoFactorTempToken');
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      // Limpiar estado en caso de error
      logout();
      throw error;
    }
  };

  const setupTwoFactor = async (tempToken) => {
    return setupTwoFactorService(tempToken);
  };

  const verifyTwoFactor = async (tempToken, code, rememberDevice = false, email) => {
    const data = await verifyTwoFactorService(tempToken, code, rememberDevice);
    if (data?.token && data?.user) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('twoFactorTempToken');
      if (data.trustedDeviceToken && email) {
        localStorage.setItem('trustedDevice', JSON.stringify({ email: email.toLowerCase(), token: data.trustedDeviceToken }));
      }
      setUser(data.user);
      setIsAuthenticated(true);
    }
    return data;
  };

  const sendTwoFactorRecoveryEmail = async (tempToken) => {
    return sendTwoFactorRecoveryEmailService(tempToken);
  };

  const verifyTwoFactorRecovery = async (tempToken, code) => {
    const data = await verifyTwoFactorRecoveryService(tempToken, code);
    if (data?.tempToken) {
      localStorage.setItem('twoFactorTempToken', data.tempToken);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('twoFactorTempToken');
    setUser(null);
    setIsAuthenticated(false);
    // No borrar trustedDevice: el usuario puede querer seguir confiando en este dispositivo
  };

  const updateUser = (updatedUser) => {
    console.log('AuthContext: updateUser llamado con:', updatedUser);
    // Crear un nuevo objeto para forzar re-render en React
    const newUser = { ...updatedUser };
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
    console.log('AuthContext: Usuario actualizado en contexto y localStorage');
    
    // Disparar evento personalizado para notificar a otros componentes
    window.dispatchEvent(new CustomEvent('userUpdated', {
      detail: { user: newUser }
    }));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, updateUser, setupTwoFactor, verifyTwoFactor, sendTwoFactorRecoveryEmail, verifyTwoFactorRecovery }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 