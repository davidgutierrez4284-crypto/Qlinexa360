import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  BanknotesIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChartBarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { getApiUrl, getApiHeaders } from '../utils/api';
import { formatFinanzasDateTime } from '../utils/dateUtils';
import Tooltip from '../components/common/Tooltip';
import RefundRequestsPanel from '../components/payments/RefundRequestsPanel';

const PLATFORM_NAME = 'Qlinexa360';

const statusLabel = {
  pending: 'Pendiente',
  approved: 'Pagado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
  charged_back: 'Contracargo',
};

const formatMoneyMx = (value, currency = '') => {
  const formatted = Number(value || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `$${formatted} ${currency}` : `$${formatted}`;
};

const Finanzas = () => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [kpis, setKpis] = useState({});
  const [filters, setFilters] = useState({ status: '', paymentType: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.paymentType) params.set('paymentType', filters.paymentType);
      const res = await axios.get(getApiUrl(`/api/payments/mercadopago/transactions?${params}`), {
        headers: getApiHeaders(),
      });
      if (res.data?.success) {
        setItems(res.data.data || []);
        setKpis(res.data.kpis || {});
      }
    } catch {
      toast.error('Error al cargar transacciones');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const exportExcel = async () => {
    try {
      const res = await axios.get(getApiUrl('/api/payments/mercadopago/transactions/export'), {
        headers: getApiHeaders(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'cobros-mercadopago.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Error al exportar Excel');
    }
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <BanknotesIcon className="h-7 w-7 text-sky-600" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold text-gray-900">Finanzas · Mercado Pago</h2>
              <Tooltip
                text='Opcionalmente puedes cobrar teleconsultas con Mercado Pago. En «Mi Perfil» abres o enlazas tu cuenta de Mercado Pago y configuras montos y condiciones. Mercado Pago aplica su comisión de procesamiento; Qlinexa360 cobra una comisión adicional por operar y mantener esta integración.'
                placement="bottom"
                align="start"
                widthClass="w-80"
              >
                <button
                  type="button"
                  className="text-gray-400 hover:text-sky-600 focus:outline-none focus:text-sky-600"
                  aria-label="Información sobre configuración de cobros"
                >
                  <InformationCircleIcon className="h-5 w-5" />
                </button>
              </Tooltip>
            </div>
            <p className="text-sm text-gray-600">Cobros recibidos vía Checkout Pro</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={load} className="inline-flex items-center gap-1 border rounded px-3 py-2 text-sm">
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
          </button>
          <button type="button" onClick={exportExcel} className="inline-flex items-center gap-1 bg-green-600 text-white rounded px-3 py-2 text-sm">
            <ArrowDownTrayIcon className="h-4 w-4" /> Excel
          </button>
        </div>
      </div>

      <RefundRequestsPanel onUpdated={load} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase">Ingresos cobrados</div>
          <div className="text-2xl font-bold text-gray-900">{formatMoneyMx(kpis.totalApproved)}</div>
          <p className="text-xs text-gray-500 mt-1">Monto bruto pagado por pacientes (aprobados)</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase">Comisión {PLATFORM_NAME}</div>
          <div className="text-2xl font-bold text-gray-700">{formatMoneyMx(kpis.totalCommission)}</div>
          <p className="text-xs text-gray-500 mt-1">Comisión marketplace de {PLATFORM_NAME}.</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase">Comisión Mercado Pago</div>
          <div className="text-2xl font-bold text-gray-700">{formatMoneyMx(kpis.totalMercadoPagoCommission)}</div>
          <p className="text-xs text-gray-500 mt-1">Comisión de procesamiento cobrada por Mercado Pago (aprobados).</p>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-xs text-gray-500 uppercase flex items-center gap-1">
            <ChartBarIcon className="h-4 w-4" /> Pendientes
          </div>
          <div className="text-2xl font-bold text-amber-600">{kpis.pendingCount || 0}</div>
          <div className="text-xs text-gray-500 mt-1">{formatMoneyMx(kpis.pendingAmount, 'MXN')}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(statusLabel).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filters.paymentType}
          onChange={(e) => setFilters((f) => ({ ...f, paymentType: e.target.value }))}
          className="border rounded px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="teleconsultation">Teleconsulta</option>
          <option value="in_person">Presencial</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No hay transacciones con los filtros seleccionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Paciente</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Monto</th>
                <th className="py-2 pr-4">Comisión {PLATFORM_NAME}</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const commission = Number(p.platformCommissionAmount || 0);
                const amount = Number(p.amount || 0);
                return (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-3 pr-4 whitespace-nowrap">{formatFinanzasDateTime(p.createdAt)}</td>
                    <td className="py-3 pr-4">
                      {p.patient?.firstName} {p.patient?.lastName}
                    </td>
                    <td className="py-3 pr-4 capitalize">{p.paymentType === 'in_person' ? 'Presencial' : 'Teleconsulta'}</td>
                    <td className="py-3 pr-4 font-medium">{formatMoneyMx(amount, p.currency)}</td>
                    <td className="py-3 pr-4">{formatMoneyMx(commission, p.currency)}</td>
                    <td className="py-3 pr-4">{statusLabel[p.status] || p.status}</td>
                    <td className="py-3 pr-4 text-xs font-mono text-gray-500">{p.externalReference?.slice(0, 8)}…</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Finanzas;
