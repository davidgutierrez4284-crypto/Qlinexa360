import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getApiHeaders } from '../utils/api';
import { toast } from 'react-toastify';
import CountrySelect from '../components/common/CountrySelect';

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  PROCESSING: 'En proceso',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
  REVERSED: 'Reversada',
  REGISTERED: 'Registrado',
  TRIAL: 'En prueba',
  ACTIVE_PAID: 'Pagando',
  EXPIRED: 'Expirado',
};

const money = (n, currency = 'MXN') =>
  `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

async function apiGet(path) {
  const res = await fetch(getApiUrl(path), { headers: getApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}
async function apiSend(path, method, body) {
  const res = await fetch(getApiUrl(path), {
    method,
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}

const Badge = ({ status }) => {
  const map = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-700',
    REVERSED: 'bg-red-100 text-red-800',
    REGISTERED: 'bg-slate-100 text-slate-700',
    TRIAL: 'bg-indigo-100 text-indigo-800',
    ACTIVE_PAID: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-700',
  };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>{STATUS_LABELS[status] || status}</span>;
};

const TabButton = ({ active, onClick, children }) => (
  <button type="button" onClick={onClick} className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${active ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{children}</button>
);

const ResumenTab = () => {
  const [data, setData] = useState(null);
  useEffect(() => {
    apiGet('/api/affiliate/dashboard').then((j) => setData(j.data)).catch((e) => toast.error(e.message));
  }, []);
  if (!data) return <p className="text-sm text-gray-500">Cargando…</p>;

  const findTotal = (status) => data.commissionsByStatus.find((c) => c.status === status)?.amount || 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-6">
        <p className="text-sm opacity-80">Tu código de afiliado</p>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-3xl font-bold font-mono tracking-wide">{data.affiliateCode}</p>
          <button
            type="button"
            onClick={() => {
              const code = data.affiliateCode || '';
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(code)
                  .then(() => toast.success('Código copiado'))
                  .catch(() => toast.error('No se pudo copiar el código'));
              } else {
                toast.error('No se pudo copiar el código');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            title="Copiar código"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar
          </button>
        </div>
        <p className="text-sm mt-2 opacity-90">Comparte este código al registrar médicos. Comisión: <strong>{data.commissionPercentage}%</strong> durante <strong>{data.commissionMonths} meses</strong> por cada médico.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <p className="font-semibold mb-1">¿Sobre qué monto se calcula tu comisión?</p>
        <p>{data.baseExplanation.text}</p>
        <p className="mt-1">Ejemplo: ${data.baseExplanation.gross} con IVA ({data.baseExplanation.vatRatePercent}%) → base ${data.baseExplanation.net} → tu comisión ({data.baseExplanation.commissionPercentage}%) = <strong>{money(data.baseExplanation.commission)}</strong>.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4"><p className="text-xs text-gray-500">Médicos registrados</p><p className="text-2xl font-bold">{data.totalReferrals}</p></div>
        <div className="bg-white border rounded-lg p-4"><p className="text-xs text-gray-500">Médicos con primer pago</p><p className="text-2xl font-bold">{data.payingReferrals}</p></div>
        <div className="bg-white border rounded-lg p-4"><p className="text-xs text-gray-500">Comisión por cobrar</p><p className="text-2xl font-bold text-yellow-700">{money(findTotal('PENDING') + findTotal('APPROVED'))}</p></div>
        <div className="bg-white border rounded-lg p-4"><p className="text-xs text-gray-500">Comisión pagada</p><p className="text-2xl font-bold text-green-700">{money(findTotal('PAID'))}</p></div>
      </div>
    </div>
  );
};

const ComisionesTab = () => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const load = useCallback(async () => {
    try {
      const q = status ? `?status=${status}` : '';
      const j = await apiGet(`/api/affiliate/commissions${q}`);
      setRows(j.data || []);
    } catch (e) { toast.error(e.message); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2 mb-4">
        <option value="">Todas</option>
        {['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'CANCELLED', 'REVERSED'].map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
      <div className="overflow-x-auto bg-white rounded-lg border">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b text-left text-gray-600"><th className="py-2 px-3">Fecha</th><th className="py-2 px-3">Médico</th><th className="py-2 px-3">Mes</th><th className="py-2 px-3">Base sin IVA</th><th className="py-2 px-3">Comisión</th><th className="py-2 px-3">Estatus</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2 px-3 whitespace-nowrap">{new Date(c.paymentDate).toLocaleDateString('es-MX')}</td>
                <td className="py-2 px-3">{c.doctorName || c.doctorEmail}</td>
                <td className="py-2 px-3">{c.commissionMonthNumber}</td>
                <td className="py-2 px-3">{money(c.paymentAmountNet, c.currency)}</td>
                <td className="py-2 px-3 font-medium">{money(c.commissionAmount, c.currency)}</td>
                <td className="py-2 px-3"><Badge status={c.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-gray-500">Sin comisiones todavía</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ReferidosTab = () => {
  const [rows, setRows] = useState([]);
  useEffect(() => { apiGet('/api/affiliate/referrals').then((j) => setRows(j.data || [])).catch((e) => toast.error(e.message)); }, []);
  return (
    <div className="overflow-x-auto bg-white rounded-lg border">
      <table className="min-w-full text-sm">
        <thead><tr className="border-b text-left text-gray-600"><th className="py-2 px-3">Médico</th><th className="py-2 px-3">Estatus</th><th className="py-2 px-3">Registro</th><th className="py-2 px-3">Primer pago</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-2 px-3">{r.doctorName || r.doctorEmail}</td>
              <td className="py-2 px-3"><Badge status={r.status} /></td>
              <td className="py-2 px-3">{new Date(r.registrationDate).toLocaleDateString('es-MX')}</td>
              <td className="py-2 px-3">{r.firstPaymentDate ? new Date(r.firstPaymentDate).toLocaleDateString('es-MX') : '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-500">Aún no has registrado médicos</td></tr>}
        </tbody>
      </table>
    </div>
  );
};

const emptyBank = {
  payoutMethod: 'SPEI', paypalEmail: '',
  beneficiaryFullName: '', country: 'MX', bankName: '', clabe: '', accountNumber: '',
  swiftBic: '', iban: '', localBankCode: '', bankAddress: '', beneficiaryAddress: '',
  preferredCurrency: 'MXN', additionalInstructions: '',
};

const BankTab = () => {
  const [form, setForm] = useState(emptyBank);
  const [loading, setLoading] = useState(true);
  const [minPayout, setMinPayout] = useState(200);

  useEffect(() => {
    apiGet('/api/affiliate/bank-account')
      .then((j) => {
        if (j.data) setForm({ ...emptyBank, ...j.data });
        if (typeof j.minPayoutAmountMxn === 'number') setMinPayout(j.minPayoutAmountMxn);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  const minPayoutLabel = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(minPayout || 0);

  const isPaypal = (form.payoutMethod || 'SPEI') === 'PAYPAL';

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    try {
      await apiSend('/api/affiliate/bank-account', 'PUT', form);
      toast.success('Datos bancarios guardados');
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (loading) return <p className="text-sm text-gray-500">Cargando…</p>;

  const field = (label, k, placeholder, required) => (
    <div key={k}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input value={form[k] || ''} onChange={set(k)} placeholder={placeholder} className="border rounded px-3 py-2 w-full" />
    </div>
  );

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-gray-600 mb-1">Estos datos se usan únicamente para el pago de tus comisiones. Solo tú y el administrador pueden verlos.</p>
      <p className="text-xs text-gray-500 mb-4">Las comisiones se calculan y se pagan en <strong>pesos mexicanos (MXN)</strong>. Si tu cuenta es de otro país, la conversión a tu moneda local la realiza tu banco al recibir la transferencia.</p>
      <div className="grid sm:grid-cols-2 gap-4 bg-white border rounded-lg p-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, payoutMethod: 'SPEI' })}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${!isPaypal ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              SPEI (México)
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, payoutMethod: 'PAYPAL' })}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${isPaypal ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              PayPal
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {isPaypal
              ? 'Recomendado si estás fuera de México. Te pagaremos vía PayPal al correo que indiques.'
              : 'Transferencia SPEI a una cuenta en México (CLABE).'}
          </p>
        </div>

        {field('Nombre del beneficiario', 'beneficiaryFullName', '', true)}
        <CountrySelect label="País" required value={form.country} onChange={(code) => setForm({ ...form, country: code })} />

        {isPaypal ? (
          <>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo de PayPal <span className="text-red-500">*</span></label>
              <input type="email" value={form.paypalEmail || ''} onChange={set('paypalEmail')} placeholder="tu-correo@ejemplo.com" className="border rounded px-3 py-2 w-full" />
              <p className="text-xs text-gray-500 mt-1">Usa el correo de tu cuenta PayPal que pueda <strong>recibir</strong> pagos. La conversión a tu moneda local la hace PayPal/tu banco.</p>
            </div>
            <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                <strong>Pagos internacionales:</strong> para optimizar lo que recibes y reducir las comisiones que cobran los bancos
                e intermediarios por los envíos internacionales, tus comisiones se acumulan y se pagan cuando tu saldo
                alcanza un <strong>monto mínimo de {minPayoutLabel}</strong>. Por debajo de ese monto, las comisiones del
                envío podrían reducir de forma importante lo que recibirías, por lo que esperamos a que sea conveniente.
              </p>
            </div>
          </>
        ) : (
          <>
            {field('Banco', 'bankName', '', true)}
            {field('CLABE (18 dígitos)', 'clabe', '000000000000000000', true)}
            <p className="sm:col-span-2 text-xs text-gray-500 -mt-2">Para pagos por SPEI en México basta con la CLABE; no se requieren más datos.</p>
          </>
        )}
        <button onClick={save} className="sm:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Guardar datos bancarios</button>
      </div>
    </div>
  );
};

const AffiliateDashboard = ({ initialTab }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab || 'resumen');

  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);

  // "Afiliado" es una capacidad: acceden los afiliados puros (rol AFFILIATE) y
  // cualquier usuario (p. ej. paciente) que tenga perfil de afiliado vinculado.
  const canAccessAffiliate = user?.role === 'AFFILIATE' || user?.hasAffiliateProfile === true;
  if (!canAccessAffiliate) {
    return <Navigate to="/dashboard/dashboard" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Panel de afiliado</h1>
      <div className="border-b mb-6 flex gap-1 flex-wrap">
        <TabButton active={tab === 'resumen'} onClick={() => setTab('resumen')}>Resumen</TabButton>
        <TabButton active={tab === 'comisiones'} onClick={() => setTab('comisiones')}>Comisiones</TabButton>
        <TabButton active={tab === 'referidos'} onClick={() => setTab('referidos')}>Médicos referidos</TabButton>
        <TabButton active={tab === 'bank'} onClick={() => setTab('bank')}>Datos bancarios</TabButton>
      </div>
      {tab === 'resumen' && <ResumenTab />}
      {tab === 'comisiones' && <ComisionesTab />}
      {tab === 'referidos' && <ReferidosTab />}
      {tab === 'bank' && <BankTab />}
    </div>
  );
};

export default AffiliateDashboard;
