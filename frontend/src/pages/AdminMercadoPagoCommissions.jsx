import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { getApiUrl, getApiHeaders } from '../utils/api';

const AdminMercadoPagoCommissions = () => {
  const [rules, setRules] = useState([]);
  const [report, setReport] = useState(null);
  const [form, setForm] = useState({
    commissionPercentage: 1,
    commissionFixedAmount: 0,
    minCommissionAmount: 0,
    maxCommissionAmount: '',
    applyCommissionToTeleconsultation: true,
    applyCommissionToInPersonConsultation: true,
    isActive: true,
  });

  const load = async () => {
    try {
      const [rulesRes, reportRes] = await Promise.all([
        axios.get(getApiUrl('/api/payments/mercadopago/admin/commission-rules'), { headers: getApiHeaders() }),
        axios.get(getApiUrl('/api/payments/mercadopago/admin/commission-report'), { headers: getApiHeaders() }),
      ]);
      if (rulesRes.data?.success) {
        setRules(rulesRes.data.data || []);
        const active = rulesRes.data.data?.find((r) => r.isActive);
        if (active) {
          setForm({
            id: active.id,
            commissionPercentage: active.commissionPercentage,
            commissionFixedAmount: active.commissionFixedAmount,
            minCommissionAmount: active.minCommissionAmount,
            maxCommissionAmount: active.maxCommissionAmount ?? '',
            applyCommissionToTeleconsultation: active.applyCommissionToTeleconsultation,
            applyCommissionToInPersonConsultation: active.applyCommissionToInPersonConsultation,
            isActive: active.isActive,
          });
        }
      }
      if (reportRes.data?.success) setReport(reportRes.data);
    } catch {
      toast.error('Error al cargar comisiones MP');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      await axios.put(getApiUrl('/api/payments/mercadopago/admin/commission-rules'), form, {
        headers: getApiHeaders(),
      });
      toast.success('Regla guardada');
      load();
    } catch {
      toast.error('Error al guardar');
    }
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-md max-w-3xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Comisiones Mercado Pago</h2>
      <p className="text-sm text-gray-600 mb-6">Regla global de marketplace_fee para Qlinexa360.</p>

      {report && (
        <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg text-sm">
          <div>
            <div className="text-gray-500">Pagos aprobados</div>
            <div className="text-xl font-bold">{report.totalPayments}</div>
          </div>
          <div>
            <div className="text-gray-500">Volumen</div>
            <div className="text-xl font-bold">${Number(report.totalVolume || 0).toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Comisión Qlinexa360</div>
            <div className="text-xl font-bold">${Number(report.totalCommission || 0).toFixed(2)}</div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="block text-sm">
          Porcentaje de comisión (%)
          <input
            type="number"
            step="0.01"
            className="mt-1 w-full border rounded px-3 py-2"
            value={form.commissionPercentage}
            onChange={(e) => setForm((f) => ({ ...f, commissionPercentage: parseFloat(e.target.value) || 0 }))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.applyCommissionToTeleconsultation}
            onChange={(e) => setForm((f) => ({ ...f, applyCommissionToTeleconsultation: e.target.checked }))}
          />
          Aplicar a teleconsulta
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.applyCommissionToInPersonConsultation}
            onChange={(e) => setForm((f) => ({ ...f, applyCommissionToInPersonConsultation: e.target.checked }))}
          />
          Aplicar a consulta presencial
        </label>
        <button type="button" onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">
          Guardar regla activa
        </button>
      </div>

      {rules.length > 1 && (
        <p className="text-xs text-gray-500 mt-4">{rules.length} reglas históricas en base de datos.</p>
      )}
    </div>
  );
};

export default AdminMercadoPagoCommissions;
