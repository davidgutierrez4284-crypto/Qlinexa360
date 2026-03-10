import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl } from '../utils/api';
import ConsentForm from '../components/consent/ConsentForm';

const ActivateAssistantInvitation = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentToken, setConsentToken] = useState(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [consentForm, setConsentForm] = useState({
    acceptPrivacy: false,
    acceptTerms: false,
    acceptContract: false,
    signature: ''
  });
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState('');

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      setLoading(true);
      const response = await axios.get(getApiUrl(`/api/assistant-invitations/validate/${token}`));
      setInvitation(response.data.invitation);
    } catch (error) {
      console.error('Error validating token:', error);
      toast.error(error.response?.data?.error || 'Error validando la invitación');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      setSubmitting(true);
      const response = await axios.post(getApiUrl('/api/assistant-invitations/complete'), {
        token,
        password: formData.password
      });

      toast.success('Registro completado exitosamente');
      if (response.data.requiresConsent && response.data.consentToken) {
        setConsentToken(response.data.consentToken);
        setShowConsent(true);
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Error completing registration:', error);
      toast.error(error.response?.data?.error || 'Error completando el registro');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsentSubmit = async () => {
    setConsentError('');
    setConsentLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/consent/submit-assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consentToken,
          acceptPrivacy: consentForm.acceptPrivacy,
          acceptTerms: consentForm.acceptTerms,
          acceptContract: consentForm.acceptContract,
          signature: consentForm.signature.trim()
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Consentimientos registrados exitosamente');
        navigate('/login');
      } else {
        setConsentError(data.error || 'Error al registrar consentimientos');
      }
    } catch (error) {
      console.error('Error:', error);
      setConsentError('Error de conexión. Por favor intenta de nuevo.');
    } finally {
      setConsentLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Validando invitación...
          </h2>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  if (showConsent) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600">Qlinexa360</h1>
            <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900">
              Consentimientos Legales
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Hola <strong>{invitation.firstName} {invitation.lastName}</strong>,
              por favor completa la firma de los documentos legales para continuar.
            </p>
          </div>
          <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <ConsentForm
              form={consentForm}
              onChange={setConsentForm}
              onSubmit={handleConsentSubmit}
              isLoading={consentLoading}
              error={consentError}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600">Qlinexa360</h1>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Completar Registro de Asistente
          </h2>
        </div>

        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* Información de la invitación */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-medium text-blue-900 mb-2">
              Invitación de Asistente
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Nombre:</strong> {invitation.firstName} {invitation.lastName}</p>
              <p><strong>Email:</strong> {invitation.email}</p>
              <p><strong>Profesional:</strong> {invitation.doctorName}</p>
              <p><strong>Expira:</strong> {new Date(invitation.expiresAt).toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Ingresa tu contraseña"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Confirma tu contraseña"
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Información Importante
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      Como asistente, tendrás acceso a las secciones que el doctor te habilite 
                      para apoyar en las tareas administrativas. Todas tus acciones quedarán 
                      registradas con tu nombre y usuario.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Completando registro...' : 'Completar Registro'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Al completar el registro, aceptas los términos y condiciones de Qlinexa360
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivateAssistantInvitation;
