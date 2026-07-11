import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getApiUrl } from '../utils/api';
import { CalendarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const statusBadge = (confirmationStatus) => {
  switch (confirmationStatus) {
    case 'CONFIRMED':
      return 'bg-green-100 text-green-800';
    case 'RESCHEDULED':
      return 'bg-blue-100 text-blue-800';
    case 'PENDING':
      return 'bg-amber-100 text-amber-800';
    case 'CANCELLED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const PatientAppointments = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(getApiUrl('/api/patients/my/appointments'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data?.success) {
        setItems(res.data.data || []);
      } else {
        toast.error(res.data?.message || 'No se pudieron cargar tus citas');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cargar tus citas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = [];
    const old = [];
    for (const it of items) {
      const t = new Date(it.date).getTime();
      if (t >= now - 60 * 60 * 1000) up.push(it);
      else old.push(it);
    }
    return { upcoming: up, past: old.reverse() };
  }, [items]);

  const renderList = (list, emptyText) => {
    if (list.length === 0) {
      return <p className="text-sm text-gray-500 py-4">{emptyText}</p>;
    }
    return (
      <ul className="divide-y divide-gray-100">
        {list.map((apt) => (
          <li key={apt.id} className="py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-gray-900 capitalize">{apt.dateLabel}</div>
              <div className="text-sm text-gray-700 mt-0.5">
                {apt.timeLabel} · {apt.doctorName}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {apt.appointmentType === 'teleconsulta' ? 'Teleconsulta' : 'Presencial'}
                {apt.notes ? ` · ${apt.notes}` : ''}
              </div>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
              <span
                className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(apt.confirmationStatus)}`}
              >
                {apt.confirmationLabel || apt.confirmationStatus}
              </span>
              {apt.appointmentType === 'teleconsulta' && apt.paymentRequired && (
                <span
                  className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                    apt.paymentStatus === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : apt.paymentStatus === 'refunded'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-violet-100 text-violet-800'
                  }`}
                >
                  {apt.paymentStatus === 'approved'
                    ? 'Pagado'
                    : apt.paymentStatus === 'refunded'
                      ? 'Reembolsado'
                      : 'Pendiente de pago'}
                </span>
              )}
              {apt.appointmentType === 'presencial' && apt.inPersonPaymentOffered && (
                <span
                  className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full ${
                    apt.inPersonPaymentStatus === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : apt.inPersonPaymentStatus === 'refunded'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-sky-100 text-sky-800'
                  }`}
                >
                  {apt.inPersonPaymentStatus === 'approved'
                    ? 'Pagado (MP)'
                    : apt.inPersonPaymentStatus === 'refunded'
                      ? 'Reembolsado'
                      : 'Pago MP pendiente'}
                </span>
              )}
              {apt.refundRequest?.status === 'pending' && (
                <span className="inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-red-100 text-red-800">
                  Reembolso solicitado
                </span>
              )}
              {apt.appointmentType === 'teleconsulta' &&
                apt.paymentRequired &&
                apt.paymentStatus === 'pending' &&
                apt.consentSigned &&
                apt.checkoutUrl && (
                <a
                  href={apt.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-violet-700 hover:underline font-medium"
                >
                  Pagar teleconsulta
                </a>
              )}
              {apt.appointmentType === 'presencial' &&
                apt.inPersonPaymentOffered &&
                apt.inPersonPaymentStatus === 'pending' &&
                apt.inPersonCheckoutUrl && (
                <a
                  href={apt.inPersonCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-sky-700 hover:underline font-medium"
                >
                  Pagar consulta (opcional)
                </a>
              )}
              {apt.appointmentType === 'teleconsulta' && apt.meetingUrl && apt.consentSigned && (!apt.paymentRequired || apt.paymentStatus === 'approved') && (
                <a
                  href={apt.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline font-medium"
                >
                  Entrar a videollamada
                </a>
              )}
              {apt.manageLink && apt.confirmationStatus !== 'CANCELLED' && (
                <a
                  href={apt.manageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {apt.appointmentType === 'teleconsulta' && !apt.consentSigned
                    ? 'Firmar consentimiento'
                      : apt.inPersonPaymentOffered && apt.inPersonPaymentStatus === 'approved'
                        ? 'Gestionar cita / reembolso'
                        : apt.confirmationStatus === 'PENDING'
                      ? 'Confirmar cita'
                      : 'Gestionar cita'}
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-7 w-7 text-blue-600" />
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Mis citas</h2>
            <p className="text-sm text-gray-600">Próximas consultas y reprogramaciones</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm border rounded px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Cargando citas…</p>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">
              Próximas
            </h3>
            {renderList(upcoming, 'No tienes citas próximas en las próximas semanas.')}
          </section>
          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Recientes
              </h3>
              {renderList(past, '')}
            </section>
          )}
        </div>
      )}
    </div>
  );
};

export default PatientAppointments;
