import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { getApiUrl, getApiHeaders } from '../../utils/api';
import { formatFinanzasDateTime } from '../../utils/dateUtils';

const refundStatusLabel = {
  pending: 'Pendiente',
  rejected: 'Rechazada',
  completed: 'Reembolsada',
  failed: 'Error al procesar',
};

const formatMoneyMx = (value, currency = 'MXN') =>
  `$${Number(value || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

const RefundRequestsPanel = ({ onUpdated }) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const [approveAmounts, setApproveAmounts] = useState({});
  const [doctorNotes, setDoctorNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const headers = getApiHeaders();
      const [pendingRes, failedRes] = await Promise.all([
        axios.get(getApiUrl('/api/payments/mercadopago/refund-requests?status=pending'), { headers }),
        axios.get(getApiUrl('/api/payments/mercadopago/refund-requests?status=failed'), { headers }),
      ]);
      if (pendingRes.data?.success) {
        const pendingItems = pendingRes.data.data || [];
        const failedItems = failedRes.data?.success ? failedRes.data.data || [] : [];
        const combined = [...pendingItems, ...failedItems].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setItems(combined);
        setPendingCount(pendingRes.data.pendingCount || pendingItems.length);
        setFailedCount(failedItems.length);
        const defaults = {};
        for (const row of combined) {
          defaults[row.id] = row.approvedAmount ?? row.requestedAmount;
        }
        setApproveAmounts(defaults);
      }
    } catch {
      toast.error('Error al cargar solicitudes de reembolso');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (row) => {
    const approvedAmount = Number(approveAmounts[row.id] ?? row.requestedAmount);
    if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
      toast.error('Monto a reembolsar inválido');
      return;
    }
    if (
      !window.confirm(
        `¿Aprobar reembolso de ${formatMoneyMx(approvedAmount, row.payment?.currency || 'MXN')} a ${row.patient?.firstName || ''} ${row.patient?.lastName || ''}?`
      )
    ) {
      return;
    }
    setProcessingId(row.id);
    try {
      await axios.post(
        getApiUrl(`/api/payments/mercadopago/refund-requests/${row.id}/approve`),
        {
          approvedAmount,
          doctorNotes: doctorNotes[row.id] || undefined,
        },
        { headers: getApiHeaders() }
      );
      toast.success('Reembolso procesado correctamente');
      await load();
      onUpdated?.();
    } catch (error) {
      const message =
        error.response?.data?.error ||
        error.message ||
        'Error al aprobar reembolso';
      toast.error(message, { autoClose: 8000 });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (row) => {
    const notes = (doctorNotes[row.id] || '').trim();
    if (notes.length < 5) {
      toast.error('Indica el motivo del rechazo (mínimo 5 caracteres)');
      return;
    }
    if (!window.confirm('¿Rechazar esta solicitud de reembolso?')) return;
    setProcessingId(row.id);
    try {
      await axios.post(
        getApiUrl(`/api/payments/mercadopago/refund-requests/${row.id}/reject`),
        { doctorNotes: notes },
        { headers: getApiHeaders() }
      );
      toast.success('Solicitud rechazada');
      await load();
      onUpdated?.();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al rechazar solicitud');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Cargando solicitudes de reembolso…
      </div>
    );
  }

  if (items.length === 0 && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-amber-950">
            Solicitudes de reembolso ({pendingCount} pendientes
            {failedCount > 0 ? `, ${failedCount} con error` : ''})
          </h3>
          <p className="text-xs text-amber-800 mt-1">
            Revisa cada caso según tu política de reembolsos antes de aprobar. Tú decides si procede el reembolso total o parcial.
            {failedCount > 0
              ? ' Las solicitudes con error se pueden reintentar desde aquí.'
              : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1 border border-amber-300 bg-white rounded px-2 py-1 text-xs text-amber-900"
        >
          <ArrowPathIcon className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-amber-800">No hay solicitudes de reembolso en este momento.</p>
      ) : (
        <div className="space-y-4">
          {items.map((row) => {
            const isFailed = row.status === 'failed';
            return (
            <div
              key={row.id}
              className={`rounded-md border bg-white p-4 ${
                isFailed ? 'border-red-300 bg-red-50/40' : 'border-amber-200'
              }`}
            >
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700 mb-3">
                <span>
                  <strong>Paciente:</strong> {row.patient?.firstName} {row.patient?.lastName}
                </span>
                <span>
                  <strong>Cobrado:</strong> {formatMoneyMx(row.payment?.amount, row.payment?.currency)}
                </span>
                <span>
                  <strong>Solicita:</strong> {formatMoneyMx(row.requestedAmount, row.payment?.currency)}
                </span>
                <span>
                  <strong>Estado:</strong> {refundStatusLabel[row.status] || row.status}
                </span>
                {row.appointment?.date && (
                  <span>
                    <strong>Cita:</strong> {formatFinanzasDateTime(row.appointment.date)}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800 mb-3">
                <strong>Motivo del paciente:</strong> {row.reason}
              </p>
              {isFailed && row.failureReason && (
                <p className="text-sm text-red-800 mb-3 rounded border border-red-200 bg-red-50 px-3 py-2">
                  <strong>Último error:</strong> {row.failureReason}
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Monto a reembolsar (puede ser parcial)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={approveAmounts[row.id] ?? row.requestedAmount}
                    onChange={(e) =>
                      setApproveAmounts((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Notas para el paciente (obligatorio al rechazar)
                  </label>
                  <input
                    type="text"
                    value={doctorNotes[row.id] || ''}
                    onChange={(e) =>
                      setDoctorNotes((prev) => ({ ...prev, [row.id]: e.target.value }))
                    }
                    placeholder="Ej. Cancelación fuera del plazo de 24 h"
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={processingId === row.id}
                  onClick={() => handleApprove(row)}
                  className="inline-flex items-center gap-1 bg-green-600 text-white rounded px-3 py-2 text-sm disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {processingId === row.id
                    ? 'Procesando…'
                    : isFailed
                      ? 'Reintentar reembolso'
                      : 'Aprobar y reembolsar'}
                </button>
                <button
                  type="button"
                  disabled={processingId === row.id}
                  onClick={() => handleReject(row)}
                  className="inline-flex items-center gap-1 border border-red-300 text-red-700 rounded px-3 py-2 text-sm disabled:opacity-50"
                >
                  <XCircleIcon className="h-4 w-4" /> Rechazar
                </button>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default RefundRequestsPanel;
