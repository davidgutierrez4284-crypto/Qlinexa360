import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getApiUrl } from '../utils/api';
import { Dialog } from '@headlessui/react';
import { getDoctorId } from '../services/doctor.service';
import InviteAssistantModal from '../components/assistant/InviteAssistantModal';
import Loader from '../components/common/Loader';
import SmallLoader from '../components/common/SmallLoader';
import PWAInstallGuide from '../components/common/PWAInstallGuide';
import Tooltip from '../components/common/Tooltip';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSupportPhone, setShowSupportPhone] = useState(false);
  const [freeMonthUsed, setFreeMonthUsed] = useState(false);
  const [isCheckingFreeMonth, setIsCheckingFreeMonth] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [signedProfileUrl, setSignedProfileUrl] = useState('');
  const prevProfilePictureUrlRef = useRef(null);
  const isLoadingSignedUrlRef = useRef(false);

  // Estados para gestión de asistentes
  const [assistantSearch, setAssistantSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [linkedAssistants, setLinkedAssistants] = useState([]);
  const [permissions, setPermissions] = useState({
    appointments: false,
    clinicalHistory: false,
    prescriptions: false,
    notes: false,
    studies: false,
    visualEvolution: false,
    billing: false
  });
  const [isInviteAssistantModalOpen, setIsInviteAssistantModalOpen] = useState(false);
  const [doctorId, setDoctorId] = useState(null);

  // Obtener doctorId al cargar el componente
  useEffect(() => {
    const fetchDoctorId = async () => {
      try {
        const id = await getDoctorId();
        setDoctorId(id);
      } catch (error) {
        console.error('Error al obtener doctor ID:', error);
      }
    };
    fetchDoctorId();
  }, []);

  // Cargar detalles de la suscripción
  useEffect(() => {
    const loadSubscriptionDetails = async () => {
      if (user?.role !== 'DOCTOR') return;
      
      try {
        setLoadingSubscription(true);
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/subscriptions/details', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.data) {
          setSubscriptionDetails(response.data);
          setFreeMonthUsed(response.data.freeMonthUsed || false);
        }
      } catch (error) {
        console.error('Error cargando detalles de suscripción:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };

    loadSubscriptionDetails();
  }, [user]);

  // Buscar asistentes
  const searchAssistants = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      setIsSearching(true);
      console.log('Buscando asistentes con query:', query);
      
      const response = await axios.get(`/api/assistants/search`, {
        params: { q: query },
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      console.log('Respuesta de búsqueda:', response.data);
      
      if (Array.isArray(response.data)) {
        setSearchResults(response.data);
        setShowSearchResults(response.data.length > 0);
      } else {
        console.error('Respuesta no es un array:', response.data);
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (error) {
      console.error('Error buscando asistentes:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Error al buscar asistentes';
      toast.error(errorMessage);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Cargar asistentes vinculados
  const loadLinkedAssistants = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/assistants/linked', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setLinkedAssistants(response.data);
    } catch (error) {
      console.error('Error cargando asistentes vinculados:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Error al cargar asistentes vinculados';
      toast.error(errorMessage);
    }
  };

  // Vincular asistente
  const linkAssistant = async () => {
    if (!selectedAssistant) {
      toast.error('Debes seleccionar un asistente');
      return;
    }

    const hasAnyPermission = Object.values(permissions).some(p => p);
    if (!hasAnyPermission) {
      toast.error('Debes seleccionar al menos un módulo');
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      await axios.post('/api/assistants/link', {
        assistantId: selectedAssistant.id,
        permissions
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      toast.success('Asistente vinculado correctamente');
      setSelectedAssistant(null);
      setAssistantSearch('');
      setPermissions({
        appointments: false,
        clinicalHistory: false,
        prescriptions: false,
        notes: false,
        studies: false,
        visualEvolution: false,
        billing: false
      });
      loadLinkedAssistants();
    } catch (error) {
      console.error('Error vinculando asistente:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Error al vincular asistente';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Revocar acceso de asistente
  const revokeAssistantAccess = async (assistantId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/assistants/revoke/${assistantId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Acceso del asistente revocado');
      loadLinkedAssistants();
    } catch (error) {
      console.error('Error revocando acceso:', error);
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          'Error al revocar acceso';
      toast.error(errorMessage);
    }
  };

  // Efecto para búsqueda con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchAssistants(assistantSearch);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [assistantSearch]);

  // Cargar asistentes vinculados al montar (solo para doctores)
  useEffect(() => {
    if (user?.role === 'DOCTOR') {
      loadLinkedAssistants();
    }
  }, [user?.role]);

  // Obtener URL firmada para la foto de perfil (similar al Header)
  useEffect(() => {
    // Si no hay URL de foto de perfil, limpiar estado
    if (!user?.profilePictureUrl) {
      setSignedProfileUrl('');
      prevProfilePictureUrlRef.current = null;
      isLoadingSignedUrlRef.current = false;
      return;
    }

    // Si la URL no ha cambiado desde la última vez, no hacer nada
    if (prevProfilePictureUrlRef.current === user.profilePictureUrl) {
      return;
    }

    // Si ya estamos cargando, no hacer nada
    if (isLoadingSignedUrlRef.current) {
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        isLoadingSignedUrlRef.current = true;
        
        // Actualizar la referencia antes de hacer la petición para evitar solicitudes duplicadas
        prevProfilePictureUrlRef.current = user.profilePictureUrl;
        
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('Profile: No hay token');
          setSignedProfileUrl('');
          isLoadingSignedUrlRef.current = false;
          return;
        }

        console.log('Profile: Obteniendo URL firmada para:', user.profilePictureUrl);
        const res = await axios.get(getApiUrl('/api/files/signed-url'), {
          params: { url: user.profilePictureUrl },
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data?.url) {
          console.log('Profile: URL firmada obtenida exitosamente');
          setSignedProfileUrl(res.data.url);
        } else {
          console.error('Profile: Respuesta del servidor no incluye URL:', res.data);
          setSignedProfileUrl('');
        }
      } catch (error) {
        console.error('Profile: Error obteniendo URL firmada:', error);
        // No usar URL directa de S3: en PROD el bucket suele ser privado (403)
        setSignedProfileUrl('');
      } finally {
        isLoadingSignedUrlRef.current = false;
      }
    };

    fetchSignedUrl();
  }, [user?.profilePictureUrl]);

  // Escuchar eventos personalizados para actualizar la URL firmada cuando se actualiza la foto
  useEffect(() => {
    const handleProfilePictureUpdate = async (event) => {
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
              prevProfilePictureUrlRef.current = event.detail.profilePictureUrl;
            }
          }
        } catch (error) {
          console.error('Profile: Error obteniendo URL firmada desde evento:', error);
        }
      }
    };

    const handleUserUpdate = async (event) => {
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
              prevProfilePictureUrlRef.current = event.detail.user.profilePictureUrl;
            }
          }
        } catch (error) {
          console.error('Profile: Error obteniendo URL firmada desde evento userUpdated:', error);
        }
      }
    };

    window.addEventListener('profilePictureUpdated', handleProfilePictureUpdate);
    window.addEventListener('userUpdated', handleUserUpdate);

    return () => {
      window.removeEventListener('profilePictureUpdated', handleProfilePictureUpdate);
      window.removeEventListener('userUpdated', handleUserUpdate);
    };
  }, []);

  // Obtener la URL de imagen a mostrar: preview de archivo seleccionado o URL firmada del usuario
  // Memoizada para evitar recálculos innecesarios y re-renders infinitos
  const profileImageUrl = useMemo(() => {
    // Si hay un archivo seleccionado con preview, usar la preview
    if (profilePictureFile && profilePicturePreview) {
      return profilePicturePreview;
    }
    // Usar solo URL firmada; la URL directa de S3 suele dar 403 en PROD
    if (user?.profilePictureUrl && signedProfileUrl && (signedProfileUrl.includes('X-Amz-Algorithm') || signedProfileUrl.includes('X-Amz-Signature'))) {
      return signedProfileUrl;
    }
    return 'https://ui-avatars.com/api/?name=User&background=94a3b8&color=fff&size=128';
  }, [profilePictureFile, profilePicturePreview, user?.profilePictureUrl, signedProfileUrl]);

  const handleCancelSubscription = async () => {
    if (!cancelReason) {
      toast.error('Por favor selecciona una razón para cancelar');
      return;
    }

    if (cancelReason === 'other' && !otherReason.trim()) {
      toast.error('Por favor especifica la razón de cancelación');
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/subscriptions/cancel', {
        reason: cancelReason === 'other' ? otherReason : cancelReason
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        if (response.data.paypalCancelSucceeded === false) {
          toast.warning(
            'Tu suscripción está cancelada en Qlinexa360. Si PayPal sigue mostrando un cobro pendiente, cancélalo desde tu cuenta de PayPal o contacta a soporte.',
            { autoClose: 8000 }
          );
        } else {
          toast.success('Tu suscripción ha sido cancelada correctamente. Puedes seguir consultando tus expedientes por hasta 5 años.');
        }
        setIsCancelModalOpen(false);
        setCancelReason('');
        setOtherReason('');
        // Recargar detalles de la suscripción para actualizar el estado
        const detailsResponse = await axios.get('/api/subscriptions/details', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (detailsResponse.data) {
          setSubscriptionDetails(detailsResponse.data);
        }
      }
    } catch (error) {
      console.error('Error al cancelar suscripción:', error);
      const errorMessage = error.response?.data?.message || 'Error al cancelar la suscripción. Por favor, intenta de nuevo.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupport = () => {
    setShowSupportPhone(true);
  };

  const handleResumeSubscription = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/subscriptions/resume', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        toast.success('Tu suscripción ha sido reanudada exitosamente. Los cargos mensuales se realizarán normalmente.');
        // Recargar detalles de la suscripción para actualizar el estado
        const detailsResponse = await axios.get('/api/subscriptions/details', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (detailsResponse.data) {
          setSubscriptionDetails(detailsResponse.data);
        }
      }
    } catch (error) {
      console.error('Error al reanudar suscripción:', error);
      const errorMessage = error.response?.data?.message || 'Error al reanudar la suscripción. Por favor, intenta de nuevo.';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImprovePlan = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/subscriptions/extend-free-month', {}, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        toast.success('¡Te hemos otorgado 1 mes adicional gratis!');
        setFreeMonthUsed(true);
        setIsCancelModalOpen(false);
        // Recargar detalles de la suscripción
        const token = localStorage.getItem('token');
        const detailsResponse = await axios.get('/api/subscriptions/details', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (detailsResponse.data) {
          setSubscriptionDetails(detailsResponse.data);
        }
      }
    } catch (error) {
      console.error('Error al extender suscripción:', error);
      if (error.response?.status === 400 && error.response?.data?.freeMonthUsed) {
        toast.error('Ya has utilizado tu mes gratis. Por favor, contacta con soporte para más opciones.');
        setFreeMonthUsed(true);
      } else {
        toast.error('Error al extender la suscripción. Por favor, intenta de nuevo.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar selección de foto de perfil
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG y WEBP');
        return;
      }

      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error('El archivo es demasiado grande. Máximo 5MB');
        return;
      }

      setProfilePictureFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicturePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Subir foto de perfil
  const handleUploadProfilePicture = async () => {
    if (!profilePictureFile) {
      toast.error('Por favor selecciona una imagen');
      return;
    }

    try {
      setIsUploadingPicture(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('profilePicture', profilePictureFile);

      const response = await fetch(getApiUrl('/api/auth/profile-picture'), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
          // NO incluir Content-Type aquí, el navegador lo establecerá automáticamente con el boundary
        },
        body: formData
      });

      // Leer la respuesta como texto primero para poder intentar parsearla como JSON
      const responseText = await response.text();
      
      if (!response.ok) {
        // Intentar parsear como JSON para obtener el mensaje de error
        try {
          const errorData = JSON.parse(responseText);
          throw new Error(errorData.message || 'Error al actualizar la foto de perfil');
        } catch (parseError) {
          // Si no es JSON, usar el texto de la respuesta o un mensaje genérico
          console.error('Error response (no JSON):', responseText);
          throw new Error(responseText || `Error ${response.status}: ${response.statusText}`);
        }
      }

      // Parsear la respuesta exitosa como JSON
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Respuesta del servidor:', data);
      } catch (parseError) {
        console.error('Error parsing success response:', parseError);
        console.error('Response text:', responseText);
        throw new Error('Error al procesar la respuesta del servidor');
      }
      
      // Verificar que la respuesta tenga profilePictureUrl
      if (!data.profilePictureUrl) {
        console.error('La respuesta no incluye profilePictureUrl:', data);
        throw new Error('La respuesta del servidor no incluye la URL de la foto');
      }
      
      console.log('Actualizando usuario con nueva foto:', data.profilePictureUrl);
      
      // Actualizar el usuario en el contexto
      if (updateUser) {
        const updatedUser = { ...user, profilePictureUrl: data.profilePictureUrl };
        console.log('Usuario actualizado en contexto:', updatedUser);
        updateUser(updatedUser);
      }
      
      // Actualizar localStorage
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      storedUser.profilePictureUrl = data.profilePictureUrl;
      localStorage.setItem('user', JSON.stringify(storedUser));
      console.log('Usuario actualizado en localStorage');

      // Disparar evento personalizado para notificar a otros componentes
      window.dispatchEvent(new CustomEvent('profilePictureUpdated', {
        detail: { profilePictureUrl: data.profilePictureUrl }
      }));
      
      // También disparar evento storage (aunque normalmente solo funciona entre pestañas)
      window.dispatchEvent(new Event('storage'));

      toast.success('Foto de perfil actualizada exitosamente');
      
      // Limpiar estados de preview ya que ahora usaremos user?.profilePictureUrl
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
      
      // Limpiar el input file
      const fileInput = document.getElementById('profilePictureInput');
      if (fileInput) {
        fileInput.value = '';
      }
      
      // La imagen se actualizará automáticamente porque user?.profilePictureUrl 
      // ya fue actualizado en el contexto y localStorage
    } catch (error) {
      console.error('Error al actualizar foto de perfil:', error);
      toast.error(error.message || 'Error al actualizar la foto de perfil');
    } finally {
      setIsUploadingPicture(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          {/* Sección de Información Personal */}
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Información Personal
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              Gestiona tu información personal y datos de la cuenta
            </p>

            {/* Foto de perfil */}
            <div className="mt-6 border-t border-gray-200 pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Foto de perfil
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <img
                    key={`profile-img-${user?.profilePictureUrl || 'default'}-${profilePictureFile ? 'preview' : 'saved'}`}
                    src={profileImageUrl}
                    alt="Foto de perfil"
                    className="h-20 w-20 rounded-full object-cover border-2 border-gray-300"
                    onError={(e) => {
                      const currentSrc = e.target.src || '';
                      const isDefaultAvatar = currentSrc.includes('ui-avatars.com');
                      if (!isDefaultAvatar) {
                        console.error('Error cargando imagen de perfil:', currentSrc);
                        e.target.onerror = null;
                        e.target.src = 'https://ui-avatars.com/api/?name=User&background=94a3b8&color=fff&size=128';
                      } else {
                        e.target.onerror = null;
                      }
                    }}
                    onLoad={(e) => {
                      // Si la imagen carga exitosamente, verificar que no necesitamos resetear nada
                      // Esto ayuda a asegurar que la imagen se muestre correctamente
                    }}
                  />
                </div>
                <div className="flex-1">
                  <input
                    id="profilePictureInput"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleProfilePictureChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    JPG, PNG o WEBP. Máximo 5MB
                  </p>
                  {profilePictureFile && (
                    <button
                      onClick={handleUploadProfilePicture}
                      disabled={isUploadingPicture}
                      className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {isUploadingPicture ? 'Subiendo...' : 'Guardar foto'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

                {/* Sección de Suscripción - Solo para doctores */}
        {user && user.role === 'DOCTOR' && (
          <div id="subscription-section" className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Suscripción y Facturación
                </h3>
                 
                 <div className="mt-5 border-t border-gray-200 pt-5">
                   <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                     <div className="flex-1">
                       <div className="mb-3">
                         <p className="text-sm text-gray-500">
                           Estado actual: {subscriptionDetails?.status === 'CANCELLED' ? (
                             <span className="text-red-600 font-medium">Cancelada</span>
                           ) : (
                             <span className="text-green-600 font-medium">Activa</span>
                           )}
                         </p>
                         {subscriptionDetails?.status !== 'CANCELLED' && (
                           <p className="text-xs text-gray-400 mt-1">
                             Todos los cargos son mensuales consecutivos a través de PayPal
                           </p>
                         )}
                       </div>
                       {loadingSubscription ? (
                         <p className="text-sm text-gray-500">Cargando información de suscripción...</p>
                       ) : subscriptionDetails ? (
                         subscriptionDetails.status === 'CANCELLED' ? (
                           <div className="bg-red-50 border border-red-200 rounded-md p-4">
                             <p className="text-sm font-medium text-red-800">
                               Tu suscripción ha sido cancelada. No se realizarán más cargos.
                             </p>
                             <p className="text-xs text-red-600 mt-2">
                               Puedes seguir consultando tus expedientes clínicos por hasta 5 años conforme a la NOM-004-SSA3-2012.
                             </p>
                           </div>
                         ) : (
                           <div className="space-y-2">
                             {subscriptionDetails.freeMonthUsed && subscriptionDetails.freeMonthEndDate ? (
                               <>
                                 <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                   <p className="text-sm font-medium text-gray-700">
                                     Próximo cargo: <span className="text-green-700">{new Date(subscriptionDetails.freeMonthEndDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                   </p>
                                   <p className="text-xs text-green-600 font-medium mt-1">
                                     Gratuito para que permanezcas en Qlinexa360
                                   </p>
                                 </div>
                                 <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                                   <p className="text-sm font-medium text-gray-700">
                                     Siguiente cargo: <span className="text-gray-900">{new Date(subscriptionDetails.nextChargeDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                   </p>
                                   <p className="text-xs text-gray-500 mt-1">
                                     Cargo mensual a través de PayPal
                                   </p>
                                 </div>
                               </>
                             ) : (
                               <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                                 <p className="text-sm font-medium text-gray-700">
                                   Próximo cargo: <span className="text-gray-900">{new Date(subscriptionDetails.nextChargeDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                 </p>
                                 <p className="text-xs text-gray-500 mt-1">
                                   Cargo mensual a través de PayPal
                                 </p>
                               </div>
                             )}
                           </div>
                         )
                       ) : (
                         <p className="text-sm text-gray-500">
                           Próximo cargo: No disponible
                         </p>
                       )}
                     </div>
                     <div className="flex-shrink-0">
                       {subscriptionDetails?.status === 'CANCELLED' ? (
                         <button
                           onClick={handleResumeSubscription}
                           disabled={isLoading}
                           className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                           </svg>
                           {isLoading ? 'Reanudando...' : 'Reanudar suscripción'}
                         </button>
                       ) : (
                         <button
                           onClick={async () => {
                             setIsCancelModalOpen(true);
                             // Verificar si ya se usó el mes gratis
                             try {
                               setIsCheckingFreeMonth(true);
                               const token = localStorage.getItem('token');
                               const response = await axios.get('/api/subscriptions/check-free-month', {
                                 headers: {
                                   'Authorization': `Bearer ${token}`
                                 }
                               });
                               if (response.data) {
                                 setFreeMonthUsed(response.data.freeMonthUsed || false);
                               }
                             } catch (error) {
                               console.error('Error verificando mes gratis:', error);
                               // En caso de error, asumir que no se ha usado
                               setFreeMonthUsed(false);
                             } finally {
                               setIsCheckingFreeMonth(false);
                             }
                           }}
                           className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                         >
                           <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                           </svg>
                           Cancelar suscripción
                         </button>
                       )}
                     </div>
                   </div>
                   {subscriptionDetails?.status !== 'CANCELLED' && (
                     <p className="mt-2 text-sm text-gray-500">
                       Puedes cancelar tu suscripción en cualquier momento. Los expedientes clínicos que hayas creado permanecerán accesibles por 5 años conforme a la NOM-004-SSA3-2012.
                     </p>
                   )}
                 </div>
               </div>
             </div>
           </div>
        )}

        {/* Sección de Gestión de Asistentes - Solo para doctores */}
        {user && user.role === 'DOCTOR' && (
          <div className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center gap-2">
                    💼 Habilitar asistente del personal de la salud
                    <Tooltip
                      text="Si tienes una persona que te ayude con tareas administrativas como generar citas, relacionar facturas, etc la puedes invitar para que tenga un usuario gratuito de la plataforma"
                      placement="top"
                    >
                      <InformationCircleIcon className="h-5 w-5 text-gray-400 cursor-help shrink-0" />
                    </Tooltip>
                  </h3>
                  <button
                    onClick={() => setIsInviteAssistantModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Invitar Asistente
                  </button>
                </div>
              
              <div className="space-y-6">
                {/* Buscador de Asistentes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Buscar asistente por nombre o correo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={assistantSearch}
                      onChange={(e) => setAssistantSearch(e.target.value)}
                      placeholder="Escribe el nombre o correo del asistente..."
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-2">
                        <SmallLoader size="sm" />
                      </div>
                    )}
                  </div>

                  {/* Resultados de búsqueda */}
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-md bg-white shadow-lg max-h-60 overflow-y-auto">
                      {searchResults.map((assistant) => (
                        <div
                          key={assistant.id}
                          onClick={() => {
                            setSelectedAssistant(assistant);
                            setShowSearchResults(false);
                            setAssistantSearch(`${assistant.name} ${assistant.lastName} (${assistant.email})`);
                          }}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {assistant.name} {assistant.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{assistant.email}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Permisos por módulo */}
                {selectedAssistant && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">
                      Permisos para {selectedAssistant.name} {selectedAssistant.lastName}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'appointments', label: 'Calendario (editar - agendar)' },
                        { key: 'clinicalHistory', label: 'Historial Clínico (solo lectura)' },
                        { key: 'prescriptions', label: 'Recetas (solo lectura y reenvío)' },
                        { key: 'notes', label: 'Notas (solo lectura)' },
                        { key: 'studies', label: 'Zona de Estudio (edición)' },
                        { key: 'visualEvolution', label: 'Evolución Visual (solo lectura)' },
                        { key: 'billing', label: 'Facturación (edición)' }
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={permissions[key]}
                            onChange={(e) => setPermissions(prev => ({
                              ...prev,
                              [key]: e.target.checked
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">
                      Los permisos de tipo "solo lectura" únicamente se habilitan al profesional de la salud con licencia de paga de la plataforma Qlinexa360.
                    </p>
                    
                    <div className="mt-6">
                      <button
                        onClick={linkAssistant}
                        disabled={isLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        {isLoading ? 'Vinculando...' : 'Guardar configuración'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Asistentes vinculados */}
                {linkedAssistants.length > 0 && (
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-md font-medium text-gray-900 mb-4">
                      Asistentes vinculados
                    </h4>
                    <div className="space-y-3">
                      {linkedAssistants.map((assistant) => (
                        <div key={assistant.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                          <div>
                            <div className="font-medium text-gray-900">
                              {assistant.name} {assistant.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{assistant.email}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              Vinculado desde: {new Date(assistant.assignmentDate).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Módulos: {assistant.permissions.join(', ')}
                            </div>
                          </div>
                          <button
                            onClick={() => revokeAssistantAccess(assistant.id)}
                            className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Revocar acceso
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Sección de Instalación PWA */}
        <div className="mt-8">
          <PWAInstallGuide />
        </div>

        {/* Modal de Cancelación - Solo para doctores */}
        {user && user.role === 'DOCTOR' && (
          <Dialog
            open={isCancelModalOpen}
            onClose={() => {
              setIsCancelModalOpen(false);
              setShowSupportPhone(false);
              setFreeMonthUsed(false);
            }}
            className="fixed inset-0 z-10 overflow-y-auto"
          >
          <div className="flex items-center justify-center min-h-screen">
            <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

            <div className="relative bg-white rounded-lg max-w-md w-full mx-4 p-6">
              <Dialog.Title className="text-lg font-medium text-gray-900 mb-4">
                ¿Estás seguro que deseas cancelar tu suscripción?
              </Dialog.Title>

              <div className="mt-4">
                <p className="text-sm text-gray-500 mb-4">
                  Perderás acceso a todas las funcionalidades de Qlinexa360, pero podrás consultar tus expedientes por hasta 5 años, conforme a la normativa mexicana.
                </p>

                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    ¿Podemos ayudarte? Antes de cancelar, dinos por qué te vas:
                  </p>
                  <div className="space-y-2">
                    {['Precio alto', 'No encontré valor', 'No me funciona bien', 'Solo estaba probando', 'Otro'].map((reason) => (
                      <label key={reason} className="flex items-center">
                        <input
                          type="radio"
                          name="cancelReason"
                          value={reason}
                          checked={cancelReason === reason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">{reason}</span>
                      </label>
                    ))}
                  </div>

                  {cancelReason === 'Otro' && (
                    <input
                      type="text"
                      value={otherReason}
                      onChange={(e) => setOtherReason(e.target.value)}
                      placeholder="Por favor, especifica"
                      className="mt-2 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  )}
                </div>

                {showSupportPhone && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      Soporte Qlinexa360
                    </p>
                    <p className="text-lg font-semibold text-blue-700">
                      (+52) 55-2727-4125
                    </p>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={handleSupport}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none focus:2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Hablar con soporte
                  </button>
                  <button
                    onClick={handleImprovePlan}
                    disabled={freeMonthUsed || isLoading}
                    className={`inline-flex justify-center px-4 py-2 text-sm font-medium rounded-md border border-transparent focus:outline-none focus:2 focus:ring-offset-2 ${
                      freeMonthUsed
                        ? 'text-gray-500 bg-gray-100 cursor-not-allowed'
                        : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
                    }`}
                  >
                    {freeMonthUsed ? 'Mes gratis ya utilizado' : 'Mejorar mi plan'}
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={isLoading}
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    {isLoading ? 'Cancelando...' : 'Continuar con cancelación'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Dialog>
        )}

        {/* Modal para invitar asistente */}
        {isInviteAssistantModalOpen && (
          <InviteAssistantModal
            isOpen={isInviteAssistantModalOpen}
            onClose={() => setIsInviteAssistantModalOpen(false)}
            doctorId={doctorId}
          />
        )}
      </div>
    </div>
  );
};

export default Profile;
