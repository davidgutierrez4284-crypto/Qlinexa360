import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { getApiUrl, getApiHeaders } from '../../utils/api';

const MP_DISCLAIMER =
  'Al conectar Mercado Pago autorizas a Qlinexa360 a crear preferencias de cobro en tu nombre. ' +
  'Los fondos de las consultas se acreditan en tu cuenta de Mercado Pago. Qlinexa360 puede retener una comisión de plataforma según los términos vigentes. ' +
  'Qlinexa360 no es responsable de disputas de pago entre tú y tus pacientes.';

const TELECONSULT_DISCLAIMER =
  'Si activas el cobro obligatorio antes de la videollamada, el paciente deberá pagar para recibir el enlace Meet/Teams. ' +
  'Define claramente tu política de reembolsos.';

export default function MercadoPagoSettings({ compact = false }) {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ connected: false, status: 'disconnected' });
  const [settings, setSettings] = useState({
    enabled: false,
    mandatoryBeforeVirtualLink: false,
    amount: 0,
    currency: 'MXN',
    refundPolicyText: '',
    autoCancelOnPaymentRejected: false,
    inPersonEnabled: false,
    inPersonDefaultAmount: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(getApiUrl('/api/payments/mercadopago/status'), {
        headers: getApiHeaders(),
      });
      if (res.data?.success) {
        setStatus(res.data);
        if (res.data.teleconsultationSettings) {
          setSettings(res.data.teleconsultationSettings);
        }
      }
    } catch (e) {
      toast.error('No se pudo cargar el estado de Mercado Pago');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mp') === 'connected') {
      toast.success('Mercado Pago conectado correctamente');
      window.history.replaceState({}, '', window.location.pathname);
      load();
    } else if (params.get('mp') === 'error') {
      toast.error('No se pudo conectar Mercado Pago');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [load]);

  const handleConnect = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Sesión expirada. Inicia sesión de nuevo.');
      return;
    }
    setConnecting(true);
    try {
      const res = await axios.get(getApiUrl('/api/payments/mercadopago/connect-url'), {
        headers: getApiHeaders(),
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
        return;
      }
      toast.error('No se pudo iniciar la conexión con Mercado Pago');
    } catch {
      window.location.href = `${getApiUrl('/api/payments/mercadopago/connect')}?token=${encodeURIComponent(token)}`;
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('¿Desconectar Mercado Pago? Los cobros pendientes no se procesarán automáticamente.')) return;
    try {
      await axios.post(getApiUrl('/api/payments/mercadopago/disconnect'), {}, { headers: getApiHeaders() });
      toast.success('Mercado Pago desconectado');
      load();
    } catch {
      toast.error('Error al desconectar');
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await axios.put(
        getApiUrl('/api/payments/mercadopago/teleconsultation-settings'),
        settings,
        { headers: getApiHeaders() }
      );
      if (res.data?.success) {
        setSettings(res.data.settings);
        toast.success('Configuración guardada');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Cargando Mercado Pago…</p>;
  }

  return (
    <div className={compact ? 'space-y-4' : 'mt-8 bg-white shadow rounded-lg px-4 py-5 sm:p-6'}>
      {!compact && (
        <>
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <BanknotesIcon className="h-6 w-6 text-sky-600" />
            Cobros · Mercado Pago
          </h3>
          <p className="text-sm text-gray-500 mt-1">Conecta tu cuenta para cobrar consultas a pacientes.</p>
        </>
      )}

      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
        {MP_DISCLAIMER}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {status.connected ? (
          <>
            <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
              <CheckCircleIcon className="h-4 w-4" /> Conectado
            </span>
            <button
              type="button"
              onClick={handleDisconnect}
              className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
            >
              <TrashIcon className="h-4 w-4" /> Desconectar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-md hover:bg-sky-700 disabled:opacity-60"
          >
            <LinkIcon className="h-4 w-4" /> {connecting ? 'Redirigiendo…' : 'Conectar Mercado Pago'}
          </button>
        )}
      </div>

      {status.connected && (
        <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
          <h4 className="text-sm font-semibold text-gray-800">Cobro de teleconsulta</h4>
          <p className="text-xs text-gray-500">{TELECONSULT_DISCLAIMER}</p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            />
            Activar cobros Mercado Pago en teleconsultas
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.mandatoryBeforeVirtualLink}
              disabled={!settings.enabled}
              onChange={(e) =>
                setSettings((s) => ({ ...s, mandatoryBeforeVirtualLink: e.target.checked }))
              }
            />
            Cobro obligatorio antes de generar enlace de videollamada
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Monto sugerido (MXN)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={!settings.enabled}
                value={settings.amount}
                onChange={(e) => setSettings((s) => ({ ...s, amount: parseFloat(e.target.value) || 0 }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Valor inicial al crear teleconsultas; el monto final se define en cada cita.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Política de reembolso</label>
              <textarea
                rows={2}
                disabled={!settings.enabled}
                value={settings.refundPolicyText || ''}
                onChange={(e) => setSettings((s) => ({ ...s, refundPolicyText: e.target.value }))}
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="Ej. Reembolso hasta 24 h antes de la cita"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.autoCancelOnPaymentRejected}
              disabled={!settings.enabled}
              onChange={(e) =>
                setSettings((s) => ({ ...s, autoCancelOnPaymentRejected: e.target.checked }))
              }
            />
            Cancelar cita si el pago es rechazado
          </label>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar configuración teleconsulta'}
          </button>

          <div className="border-t border-gray-200 pt-4 mt-6 space-y-4">
            <h4 className="text-sm font-semibold text-gray-800">Cobro opcional · consultas presenciales</h4>
            <p className="text-xs text-gray-500">
              Si lo activas, al crear citas presenciales podrás ofrecer un enlace de pago con Mercado Pago. El paciente
              siempre puede pagar en efectivo o fuera de la plataforma.
            </p>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.inPersonEnabled}
                onChange={(e) => setSettings((s) => ({ ...s, inPersonEnabled: e.target.checked }))}
              />
              Permitir cobro opcional con Mercado Pago en consultas presenciales
            </label>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Monto sugerido presencial (MXN)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={!settings.inPersonEnabled}
                value={settings.inPersonDefaultAmount}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    inPersonDefaultAmount: parseFloat(e.target.value) || 0,
                  }))
                }
                className="w-full border rounded-md px-3 py-2 text-sm max-w-xs"
              />
            </div>

            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar configuración presencial'}
            </button>
          </div>
        </div>
      )}

      {!status.connected && (
        <p className="text-xs text-gray-500 flex items-start gap-1">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-amber-500" />
          Sin conexión activa, la plataforma funciona igual; no se aplican cobros a pacientes.
        </p>
      )}
    </div>
  );
}
