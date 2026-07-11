import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getApiHeaders } from '../utils/api';
import { toast } from 'react-toastify';
import PhoneInput from '../components/common/PhoneInput';
import CountrySelect from '../components/common/CountrySelect';

// Estatus de comisión (también alimenta el filtro de la pestaña Comisiones).
const STATUS_LABELS = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  PROCESSING: 'En proceso (PayPal)',
  PAID: 'Pagada',
  CANCELLED: 'Cancelada',
  REVERSED: 'Reversada',
};

// Etiquetas en español para TODOS los estatus mostrados en badges
// (afiliado, código y referido), para mantener consistencia de idioma.
const BADGE_LABELS = {
  ...STATUS_LABELS,
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  SUSPENDED: 'Suspendido',
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  REGISTERED: 'Registrado',
  TRIAL: 'En prueba',
  ACTIVE_PAID: 'Pagando',
  EXPIRED: 'Expirado',
};

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
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

async function downloadExcel(path, filename) {
  const res = await fetch(getApiUrl(path), { headers: getApiHeaders() });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `Error ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${
      active ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`}
  >
    {children}
  </button>
);

const Badge = ({ status }) => {
  const map = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    PAID: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-gray-100 text-gray-700',
    REVERSED: 'bg-red-100 text-red-800',
    ACTIVE: 'bg-green-100 text-green-800',
    INACTIVE: 'bg-gray-100 text-gray-700',
    SUSPENDED: 'bg-red-100 text-red-800',
    REGISTERED: 'bg-slate-100 text-slate-700',
    TRIAL: 'bg-indigo-100 text-indigo-800',
    ACTIVE_PAID: 'bg-green-100 text-green-800',
    EXPIRED: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>
      {BADGE_LABELS[status] || status}
    </span>
  );
};

