import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { BanknotesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getApiUrl, getApiHeaders } from '../../utils/api';

const IN_PERSON_DISCLAIMER =
  'El cobro se realiza directamente entre paciente y profesional vía Mercado Pago. Qlinexa360 facilita el enlace de pago y puede retener comisión de plataforma. No sustituye facturación CFDI.';

export default function InPersonPaymentModal({ appointment, onClose }) {
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('Consulta presencial');
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState(null);

  if (!appointment) return null;

  const patientId = appointment.patientId || appointment.extendedProps?.patientId;
  const patientName = appointment.patientName || appointment.title || 'Paciente';

  const handleCreate = async () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(
        getApiUrl('/api/payments/mercadopago/preferences/in-person'),
        {
          appointmentId: appointment.id,
          patientId,
          amount: value,
          concept,
        },
        { headers: getApiHeaders() }
      );
      if (res.data?.success) {
        setCheckoutUrl(res.data.checkoutUrl);
        toast.success('Enlace de cobro generado');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo generar el cobro');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (checkoutUrl) {
      navigator.clipboard.writeText(checkoutUrl);
      toast.success('Enlace copiado');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-sky-600" />
            Cobrar con Mercado Pago
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
          {IN_PERSON_DISCLAIMER}
        </p>
        <p className="text-sm text-gray-600 mb-4">Paciente: {patientName}</p>
        {!checkoutUrl ? (
          <>
            <label className="block text-sm mb-2">
              Concepto
              <input
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
              />
            </label>
            <label className="block text-sm mb-4">
              Monto (MXN)
              <input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={handleCreate}
              className="w-full bg-sky-600 text-white py-2 rounded text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? 'Generando…' : 'Generar enlace de pago'}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 break-all hover:underline"
            >
              {checkoutUrl}
            </a>
            <button type="button" onClick={copyLink} className="w-full border rounded py-2 text-sm">
              Copiar enlace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
