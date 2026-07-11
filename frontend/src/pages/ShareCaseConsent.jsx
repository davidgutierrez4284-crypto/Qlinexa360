import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getApiUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

/** Solo el paciente debe firmar; el enlace no debe usarse con sesión de profesional (DOCTOR paga la plataforma, no el paciente). */
const isProfessionalSession = (role) =>
  role === 'DOCTOR' || role === 'ASISTENTE' || role === 'ADMIN';

const ShareCaseConsent = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signature, setSignature] = useState('');
  const [signing, setSigning] = useState(false);

  const returnToLoginPath = `/login?returnUrl=${encodeURIComponent(`/compartir-caso-clinico/${token}`)}`;

  useEffect(() => {
    const run = async () => {
      try {
        const response = await axios.get(getApiUrl(`/api/case-share-invite/${token}`));
        setInfo(response.data);
      } catch (error) {
        const msg =
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Enlace no válido o expirado';
        setInfo({ error: msg, status: error.response?.status });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [token]);

  const handleLogoutAndSignAsPatient = () => {
    logout();
    toast.info('Sesión cerrada. Inicia con tu cuenta de paciente para firmar.');
    navigate(returnToLoginPath, { replace: true });
  };

  const handleSign = async (e) => {
    e.preventDefault();
    if (!signature.trim() || signature.trim().length < 3) {
      toast.error('Ingresa tu nombre completo (mínimo 3 caracteres)');
      return;
    }
    setSigning(true);
    try {
      const response = await axios.post(
        getApiUrl(`/api/case-share-invite/${token}/sign`),
        { signature: signature.trim() },
        { headers: { 'Content-Type': 'application/json' } }
      );
      if (response.data?.success) {
        toast.success(response.data.message || 'Consentimiento registrado');
        if (isAuthenticated && user?.role === 'PATIENT') {
          navigate('/dashboard/medical-records', { replace: true });
        } else {
          setInfo((prev) => ({
            ...prev,
            alreadyCompleted: true,
            message: response.data.message
          }));
        }
      } else {
        throw new Error(response.data?.message || 'Error al firmar');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Error al firmar');
    } finally {
      setSigning(false);
    }
  };

  const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  /** Sesión de profesional u otro rol: este flujo es exclusivo del paciente */
  if (isAuthenticated && user && isProfessionalSession(user.role)) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-lg w-full border border-amber-200">
          <ExclamationTriangleIcon className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 text-center mb-2">
            Este enlace es para el <span className="text-blue-600">paciente</span>
          </h1>
          <p className="text-sm text-gray-600 mb-4 text-center">
            Estás conectado como <strong>profesional de la salud o personal administrativo</strong>. El consentimiento lo debe firmar el{' '}
            <strong>paciente (titular)</strong> con su propia cuenta. En Qlinexa360, la suscripción aplica al profesional, no al paciente.
          </p>
          {info?.success && info?.caseLabel && (
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md mb-4">
              <strong>Caso en solicitud:</strong> {info.caseLabel}
            </p>
          )}
          <p className="text-sm text-gray-600 mb-4">
            Recomendación: pide al paciente que abra este mismo enlace desde su correo, o usa <strong>ventana de incógnito</strong> / otro
            navegador. Si tú compartes equipo con el paciente, primero cierra tu sesión.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLogoutAndSignAsPatient}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
              Cerrar sesión e ir a inicio de sesión (paciente)
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/dashboard', { replace: true })}
              className="w-full border border-gray-300 py-3 rounded-md text-gray-800 hover:bg-gray-50"
            >
              Volver a mi panel de profesional
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (info?.error && !info?.success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No se puede continuar</h1>
          <p className="text-gray-600 mb-6">{info.error}</p>
          <a
            href={baseUrl}
            className="inline-block w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 font-medium text-center"
          >
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  if (info?.alreadyCompleted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Listo</h1>
          <p className="text-gray-600 mb-6">
            {info.message || 'Este consentimiento ya fue firmado previamente.'}
          </p>
          {isAuthenticated && user?.role === 'PATIENT' ? (
            <Link
              to="/dashboard/medical-records"
              className="inline-block bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700"
            >
              Ir a mi historial clínico
            </Link>
          ) : (
            <a
              href={baseUrl}
              className="inline-block bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700"
            >
              Ir al inicio
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        <div className="flex items-center gap-2 mb-2">
          <DocumentTextIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Colaboración en caso clínico</h1>
        </div>
        <p className="text-sm text-gray-500 mb-2">Qlinexa360</p>
        <p className="text-xs text-gray-500 mb-4">
          Firma al calce con tu <strong>nombre completo</strong> (igual que en teleconsulta). No hace falta crear cuenta para firmar: el enlace del correo es tu autorización.
        </p>
        {info && (
          <ul className="text-sm text-gray-700 space-y-2 mb-6 bg-slate-50 p-4 rounded-md">
            <li>
              <strong>Caso:</strong> {info.caseLabel}
            </li>
            <li>
              <strong>Médico que solicita:</strong> {info.ownerDoctorName}
            </li>
            <li>
              <strong>Profesional invitado:</strong> {info.invitedDoctorName}
            </li>
            {info.expiresAt && (
              <li className="text-amber-800">
                <strong>Vigencia del enlace:</strong>{' '}
                {new Date(info.expiresAt).toLocaleString('es-MX')}
              </li>
            )}
          </ul>
        )}
        <p className="text-sm text-gray-600 mb-4">
          Al firmar, el paciente autoriza que el profesional invitado acceda <strong>solo a este caso clínico</strong>, conforme al Aviso de
          Privacidad y Términos de la plataforma. Después de firmar, el invitado podrá colaborar en dicho expediente.
        </p>
        <form onSubmit={handleSign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Firma (escribe tu nombre completo)
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              placeholder="Nombre y apellidos"
              minLength={3}
            />
          </div>
          <button
            type="submit"
            disabled={signing || signature.trim().length < 3}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {signing ? 'Enviando…' : 'Firmar consentimiento'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ShareCaseConsent;
