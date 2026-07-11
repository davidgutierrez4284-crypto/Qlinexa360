import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bars3Icon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useSelectedDoctor } from '../../context/SelectedDoctorContext';
import NotificationInbox from '../NotificationInbox';
import DoctorSelector from '../assistant/DoctorSelector';
import axios from 'axios';
import { getApiUrl } from '../../utils/api';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const { selectedDoctor } = useSelectedDoctor();
  const navigate = useNavigate();
  const [imageKey, setImageKey] = useState(0);
  const [signedProfileUrl, setSignedProfileUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  
  // Mantener referencia a la URL anterior para detectar cambios
  const prevProfilePictureUrl = useRef(null);
  const prevSignedUrl = useRef('');
  const isLoadingRef = useRef(false);

  // Obtener URL firmada para la foto de perfil (solo cuando cambia la URL)
  useEffect(() => {
    console.log('Header: useEffect ejecutado');
    console.log('Header: user?.profilePictureUrl:', user?.profilePictureUrl);
    console.log('Header: user?.role:', user?.role);
    console.log('Header: prevProfilePictureUrl.current:', prevProfilePictureUrl.current);
    
    // Si no hay URL de foto de perfil, limpiar estado
    if (!user?.profilePictureUrl) {
      console.log('Header: No hay profilePictureUrl, limpiando estado');
      setSignedProfileUrl('');
      setImageError(false);
      prevProfilePictureUrl.current = null;
      prevSignedUrl.current = '';
      isLoadingRef.current = false;
      return;
    }

    // Si la URL no ha cambiado desde la última vez, no hacer nada
    // (esto evita solicitudes duplicadas cuando el componente se re-renderiza)
    if (prevProfilePictureUrl.current === user.profilePictureUrl) {
      console.log('Header: URL no cambió, usando URL firmada existente');
      // Si ya tenemos una URL firmada guardada, usarla
      if (prevSignedUrl.current) {
        setSignedProfileUrl(prevSignedUrl.current);
      }
      return;
    }

    // Si ya estamos cargando, no hacer nada
    if (isLoadingRef.current) {
      console.log('Header: Ya estamos cargando, no hacer nada');
      return;
    }

    console.log('Header: Iniciando obtención de URL firmada para:', user.profilePictureUrl);
    const fetchSignedUrl = async () => {
      try {
        isLoadingRef.current = true;
        setImageError(false);
        
        // Actualizar la referencia ANTES de hacer la petición para evitar solicitudes duplicadas
        prevProfilePictureUrl.current = user.profilePictureUrl;
        
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('Header: No hay token');
          setSignedProfileUrl('');
          prevSignedUrl.current = '';
          isLoadingRef.current = false;
          return;
        }

        console.log('Header: Obteniendo URL firmada para:', user.profilePictureUrl);
        const res = await axios.get(getApiUrl('/api/files/signed-url'), {
          params: { url: user.profilePictureUrl },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data?.url) {
          console.log('Header: URL firmada obtenida exitosamente:', res.data.url.substring(0, 50) + '...');
          setSignedProfileUrl(res.data.url);
          prevSignedUrl.current = res.data.url;
        } else {
          console.error('Header: Respuesta del servidor no incluye URL:', res.data);
          setSignedProfileUrl('');
          prevSignedUrl.current = '';
        }
      } catch (error) {
        console.error('Header: Error obteniendo URL firmada:', error);
        // No usar URL directa de S3 como fallback: en PROD el bucket suele ser privado (403).
        // Usar avatar por defecto para evitar "Error cargando imagen de perfil".
        setSignedProfileUrl('');
        prevSignedUrl.current = '';
      } finally {
        isLoadingRef.current = false;
      }
    };

    fetchSignedUrl();
  }, [user?.profilePictureUrl]); // Solo depender de user?.profilePictureUrl

  // Resetear error cuando cambia la URL de la foto de perfil
  useEffect(() => {
    if (user?.profilePictureUrl !== prevProfilePictureUrl.current) {
      setImageError(false);
      prevProfilePictureUrl.current = user?.profilePictureUrl;
    }
  }, [user?.profilePictureUrl]);

  // Escuchar eventos personalizados para actualizar la imagen
  useEffect(() => {
    const handleUserUpdate = async (event) => {
      console.log('Header: Evento userUpdated recibido:', event.detail);
      if (event.detail?.user?.profilePictureUrl) {
        // Obtener nueva URL firmada cuando se actualiza el usuario
        try {
          const token = localStorage.getItem('token');
          if (token) {
            const res = await axios.get(getApiUrl('/api/files/signed-url'), {
              params: { url: event.detail.user.profilePictureUrl },
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.url) {
              setSignedProfileUrl(res.data.url);
            }
          }
        } catch (error) {
          console.error('Header: Error obteniendo URL firmada desde evento:', error);
        }
        
        setImageKey(prev => {
          const newKey = prev + 1;
          console.log('Header: Foto de perfil actualizada desde evento userUpdated, nuevo key:', newKey);
          return newKey;
        });
      }
    };

    const handleProfilePictureUpdate = async (event) => {
      console.log('Header: Evento profilePictureUpdated recibido:', event.detail);
      if (event.detail?.profilePictureUrl) {
        // Obtener nueva URL firmada cuando se actualiza la foto de perfil
        try {
          const token = localStorage.getItem('token');
          if (token) {
              const res = await axios.get(getApiUrl('/api/files/signed-url'), {
                params: { url: event.detail.profilePictureUrl },
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data?.url) {
              setSignedProfileUrl(res.data.url);
            }
          }
        } catch (error) {
          console.error('Header: Error obteniendo URL firmada desde evento:', error);
        }
        
        setImageKey(prev => {
          const newKey = prev + 1;
          console.log('Header: Foto de perfil actualizada desde evento profilePictureUpdated, nuevo key:', newKey);
          return newKey;
        });
      }
    };

    window.addEventListener('userUpdated', handleUserUpdate);
    window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate);

    return () => {
      window.removeEventListener('userUpdated', handleUserUpdate);
      window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Avatar por defecto: usa servicio externo para evitar 403 (default-avatar.png no existe en S3)
  const DEFAULT_AVATAR_URL = 'https://ui-avatars.com/api/?name=User&background=94a3b8&color=fff&size=128';

  // Generar URL de imagen (memoizada para evitar re-renders infinitos)
  const profilePictureUrl = React.useMemo(() => {
    if (!user?.profilePictureUrl) {
      return DEFAULT_AVATAR_URL;
    }
    // Usar solo URL firmada; la URL directa de S3 suele dar 403 en PROD (bucket privado)
    if (signedProfileUrl && (signedProfileUrl.includes('X-Amz-Algorithm') || signedProfileUrl.includes('X-Amz-Signature'))) {
      return signedProfileUrl;
    }
    // Si no hay URL firmada (aún cargando o falló), usar avatar por defecto
    return DEFAULT_AVATAR_URL;
  }, [user?.profilePictureUrl, signedProfileUrl]);

  const topBarInner = (
    <>
      {/* Izquierda: menú + logo */}
      <div className="flex items-center gap-1 sm:gap-3 min-w-0 flex-shrink-0">
        {user && (
          <button onClick={onMenuClick} className="text-white focus:outline-none p-1.5 sm:p-1 flex-shrink-0" aria-label="Menú">
            <Bars3Icon className="h-5 w-5 sm:h-7 sm:w-7" />
          </button>
        )}
        {user ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 sm:gap-2 bg-transparent border-none cursor-pointer flex-shrink-0 min-w-0"
          >
            <img src="/logo.svg" alt="Qlinexa360" className="h-6 w-6 sm:h-8 sm:w-8 flex-shrink-0" />
            <span className="text-white text-sm sm:text-xl font-semibold hidden sm:inline whitespace-nowrap">Qlinexa360</span>
          </button>
        ) : (
          <a
            href="/benefits"
            className="flex items-center gap-2 sm:gap-2.5 bg-transparent flex-shrink-0 min-w-0 hover:opacity-90 transition-opacity"
            title="Ver beneficios y tutoriales de Qlinexa360"
          >
            <img src="/logo.svg" alt="Qlinexa360" className="h-10 w-10 sm:h-8 sm:w-8 flex-shrink-0" />
            <span className="text-white text-base sm:text-xl font-semibold whitespace-nowrap">Qlinexa360</span>
          </a>
        )}
      </div>

      {/* Derecha: selector doctor (asistente) + notificaciones + usuario + logout — o acceso público */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0 flex-shrink overflow-hidden">
        {user ? (
          <>
            {user.role === 'ASISTENTE' && (
              <div className="min-w-0 flex-shrink overflow-hidden max-w-[85px] sm:max-w-[140px] md:max-w-none">
                <DoctorSelector />
              </div>
            )}
            <div className="flex-shrink-0">
              <NotificationInbox />
            </div>
            <span className="text-white font-medium hidden xl:inline truncate max-w-[160px]">
              {(() => {
                const role = user.role?.toUpperCase?.() || user.role;
                const roleLabel = role === 'DOCTOR' ? 'Profesional' : role === 'ASISTENTE' ? 'Asistente' : role === 'ADMIN' ? 'Administrador' : role === 'PATIENT' ? 'Paciente' : 'Profesional';
                return `${roleLabel} | ${user.firstName} ${user.lastName}`;
              })()}
            </span>
            <img
              key={`avatar-${imageKey}-${user.profilePictureUrl || 'default'}`}
              src={profilePictureUrl}
              alt="avatar"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
              onError={(e) => {
                if (!imageError && !e.target.src.includes('ui-avatars.com')) {
                  setImageError(true);
                  e.target.onerror = null;
                  e.target.src = DEFAULT_AVATAR_URL;
                }
              }}
            />
            <button
              onClick={handleLogout}
              className="text-white p-2 sm:px-3 sm:py-2 rounded flex-shrink-0 hover:bg-blue-700 transition-colors"
              style={{ border: 'none', cursor: 'pointer' }}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5 sm:hidden" />
              <span className="hidden sm:inline text-sm md:text-base font-medium">Cerrar sesión</span>
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => navigate('/login')} className="text-white text-xs sm:text-sm font-medium hover:underline bg-transparent border-none py-2 whitespace-nowrap">
              Iniciar sesión
            </button>
            <button type="button" onClick={() => navigate('/register')} className="text-white text-xs sm:text-sm font-medium hover:underline bg-transparent border-none py-2 whitespace-nowrap">
              Registrarse
            </button>
          </>
        )}
      </div>
    </>
  );

  const topBarBlueClass =
    'bg-blue-600 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-2 px-2 sm:px-4 md:px-6 w-full min-w-0 overflow-hidden';

  if (!user) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 shadow-md flex flex-col">
        <div className={topBarBlueClass}>{topBarInner}</div>
        <nav
          className="bg-gray-50 border-b border-gray-200 py-1.5 sm:py-2 px-3 sm:px-6 flex flex-wrap justify-end items-center gap-x-1 gap-y-0.5 text-xs sm:text-sm"
          aria-label="Aviso de privacidad y términos de uso"
        >
          <a href="/aviso-privacidad" className="text-blue-700 hover:text-blue-900 font-medium hover:underline">
            Aviso de privacidad
          </a>
          <span className="text-gray-400 select-none px-0.5" aria-hidden>
            |
          </span>
          <a href="/terminos" className="text-blue-700 hover:text-blue-900 font-medium hover:underline">
            Términos de Uso
          </a>
        </nav>
      </header>
    );
  }

  return (
    <div className={`${topBarBlueClass} shadow-md fixed top-0 left-0 right-0 z-50`}>
      {topBarInner}
    </div>
  );
};

export default Header; 