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
import { InformationCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { isReferralsFeatureEnabled } from '../config/featureFlags';
import MercadoPagoSettings from '../components/payments/MercadoPagoSettings';

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
  const [referralInfo, setReferralInfo] = useState(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [isReferralEmailModalOpen, setIsReferralEmailModalOpen] = useState(false);
  const [referralInviteeEmail, setReferralInviteeEmail] = useState('');
  const [referralEmailSending, setReferralEmailSending] = useState(false);
  const [referralTab, setReferralTab] = useState('code');
  const [referralHistory, setReferralHistory] = useState(null);
  const [referralHistoryLoading, setReferralHistoryLoading] = useState(false);
  const [referralLoadError, setReferralLoadError] = useState(null);

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

  // Programa de referidos: código y enlace (solo doctores; build prod lo omite salvo VITE_ENABLE_REFERRALS=true)
  useEffect(() => {
    if (!isReferralsFeatureEnabled() || user?.role !== 'DOCTOR') {
      setReferralInfo(null);
      return;
    }
    const loadReferral = async () => {
      try {
        setReferralLoading(true);
        setReferralLoadError(null);
        const token = localStorage.getItem('token');
        const res = await axios.get(getApiUrl('/api/referrals/me'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReferralInfo(res.data);
      } catch (e) {
        console.error('Error cargando referidos:', e);
        setReferralInfo(null);
        const msg =
          e.response?.data?.message ||
          (e.code === 'ERR_NETWORK'
            ? 'Sin conexión al backend (¿API en http://localhost:3000 y servidor backend en marcha?).'
            : 'No se pudo cargar el código de invitación.');
        setReferralLoadError(msg);
      } finally {
        setReferralLoading(false);
      }
    };
    loadReferral();
  }, [user?.role, user?.id]);

  useEffect(() => {
    if (!isReferralsFeatureEnabled() || user?.role !== 'DOCTOR' || referralTab !== 'history') return;
    const loadHistory = async () => {
      try {
        setReferralHistoryLoading(true);
        const token = localStorage.getItem('token');
        const res = await axios.get(getApiUrl('/api/referrals/history'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReferralHistory(res.data);
      } catch (e) {
        console.error('Error historial referidos:', e);
        toast.error('No se pudo cargar el historial de referidos');
        setReferralHistory({ items: [], milestones: [] });
      } finally {
        setReferralHistoryLoading(false);
      }
    };
    loadHistory();
  }, [referralTab, user?.role]);

  const buildReferralShareText = () => {
    if (!referralInfo?.registerUrl || !referralInfo?.referralCode) return '';
    return `Te invito a Qlinexa360 (plataforma para profesionales de la salud).

Con mi código obtienes 1 mes adicional gratis al activar tu suscripción, más los días de bienvenida de la plataforma (y puedes combinarlo con un código promocional si aplica). Yo acumulo crédito Qlinexa360 del 20% por cada colega con suscripción activa; al juntar 100% recibo 1 mes gratis automático en PayPal.

Tu código: ${referralInfo.referralCode}

Registro:
${referralInfo.registerUrl}

Condiciones: https://www.qlinexa360.com`;
  };

  const sendReferralInviteEmailRequest = async () => {
    const to = referralInviteeEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error('Introduce un correo electrónico válido');
      return;
    }
    try {
      setReferralEmailSending(true);
      const token = localStorage.getItem('token');
      await axios.post(
        getApiUrl('/api/referrals/send-invite-email'),
        { to },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Invitación enviada por correo');
      setIsReferralEmailModalOpen(false);
      setReferralInviteeEmail('');
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo enviar el correo');
    } finally {
      setReferralEmailSending(false);
    }
  };

  // Cargar detalles de la suscripción (y al volver de reanudar suscripción / promo)
  useEffect(() => {
    const loadSubscriptionDetails = async () => {
      if (user?.role !== 'DOCTOR') return;

      try {
        setLoadingSubscription(true);
        const token = localStorage.getItem('token');
        const response = await axios.get(getApiUrl('/api/subscriptions/details'), {
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
        const st = error.response?.status;
        const msg = error.response?.data?.message || error.response?.data?.error;
        if (st === 404) {
          setSubscriptionDetails({
            status: 'NO_SUBSCRIPTION',
            isLifetime: false,
            hint:
              msg ||
              'No hay fila de suscripción en la base de datos para este doctor. En pruebas suele faltar si el usuario se creó sin pasar por el registro con PayPal.',
          });
        } else {
          setSubscriptionDetails({
            status: 'SUBSCRIPTION_LOAD_ERROR',
            isLifetime: false,
            hint: msg || error.message || 'Error al consultar la suscripción',
          });
        }
      } finally {
        setLoadingSubscription(false);
      }
    };

    loadSubscriptionDetails();
    const onSubscriptionMaybeChanged = () => loadSubscriptionDetails();
    window.addEventListener('userUpdated', onSubscriptionMaybeChanged);
    return () => window.removeEventListener('userUpdated', onSubscriptionMaybeChanged);
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
        const detailsResponse = await axios.get(getApiUrl('/api/subscriptions/details'), {
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
        const detailsResponse = await axios.get(getApiUrl('/api/subscriptions/details'), {
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
        const detailsResponse = await axios.get(getApiUrl('/api/subscriptions/details'), {
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

        {user && user.role === 'DOCTOR' && isReferralsFeatureEnabled() && (
          <div id="referral-section" className="mt-8">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Programa de referidos
                </h3>
                <div className="mt-4 flex gap-1 border-b border-gray-200" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={referralTab === 'code'}
                    onClick={() => setReferralTab('code')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md ${
                      referralTab === 'code'
                        ? 'border-blue-600 text-blue-700 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Código referidos
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={referralTab === 'history'}
                    onClick={() => setReferralTab('history')}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors rounded-t-md ${
                      referralTab === 'history'
                        ? 'border-blue-600 text-blue-700 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Historial de referidos
                  </button>
                </div>

                {referralTab === 'code' && (
                  <>
                    <p className="mt-4 text-sm text-gray-500">
                      Comparte código o enlace con otro profesional de la salud.
                    </p>
                    <ul className="mt-2 text-sm text-gray-600 list-disc pl-5 space-y-1.5">
                      <li>
                        <span className="font-medium text-gray-800">Tú:</span> <strong>+20%</strong> por colega con pago
                        calificado (PayPal recurrente o lifetime). <strong>5</strong> = <strong>100%</strong> ={' '}
                        <strong>1 mes gratis</strong> en PayPal; lo que pase de 100% suma al mes siguiente.
                      </li>
                      <li>
                        <span className="font-medium text-gray-800">Tu colega:</span> <strong>+1 mes</strong> y{' '}
                        <strong>+15 días</strong> al registrarse; acumulable con promo vigente.
                      </li>
                    </ul>
                    {referralLoading && (
                      <p className="mt-4 text-sm text-gray-500">Cargando tu código de invitación…</p>
                    )}
                    {!referralLoading && referralInfo && (
                      <div className="mt-5 border-t border-gray-200 pt-5 space-y-4">
                        <div>
                          <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                            Tu código
                          </span>
                          <p className="mt-1 font-mono text-lg font-semibold text-blue-900 tracking-wider">
                            {referralInfo.referralCode}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(buildReferralShareText())}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                          >
                            Compartir por WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() => setIsReferralEmailModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-slate-700 hover:bg-slate-800"
                          >
                            <EnvelopeIcon className="h-5 w-5 shrink-0" aria-hidden />
                            Enviar invitación por correo
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 break-all">
                          <span className="font-medium text-gray-600">Enlace:</span> {referralInfo.registerUrl}
                        </p>
                        {(typeof referralInfo.referralCreditPercent === 'number' &&
                          referralInfo.referralCreditPercent > 0) ||
                        (typeof referralInfo.qualifiedReferralsCount === 'number' &&
                          referralInfo.qualifiedReferralsCount > 0) ||
                        (typeof referralInfo.referralFreeMonthsGranted === 'number' &&
                          referralInfo.referralFreeMonthsGranted > 0) ? (
                          <div className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-md px-3 py-2 space-y-1">
                            <p>
                              <span className="font-medium">Crédito</span> (100%):{' '}
                              <strong>{referralInfo.referralCreditPercent ?? 0}%</strong> · +20% por acreditación.
                            </p>
                            {typeof referralInfo.qualifiedReferralsCount === 'number' && (
                              <p>
                                Acreditados: <strong>{referralInfo.qualifiedReferralsCount}</strong>
                              </p>
                            )}
                            {typeof referralInfo.referralFreeMonthsGranted === 'number' &&
                              referralInfo.referralFreeMonthsGranted > 0 && (
                                <p>
                                  Meses gratis (programa):{' '}
                                  <strong>{referralInfo.referralFreeMonthsGranted}</strong>
                                  {referralInfo.referralBenefitPeriodHint ? (
                                    <span className="block text-xs font-normal text-emerald-900/90 mt-1 leading-snug">
                                      {referralInfo.referralBenefitPeriodHint}
                                    </span>
                                  ) : null}
                                </p>
                              )}
                            {typeof referralInfo.referralsNeededApproxForNextMonth === 'number' &&
                              referralInfo.referralsNeededApproxForNextMonth > 0 && (
                                <p className="text-xs text-emerald-900 leading-snug">
                                  Faltan <strong>{referralInfo.referralsNeededApproxForNextMonth}</strong>{' '}
                                  {referralInfo.referralsNeededApproxForNextMonth === 1
                                    ? 'acreditación'
                                    : 'acreditaciones'}{' '}
                                  (+20% c/u) para el <strong>próximo mes sin cargo</strong>.
                                </p>
                              )}
                          </div>
                        ) : null}
                      </div>
                    )}
                    {!referralLoading && !referralInfo && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-amber-700">
                          No se pudo cargar el código de invitación. Intenta actualizar la página o contacta a soporte.
                        </p>
                        {referralLoadError && (
                          <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded px-2 py-1.5">
                            {referralLoadError}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {referralTab === 'history' && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 mb-3">
                      Por fecha de alta (reciente primero). <strong>Pendiente</strong>: sin +20% aún.{' '}
                      <strong>Acreditado</strong>: +20% al saldo. <strong>5</strong> = 100% = 1 mes sin cargo (PayPal).
                    </p>
                    {!referralHistoryLoading && referralHistory?.summary && (
                      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                        <p className="font-semibold text-slate-900 mb-1.5">Resumen</p>
                        <ul className="list-disc pl-5 space-y-1 text-slate-700">
                          <li>
                            Acreditados: <strong>{referralHistory.summary.qualifiedReferrals}</strong>
                          </li>
                          <li>
                            Saldo: <strong>{referralHistory.summary.creditBalancePercent}%</strong> (
                            {referralHistory.summary.creditPercentPerReferral}%/ref. ·{' '}
                            {referralHistory.summary.creditsPerFreeMonth}% = 1 mes)
                          </li>
                          <li>
                            Meses gratis aplicados: <strong>{referralHistory.summary.freeMonthsGrantedAuto}</strong>
                          </li>
                        </ul>
                      </div>
                    )}
                    {!referralHistoryLoading &&
                      referralHistory?.milestones &&
                      referralHistory.milestones.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {referralHistory.milestones.map((m) => (
                            <div
                              key={m.freeMonthIndex}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
                            >
                              <p className="font-semibold">
                                Mes sin cargo por estos <strong>{m.referrers.length}</strong> referidos acreditados.
                              </p>
                              <p className="mt-1 text-emerald-900/95">
                                100% alcanzado en: <strong className="text-emerald-950">{m.awardedMonthLabel}</strong>
                              </p>
                              {m.freeMonthIndex > 1 && (
                                <p className="mt-1 text-xs text-emerald-800">
                                  Beneficio #{m.freeMonthIndex} del programa.
                                </p>
                              )}
                              <ul className="mt-2 list-disc pl-5 text-emerald-900">
                                {m.referrers.map((r, idx) => (
                                  <li key={`${m.freeMonthIndex}-${idx}`}>
                                    {r.displayName}{' '}
                                    <span className="text-emerald-800/90">({r.emailMasked})</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    {referralHistoryLoading && (
                      <p className="text-sm text-gray-500">Cargando historial…</p>
                    )}
                    {!referralHistoryLoading &&
                      referralHistory?.items &&
                      referralHistory.items.length === 0 && (
                        <p className="text-sm text-gray-600">Aún no hay colegas registrados con tu código.</p>
                      )}
                    {!referralHistoryLoading &&
                      referralHistory?.items &&
                      referralHistory.items.length > 0 && (
                        <div className="overflow-x-auto -mx-1">
                          <table className="min-w-full text-sm text-left">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-200">
                                <th className="pr-3 py-2 font-medium">Colega</th>
                                <th className="pr-3 py-2 font-medium whitespace-nowrap">Alta</th>
                                <th className="pr-3 py-2 font-medium">Suscripción</th>
                                <th className="pr-3 py-2 font-medium whitespace-nowrap">Crédito</th>
                                <th className="py-2 font-medium min-w-[9rem]">Nota</th>
                              </tr>
                            </thead>
                            <tbody>
                              {referralHistory.items.map((it) => (
                                <tr key={it.referredDoctorId} className="border-b border-gray-100 align-top">
                                  <td className="py-2 pr-3">
                                    <div className="font-medium text-gray-900">{it.displayName}</div>
                                    <div className="text-xs text-gray-500">{it.emailMasked}</div>
                                  </td>
                                  <td className="py-2 pr-3 whitespace-nowrap text-gray-700">
                                    {new Date(it.registeredAt).toLocaleDateString('es-MX', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-700">{it.subscriptionStatus || '—'}</td>
                                  <td className="py-2 pr-3">
                                    {it.discountStatus === 'credited' ? (
                                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                                        Acreditado (+{it.percentGranted ?? 20}% crédito)
                                      </span>
                                    ) : (
                                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                        Pendiente
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 text-gray-600 text-xs sm:text-sm">{it.billingCycleHint}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {user && user.role === 'DOCTOR' && <MercadoPagoSettings />}

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
                           Estado actual:{' '}
                           {subscriptionDetails?.status === 'NO_SUBSCRIPTION' ? (
                             <span className="text-gray-600 font-medium">Sin suscripción en base de datos</span>
                           ) : subscriptionDetails?.status === 'SUBSCRIPTION_LOAD_ERROR' ? (
                             <span className="text-amber-700 font-medium">No se pudieron cargar los datos</span>
                           ) : subscriptionDetails?.status === 'CANCELLED' ? (
                             <span className="text-red-600 font-medium">Cancelada</span>
                           ) : subscriptionDetails?.status === 'EXPIRED' ? (
                             <span className="text-amber-700 font-medium">Vencida (renovación requerida)</span>
                           ) : (
                             <span className="text-green-600 font-medium">Activa</span>
                           )}
                         </p>
                         {subscriptionDetails?.status === 'ACTIVE' && subscriptionDetails?.isLifetime && (
                           <p className="text-xs text-gray-400 mt-1">
                             Acceso de por vida con código promocional — sin cargos recurrentes por PayPal
                           </p>
                         )}
                         {subscriptionDetails?.status === 'ACTIVE' && !subscriptionDetails?.isLifetime && (
                           <p className="text-xs text-gray-400 mt-1">
                             Cargo mensual recurrente vía PayPal
                           </p>
                         )}
                         {subscriptionDetails?.status === 'ACTIVE' &&
                           !subscriptionDetails?.isLifetime &&
                           subscriptionDetails?.scheduledBenefitPauseActive && (
                             <p className="text-xs text-emerald-800 mt-1 font-medium">
                               Periodo de beneficio (mes gratis / referidos): sin cargo en PayPal hasta la fecha de
                               reanudación. Después vuelve el cobro normal ({subscriptionDetails.standardMonthlyPriceLabel}
                               ).
                             </p>
                           )}
                         {subscriptionDetails?.paypalPaymentIssueSuspected &&
                           subscriptionDetails?.status === 'ACTIVE' &&
                           !subscriptionDetails?.isLifetime && (
                             <p className="text-xs text-amber-700 mt-1 font-medium">
                               PayPal indica la suscripción como suspendida (p. ej. problema con el método de pago).
                               Actualiza el pago en PayPal para evitar interrupciones.
                             </p>
                           )}
                       </div>
                       {loadingSubscription ? (
                         <p className="text-sm text-gray-500">Cargando información de suscripción...</p>
                       ) : subscriptionDetails ? (
                         subscriptionDetails.status === 'NO_SUBSCRIPTION' ? (
                           <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-2">
                             <p className="text-sm text-gray-800">
                               No hay registro de suscripción para tu perfil de doctor. Por eso no se muestran fechas de
                               facturación ni próximo cargo.
                             </p>
                             <p className="text-xs text-gray-600">{subscriptionDetails.hint}</p>
                             <button
                               type="button"
                               onClick={() => navigate('/dashboard/resume-subscription')}
                               className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                             >
                               Ir a suscripción / pago
                             </button>
                           </div>
                         ) : subscriptionDetails.status === 'SUBSCRIPTION_LOAD_ERROR' ? (
                           <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                             <p className="text-sm text-amber-900 font-medium">No se pudo obtener la información de suscripción.</p>
                             <p className="text-xs text-amber-800 mt-1">{subscriptionDetails.hint}</p>
                           </div>
                         ) : subscriptionDetails.status === 'CANCELLED' ? (
                           <div className="bg-red-50 border border-red-200 rounded-md p-4">
                             <p className="text-sm font-medium text-red-800">
                               Tu suscripción ha sido cancelada. No se realizarán más cargos.
                             </p>
                             <p className="text-xs text-red-600 mt-2">
                               Puedes seguir consultando tus expedientes clínicos por hasta 5 años conforme a la NOM-004-SSA3-2012.
                             </p>
                           </div>
                         ) : subscriptionDetails.status === 'EXPIRED' ? (
                           <div className="space-y-3">
                             <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                               <p className="text-sm font-medium text-amber-900">
                                 Según el registro de tu suscripción, el periodo actual ya venció. Por eso la barra superior
                                 pide renovar, y el acceso de edición se limita hasta completar un nuevo pago.
                               </p>
                               <p className="text-xs text-amber-800 mt-2">
                                 Si acabas de pagar en PayPal, puede tardar unos minutos en reflejarse, o hace falta
                                 alinear el periodo con PayPal. Si crees que es un error, contacta soporte con tu email de
                                 cuenta.
                               </p>
                             </div>
                             <button
                               type="button"
                               onClick={() => navigate('/dashboard/resume-subscription')}
                               className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700"
                             >
                               Ir a pagar / renovar
                             </button>
                           </div>
                         ) : subscriptionDetails.isLifetime ? (
                           <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 space-y-2">
                             <p className="text-sm font-medium text-emerald-900">
                               Tu acceso está activo con un <strong>código de por vida</strong>. No hay fechas de
                               &quot;próximo cargo&quot; en PayPal porque no aplica suscripción recurrente.
                             </p>
                             <p className="text-xs text-emerald-800">
                               Vigencia registrada en la plataforma hasta el{' '}
                               {subscriptionDetails.endDate
                                 ? new Date(subscriptionDetails.endDate).toLocaleDateString('es-ES', {
                                     day: 'numeric',
                                     month: 'long',
                                     year: 'numeric'
                                   })
                                 : '—'}
                               .
                             </p>
                           </div>
                         ) : (
                           <div className="space-y-2">
                             {subscriptionDetails.freeMonthUsed && subscriptionDetails.freeMonthEndDate ? (
                               <>
                                 <div className="bg-green-50 border border-green-200 rounded-md p-3">
                                   <p className="text-sm font-medium text-gray-700">
                                     Sin cargo en la app hasta:{' '}
                                     <span className="text-green-700">
                                       {new Date(subscriptionDetails.freeMonthEndDate).toLocaleDateString('es-ES', {
                                         day: 'numeric',
                                         month: 'long',
                                         year: 'numeric',
                                       })}
                                     </span>
                                   </p>
                                   <p className="text-xs text-green-600 font-medium mt-1">
                                     Periodo gratuito o beneficio registrado en Qlinexa360 (no es el extracto de PayPal).
                                   </p>
                                 </div>
                                 <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                                   <p className="text-sm text-gray-800">
                                     <span className="font-medium">Próximo cargo</span>
                                     {subscriptionDetails.nextChargeSource === 'paypal'
                                       ? ' (PayPal)'
                                       : ' (estimada)'}
                                     :{' '}
                                     <span className="font-semibold text-gray-900">
                                       {new Date(subscriptionDetails.nextChargeDate).toLocaleDateString('es-ES', {
                                         day: 'numeric',
                                         month: 'long',
                                         year: 'numeric',
                                       })}
                                     </span>
                                   </p>
                                   <p className="text-xs text-gray-500 mt-1">
                                     {subscriptionDetails.nextChargeSource === 'paypal'
                                       ? 'Mensual vía PayPal; fecha según tu cuenta.'
                                       : 'Mensual vía PayPal; fecha estimada en la app.'}
                                   </p>
                                   <p className="text-sm text-gray-800 mt-2">
                                     <span className="font-medium">Importe en ese cobro:</span>{' '}
                                     <span className="font-semibold text-gray-900">
                                       {subscriptionDetails.nextBillingPeriodAmountLabel ||
                                         subscriptionDetails.standardMonthlyPriceLabel ||
                                         '$499 MXN/mes IVA incluido'}
                                     </span>
                                   </p>
                                 </div>
                               </>
                             ) : (
                               <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                                 <p className="text-sm text-gray-800">
                                   <span className="font-medium">Próximo cargo</span>
                                   {subscriptionDetails.nextChargeSource === 'paypal'
                                     ? ' (PayPal)'
                                     : ' (estimada)'}
                                   :{' '}
                                   <span className="font-semibold text-gray-900">
                                     {new Date(subscriptionDetails.nextChargeDate).toLocaleDateString('es-ES', {
                                       day: 'numeric',
                                       month: 'long',
                                       year: 'numeric',
                                     })}
                                   </span>
                                 </p>
                                 <p className="text-xs text-gray-500 mt-1">
                                   {subscriptionDetails.nextChargeSource === 'paypal'
                                     ? 'Mensual vía PayPal; fecha según tu cuenta.'
                                     : 'Mensual vía PayPal; fecha estimada en la app.'}
                                 </p>
                                 <p className="text-sm text-gray-800 mt-2">
                                   <span className="font-medium">Importe en ese cobro:</span>{' '}
                                   <span className="font-semibold text-gray-900">
                                     {subscriptionDetails.nextBillingPeriodAmountLabel ||
                                       subscriptionDetails.standardMonthlyPriceLabel ||
                                       '$499 MXN/mes IVA incluido'}
                                   </span>
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
                       ) : subscriptionDetails?.status === 'NO_SUBSCRIPTION' ||
                         subscriptionDetails?.status === 'SUBSCRIPTION_LOAD_ERROR' ? null : subscriptionDetails?.status === 'EXPIRED' ? (
                         <button
                           type="button"
                           onClick={() => navigate('/dashboard/resume-subscription')}
                           className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                         >
                           Renovar suscripción
                         </button>
                       ) : subscriptionDetails?.isLifetime ? null : (
                         <button
                           onClick={async () => {
                             setIsCancelModalOpen(true);
                             // Verificar si ya se usó el mes gratis
                             try {
                               setIsCheckingFreeMonth(true);
                               const token = localStorage.getItem('token');
                               const response = await axios.get(getApiUrl('/api/subscriptions/check-free-month'), {
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
                   {subscriptionDetails?.status === 'ACTIVE' && !subscriptionDetails?.isLifetime && (
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

        {isReferralsFeatureEnabled() && isReferralEmailModalOpen && (
          <Dialog
            open={isReferralEmailModalOpen}
            onClose={() => {
              if (!referralEmailSending) {
                setIsReferralEmailModalOpen(false);
                setReferralInviteeEmail('');
              }
            }}
            className="fixed inset-0 z-20 overflow-y-auto"
          >
            <div className="flex items-center justify-center min-h-screen px-4">
              <Dialog.Overlay className="fixed inset-0 bg-black/40" />
              <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <Dialog.Title className="text-lg font-semibold text-gray-900">
                  Enviar invitación por correo
                </Dialog.Title>
                <p className="mt-2 text-sm text-gray-600">
                  Tu colega recibirá un correo con diseño profesional de Qlinexa360: beneficios del programa, tu código y
                  un botón para registrarse.
                </p>
                <label htmlFor="referral-invitee-email" className="mt-4 block text-sm font-medium text-gray-700">
                  Correo del colega
                </label>
                <input
                  id="referral-invitee-email"
                  type="email"
                  autoComplete="email"
                  value={referralInviteeEmail}
                  onChange={(e) => setReferralInviteeEmail(e.target.value)}
                  placeholder="colega@ejemplo.com"
                  disabled={referralEmailSending}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={referralEmailSending}
                    onClick={() => {
                      setIsReferralEmailModalOpen(false);
                      setReferralInviteeEmail('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={referralEmailSending}
                    onClick={sendReferralInviteEmailRequest}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {referralEmailSending ? 'Enviando…' : 'Enviar'}
                  </button>
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