/* ---------------- Afiliados ---------------- */
const AfiliadosTab = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState(null);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', country: 'MX', commissionPercentage: 30, commissionMonths: 6, code: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiGet('/api/admin/affiliates');
      setList(j.data || []);
      setPayoutsEnabled(!!j.paypalPayoutsEnabled);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try {
      const j = await apiSend('/api/admin/affiliates', 'POST', form);
      if (j.data?.linkedToExisting) {
        toast.success('Afiliado vinculado a una cuenta existente');
        toast.info('Se envió correo de bienvenida con su código de afiliado. El usuario verá el panel de afiliado en su menú al iniciar sesión.', { autoClose: 8000 });
      } else {
        toast.success('Afiliado creado');
        toast.info('Se envió correo de bienvenida con código, acceso al portal e instrucciones para crear su contraseña (Olvidé mi contraseña).', { autoClose: 8000 });
        if (j.data?.tempPassword) {
          toast.info(`Respaldo admin — contraseña temporal: ${j.data.tempPassword}`, { autoClose: false });
        }
      }
      setShowCreate(false);
      setForm({ fullName: '', email: '', phone: '', country: 'MX', commissionPercentage: 30, commissionMonths: 6, code: '' });
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const openDetail = async (id) => {
    try {
      const j = await apiGet(`/api/admin/affiliates/detail/${id}`);
      setDetail(j.data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await apiSend(`/api/admin/affiliates/${id}`, 'PATCH', { status });
      toast.success('Actualizado');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const payPaypal = async (a) => {
    if (!window.confirm(`¿Pagar por PayPal ${money(a.pendingCommissionAmount)} a ${a.fullName} (${a.payoutTarget})?`)) return;
    setPaying(a.id);
    try {
      const j = await apiSend(`/api/admin/affiliates/${a.id}/pay-paypal`, 'POST', {});
      toast.success(j.message || 'Pago enviado a PayPal');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaying(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Afiliados</h2>
        <button onClick={() => setShowCreate((v) => !v)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
          {showCreate ? 'Cancelar' : '+ Nuevo afiliado'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-xs text-gray-600 mb-3">
            La comisión por defecto se define en la pestaña <strong>Configuración</strong>. Los campos de comisión de abajo
            permiten <strong>personalizarla para este afiliado</strong> (si los dejas igual, hereda el valor global).
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input className="w-full border rounded px-3 py-2" placeholder="Ej. María Pérez" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="w-full border rounded px-3 py-2" type="email" placeholder="correo@ejemplo.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <PhoneInput
              label="Teléfono (opcional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Ej: 55 1234 5678"
            />
            <CountrySelect label="País" value={form.country} onChange={(code) => setForm({ ...form, country: code })} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">% de comisión</label>
              <input className="w-full border rounded px-3 py-2" type="number" min="0" max="100" placeholder="30" value={form.commissionPercentage} onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">Porcentaje sobre la base sin IVA.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meses de comisión</label>
              <input className="w-full border rounded px-3 py-2" type="number" min="1" placeholder="6" value={form.commissionMonths} onChange={(e) => setForm({ ...form, commissionMonths: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">Cuántos pagos del doctor generan comisión.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Código (opcional)</label>
              <input className="w-full border rounded px-3 py-2" placeholder="Déjalo vacío para asignar uno del lote automáticamente" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
              <p className="text-xs text-gray-500 mt-1">Si lo dejas vacío, se toma el siguiente código disponible del lote (pestaña «Códigos»); si no hay lote, se genera uno nuevo.</p>
            </div>
            <button onClick={create} className="sm:col-span-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">Crear afiliado</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2 px-3">Nombre</th>
                <th className="py-2 px-3">Código</th>
                <th className="py-2 px-3">Estatus</th>
                <th className="py-2 px-3">%</th>
                <th className="py-2 px-3">Referidos</th>
                <th className="py-2 px-3">Pago</th>
                <th className="py-2 px-3">Por pagar</th>
                <th className="py-2 px-3">Pagado</th>
                <th className="py-2 px-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-b border-gray-100">
                  <td className="py-2 px-3">
                    <div className="font-medium">{a.fullName}</div>
                    <div className="text-xs text-gray-500">{a.email}</div>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{a.affiliateCode}</td>
                  <td className="py-2 px-3"><Badge status={a.status} /></td>
                  <td className="py-2 px-3">{a.defaultCommissionPercentage}%</td>
                  <td className="py-2 px-3">{a.referralsCount}</td>
                  <td className="py-2 px-3">
                    {a.hasPayoutData ? (
                      <div>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${a.payoutMethod === 'PAYPAL' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {a.payoutMethod === 'PAYPAL' ? 'PayPal' : 'SPEI'}
                        </span>
                        <div className="text-[11px] text-gray-500 max-w-[180px] truncate" title={a.payoutTarget}>{a.payoutTarget}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-600">Sin datos</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div>{money(a.pendingCommissionAmount)}</div>
                    {a.readyToPay && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Listo para pagar</span>}
                  </td>
                  <td className="py-2 px-3">{money(a.paidCommissionAmount)}</td>
                  <td className="py-2 px-3 space-x-2 whitespace-nowrap">
                    <button onClick={() => openDetail(a.id)} className="text-blue-600 hover:underline">Detalle</button>
                    {payoutsEnabled && a.payoutMethod === 'PAYPAL' && a.pendingCommissionAmount > 0 && (
                      <button
                        onClick={() => payPaypal(a)}
                        disabled={paying === a.id}
                        className="text-indigo-600 hover:underline disabled:opacity-50"
                      >
                        {paying === a.id ? 'Pagando…' : 'Pagar con PayPal'}
                      </button>
                    )}
                    {a.status === 'ACTIVE' ? (
                      <button onClick={() => setStatus(a.id, 'SUSPENDED')} className="text-red-600 hover:underline">Suspender</button>
                    ) : (
                      <button onClick={() => setStatus(a.id, 'ACTIVE')} className="text-green-600 hover:underline">Activar</button>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={9} className="py-6 text-center text-gray-500">Sin afiliados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{detail.fullName}</h3>
                <p className="text-sm text-gray-500">{detail.email} · <span className="font-mono">{detail.affiliateCode}</span></p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            {(() => {
              const bank = (detail.bankAccounts || []).find((b) => b.isActive) || (detail.bankAccounts || [])[0];
              return (
                <div className="mb-4 bg-gray-50 border rounded-lg p-3">
                  <h4 className="font-semibold text-gray-700 mb-1">Datos de pago</h4>
                  {!bank ? (
                    <p className="text-sm text-amber-600">El afiliado aún no registró sus datos de pago.</p>
                  ) : bank.payoutMethod === 'PAYPAL' ? (
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <p><span className="text-gray-500">Método:</span> <span className="font-medium">PayPal</span></p>
                      <p><span className="text-gray-500">Correo PayPal:</span> <span className="font-medium">{bank.paypalEmail}</span></p>
                      <p><span className="text-gray-500">Beneficiario:</span> {bank.beneficiaryFullName}</p>
                      <p><span className="text-gray-500">País:</span> {bank.country}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 space-y-0.5">
                      <p><span className="text-gray-500">Método:</span> <span className="font-medium">SPEI (México)</span></p>
                      <p><span className="text-gray-500">Banco:</span> {bank.bankName || '—'}</p>
                      <p><span className="text-gray-500">CLABE:</span> <span className="font-mono">{bank.clabe || '—'}</span></p>
                      <p><span className="text-gray-500">Beneficiario:</span> {bank.beneficiaryFullName}</p>
                    </div>
                  )}
                </div>
              );
            })()}
            <h4 className="font-semibold text-gray-700 mt-3 mb-1">Médicos referidos ({detail.referrals?.length || 0})</h4>
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full text-xs">
                <thead><tr className="text-left text-gray-500 border-b"><th className="py-1 pr-3">Doctor</th><th className="py-1 pr-3">Estatus</th><th className="py-1 pr-3">Registro</th><th className="py-1 pr-3">Primer pago</th></tr></thead>
                <tbody>
                  {(detail.referrals || []).map((r) => (
                    <tr key={r.id} className="border-b border-gray-100">
                      <td className="py-1 pr-3">{r.doctorName || r.doctorEmail}</td>
                      <td className="py-1 pr-3"><Badge status={r.status} /></td>
                      <td className="py-1 pr-3">{new Date(r.registrationDate).toLocaleDateString('es-MX')}</td>
                      <td className="py-1 pr-3">{r.firstPaymentDate ? new Date(r.firstPaymentDate).toLocaleDateString('es-MX') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h4 className="font-semibold text-gray-700 mb-1">Comisiones ({detail.commissions?.length || 0})</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead><tr className="text-left text-gray-500 border-b"><th className="py-1 pr-3">Fecha</th><th className="py-1 pr-3">Mes</th><th className="py-1 pr-3">Base</th><th className="py-1 pr-3">Comisión</th><th className="py-1 pr-3">Estatus</th></tr></thead>
                <tbody>
                  {(detail.commissions || []).map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-1 pr-3">{new Date(c.paymentDate).toLocaleDateString('es-MX')}</td>
                      <td className="py-1 pr-3">{c.commissionMonthNumber}</td>
                      <td className="py-1 pr-3">{money(c.paymentAmountNet, c.currency)}</td>
                      <td className="py-1 pr-3 font-medium">{money(c.commissionAmount, c.currency)}</td>
                      <td className="py-1 pr-3"><Badge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- Códigos ---------------- */
const CodigosTab = () => {
  const [codes, setCodes] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [batchCount, setBatchCount] = useState(1000);

  const load = useCallback(async () => {
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const j = await apiGet(`/api/admin/affiliates/codes${q}`);
      setCodes(j.data || []);
    } catch (e) {
      toast.error(e.message);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Cantidad de códigos por lote (derivada del listado) para mostrar info amigable en vez del id técnico.
  const batchCounts = useMemo(() => {
    const counts = {};
    for (const c of codes) {
      if (c.batchId) counts[c.batchId] = (counts[c.batchId] || 0) + 1;
    }
    return counts;
  }, [codes]);

  const genOne = async () => {
    try { await apiSend('/api/admin/affiliates/codes', 'POST'); toast.success('Código generado'); load(); }
    catch (e) { toast.error(e.message); }
  };
  const genBatch = async () => {
    try {
      const j = await apiSend('/api/admin/affiliates/codes/batch', 'POST', { count: Number(batchCount) });
      toast.success(`${j.data.created} códigos generados (lote ${j.data.batchId})`);
      load();
    } catch (e) { toast.error(e.message); }
  };
  const exportCodes = async () => {
    try { await downloadExcel('/api/admin/affiliates/codes/export', 'codigos-afiliados.xlsx'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <button onClick={genOne} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">+ Generar 1 código</button>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500">Cantidad del lote</label>
            <input type="number" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} className="border rounded px-3 py-2 w-28" />
          </div>
          <button onClick={genBatch} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">Generar lote</button>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-2">
          <option value="">Todos</option>
          <option value="AVAILABLE">Disponibles</option>
          <option value="ASSIGNED">Asignados</option>
        </select>
        <button onClick={exportCodes} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm">Exportar Excel</button>
      </div>
      <div className="overflow-x-auto bg-white rounded-lg border max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead><tr className="border-b text-left text-gray-600"><th className="py-2 px-3">Código</th><th className="py-2 px-3">Estatus</th><th className="py-2 px-3">Afiliado</th><th className="py-2 px-3">Lote</th></tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2 px-3 font-mono">{c.code}</td>
                <td className="py-2 px-3"><Badge status={c.status} /></td>
                <td className="py-2 px-3" title={c.affiliateEmail || ''}>
                  {c.affiliateName
                    ? <span className="text-gray-800">{c.affiliateName}</span>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="py-2 px-3 text-xs text-gray-500" title={c.batchId || ''}>
                  {c.batchId
                    ? `${fmtDate(c.createdAt)} · ${batchCounts[c.batchId]} ${batchCounts[c.batchId] === 1 ? 'código' : 'códigos'}`
                    : `Individual · ${fmtDate(c.createdAt)}`}
                </td>
              </tr>
            ))}
            {codes.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-gray-500">Sin códigos</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- Comisiones ---------------- */
const ComisionesTab = () => {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState([]);
  const [filters, setFilters] = useState({ status: '', month: '', year: '' });

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.month) params.set('month', filters.month);
    if (filters.year) params.set('year', filters.year);
    const q = params.toString();
    return q ? `?${q}` : '';
  }, [filters]);

  const load = useCallback(async () => {
    try {
      const j = await apiGet(`/api/admin/affiliates/commissions${buildQuery()}`);
      setRows(j.data || []);
      setTotals(j.totals || []);
    } catch (e) { toast.error(e.message); }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try { await apiSend(`/api/admin/affiliates/commissions/${id}/approve`, 'POST'); toast.success('Aprobada'); load(); }
    catch (e) { toast.error(e.message); }
  };
  const pay = async (id) => {
    try { await apiSend(`/api/admin/affiliates/commissions/${id}/pay`, 'POST'); toast.success('Marcada como pagada'); load(); }
    catch (e) { toast.error(e.message); }
  };
  const exportXlsx = async () => {
    try { await downloadExcel(`/api/admin/affiliates/commissions/export${buildQuery()}`, 'comisiones-afiliados.xlsx'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="border rounded px-3 py-2">
          <option value="">Todos los estatus</option>
          {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <input type="number" placeholder="Mes (1-12)" value={filters.month} onChange={(e) => setFilters({ ...filters, month: e.target.value })} className="border rounded px-3 py-2 w-28" />
        <input type="number" placeholder="Año" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="border rounded px-3 py-2 w-28" />
        <button onClick={exportXlsx} className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm">Exportar Excel</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        {totals.map((t) => (
          <div key={t.status} className="bg-white border rounded-lg px-4 py-2 text-sm">
            <Badge status={t.status} /> <span className="ml-2 font-semibold">{money(t.amount)}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border max-h-[60vh]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-2 px-3">Fecha</th>
              <th className="py-2 px-3">Afiliado</th>
              <th className="py-2 px-3">Mes</th>
              <th className="py-2 px-3">Base sin IVA</th>
              <th className="py-2 px-3">Comisión</th>
              <th className="py-2 px-3">Estatus</th>
              <th className="py-2 px-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="py-2 px-3 whitespace-nowrap">{new Date(c.paymentDate).toLocaleDateString('es-MX')}</td>
                <td className="py-2 px-3">
                  <div>{c.affiliateName}</div>
                  <div className="text-xs font-mono text-gray-500">{c.affiliateCode}</div>
                </td>
                <td className="py-2 px-3">{c.commissionMonthNumber}</td>
                <td className="py-2 px-3">{money(c.paymentAmountNet, c.currency)}</td>
                <td className="py-2 px-3 font-medium">{money(c.commissionAmount, c.currency)}</td>
                <td className="py-2 px-3"><Badge status={c.status} /></td>
                <td className="py-2 px-3 space-x-2 whitespace-nowrap">
                  {c.status === 'PENDING' && <button onClick={() => approve(c.id)} className="text-blue-600 hover:underline">Aprobar</button>}
                  {(c.status === 'PENDING' || c.status === 'APPROVED') && <button onClick={() => pay(c.id)} className="text-green-600 hover:underline">Marcar pagada</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-gray-500">Sin comisiones</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ---------------- Configuración ---------------- */
const ConfigTab = () => {
  const [rule, setRule] = useState(null);

  const load = useCallback(async () => {
    try { const j = await apiGet('/api/admin/affiliates/commission-rule'); setRule(j.data); }
    catch (e) { toast.error(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      await apiSend('/api/admin/affiliates/commission-rule', 'PUT', {
        name: rule.name,
        commissionPercentage: Number(rule.commissionPercentage),
        commissionMonths: Number(rule.commissionMonths),
        vatRate: Number(rule.vatRate),
        freeMonthsForDoctor: Number(rule.freeMonthsForDoctor),
        graceDaysForDoctor: Number(rule.graceDaysForDoctor),
        minPayoutAmountMxn: Number(rule.minPayoutAmountMxn),
      });
      toast.success('Configuración guardada');
      load();
    } catch (e) { toast.error(e.message); }
  };

  if (!rule) return <p className="text-sm text-gray-500">Cargando…</p>;

  const field = (label, key, hint) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="number" step="any" value={rule[key]} onChange={(e) => setRule({ ...rule, [key]: e.target.value })} className="border rounded px-3 py-2 w-full" />
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Regla de comisión</h2>
      <p className="text-sm text-gray-600 mb-4">La comisión se calcula sobre la <strong>base sin IVA</strong> del pago, no sobre el monto con IVA.</p>
      <div className="grid sm:grid-cols-2 gap-4 bg-white border rounded-lg p-4">
        {field('% de comisión', 'commissionPercentage', 'Porcentaje sobre la base sin IVA')}
        {field('Meses de comisión', 'commissionMonths', 'Cuántos pagos generan comisión por doctor')}
        {field('IVA (decimal, ej. 0.16)', 'vatRate', '0.16 = 16%')}
        {field('Meses gratis al doctor', 'freeMonthsForDoctor')}
        {field('Días de gracia al doctor', 'graceDaysForDoctor')}
        {field('Umbral mínimo de pago (MXN)', 'minPayoutAmountMxn', 'Monto acumulado mínimo antes de transferir a un afiliado (evita envíos pequeños). Es informativo, no bloquea.')}
        <button onClick={save} className="sm:col-span-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">Guardar configuración</button>
      </div>
    </div>
  );
};

const AdminAfiliados = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState('afiliados');

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard/dashboard" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-700 font-medium">Admin</span>
        <span className="mx-1">/</span>
        <span className="text-blue-800 font-semibold">Afiliados comerciales</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Afiliados comerciales (comisionistas)</h1>

      <div className="border-b mb-6 flex gap-1">
        <TabButton active={tab === 'afiliados'} onClick={() => setTab('afiliados')}>Afiliados</TabButton>
        <TabButton active={tab === 'codigos'} onClick={() => setTab('codigos')}>Códigos</TabButton>
        <TabButton active={tab === 'comisiones'} onClick={() => setTab('comisiones')}>Comisiones</TabButton>
        <TabButton active={tab === 'config'} onClick={() => setTab('config')}>Configuración</TabButton>
      </div>

      {tab === 'afiliados' && <AfiliadosTab />}
      {tab === 'codigos' && <CodigosTab />}
      {tab === 'comisiones' && <ComisionesTab />}
      {tab === 'config' && <ConfigTab />}
    </div>
  );
};

export default AdminAfiliados;
