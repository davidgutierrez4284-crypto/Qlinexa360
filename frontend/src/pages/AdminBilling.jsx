import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  InformationCircleIcon, PlusIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronRightIcon,
  DocumentArrowDownIcon, TrashIcon, EnvelopeIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getApiHeaders } from '../utils/api';
import { TAX_REGIME_LABELS, TAX_REGIME_OPTIONS } from '../constants/taxRegimes';

const money = (n, currency = 'MXN') =>
  `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

async function apiGet(path) {
  const res = await fetch(getApiUrl(path), { headers: getApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}
async function apiSendForm(path, formData) {
  const res = await fetch(getApiUrl(path), { method: 'POST', headers: getApiHeaders(), body: formData });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}
async function apiDelete(path) {
  const res = await fetch(getApiUrl(path), { method: 'DELETE', headers: getApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}
async function apiPost(path) {
  const res = await fetch(getApiUrl(path), { method: 'POST', headers: getApiHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}
async function apiPutJson(path, body) {
  const res = await fetch(getApiUrl(path), {
    method: 'PUT',
    headers: { ...getApiHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
  return json;
}

const SubStatusBadge = ({ status }) => {
  if (!status) return <span className="text-xs text-gray-400">Sin suscripción</span>;
  const map = {
    ACTIVE: 'bg-green-100 text-green-800',
    TRIAL: 'bg-indigo-100 text-indigo-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-700',
    EXPIRED: 'bg-gray-100 text-gray-700',
  };
  const labels = { ACTIVE: 'Activa', TRIAL: 'En prueba', SUSPENDED: 'Suspendida', CANCELLED: 'Cancelada', EXPIRED: 'Expirada' };
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-700'}`}>{labels[status] || status}</span>;
};

const EditTaxModal = ({ doctor, onClose, onSaved }) => {
  const t = doctor.tax || {};
  const [taxName, setTaxName] = useState(t.taxName || '');
  const [taxId, setTaxId] = useState(t.taxId || '');
  const [taxAddress, setTaxAddress] = useState(t.taxAddress || '');
  const [taxPostalCode, setTaxPostalCode] = useState(t.taxPostalCode || '');
  const [taxRegime, setTaxRegime] = useState(t.taxRegime || '');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiPutJson(`/api/admin/billing/doctors/${doctor.id}/tax`, { taxName, taxId, taxAddress, taxPostalCode, taxRegime });
      toast.success('Datos fiscales actualizados');
      onSaved({ taxName, taxId, taxAddress, taxPostalCode, taxRegime });
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">Datos fiscales del doctor</h3>
        <p className="text-xs text-gray-500 mb-4">Dr(a). {doctor.firstName} {doctor.lastName}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razón social</label>
            <input type="text" value={taxName} onChange={(e) => setTaxName(e.target.value)} className="border rounded px-3 py-2 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value.toUpperCase())} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">C.P. fiscal</label>
              <input type="text" value={taxPostalCode} onChange={(e) => setTaxPostalCode(e.target.value)} maxLength={10} className="border rounded px-3 py-2 w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección fiscal</label>
            <input type="text" value={taxAddress} onChange={(e) => setTaxAddress(e.target.value)} className="border rounded px-3 py-2 w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Régimen fiscal</label>
            <select value={taxRegime} onChange={(e) => setTaxRegime(e.target.value)} className="border rounded px-3 py-2 w-full bg-white">
              <option value="">Selecciona…</option>
              {TAX_REGIME_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddInvoiceModal = ({ doctor, onClose, onSaved }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [notes, setNotes] = useState('');
  const [pdf, setPdf] = useState(null);
  const [xml, setXml] = useState(null);
  const [loading, setLoading] = useState(false);

  const amountNum = Number(amount || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!invoiceDate) return toast.error('Indica la fecha de la factura');
    if (amount === '' || Number.isNaN(amountNum) || amountNum < 0) return toast.error('Importe inválido (usa 0 para meses sin cobro)');
    if (amountNum > 0 && !pdf) return toast.error('Adjunta el PDF de la factura cuando hay cobro');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('doctorId', doctor.id);
      fd.append('invoiceDate', invoiceDate);
      fd.append('amount', String(amountNum));
      fd.append('currency', currency);
      if (notes) fd.append('notes', notes);
      if (pdf) fd.append('pdf', pdf);
      if (xml) fd.append('xml', xml);
      await apiSendForm('/api/admin/billing/invoices', fd);
      toast.success('Factura registrada');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-1">Añadir factura</h3>
        <p className="text-xs text-gray-500 mb-4">Para Dr(a). {doctor.firstName} {doctor.lastName} · RFC: {doctor.tax?.taxId || '—'}</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de factura</label>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="border rounded px-3 py-2 w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Importe ({currency})</label>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="border rounded px-3 py-2 w-full" />
              <p className="text-[11px] text-gray-500 mt-1">Mes gratis/promoción = 0.</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="border rounded px-3 py-2 w-full">
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF {amountNum > 0 && <span className="text-red-500">*</span>}</label>
            <input type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)} className="block w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Archivo XML (CFDI, opcional)</label>
            <input type="file" accept=".xml,text/xml,application/xml" onChange={(e) => setXml(e.target.files?.[0] || null)} className="block w-full text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas (opcional)</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. Mes promocional, sin cobro" className="border rounded px-3 py-2 w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Guardando…' : 'Guardar factura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminBilling = () => {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [invoicesByDoctor, setInvoicesByDoctor] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [modalDoctor, setModalDoctor] = useState(null);
  const [editTaxDoctor, setEditTaxDoctor] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const j = await apiGet('/api/admin/billing/doctors');
      setDoctors(j.data || []);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  const loadInvoices = useCallback(async (doctorId) => {
    setLoadingInvoices(true);
    try {
      const j = await apiGet(`/api/admin/billing/doctors/${doctorId}/invoices`);
      setInvoicesByDoctor((prev) => ({ ...prev, [doctorId]: j.data || [] }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard/dashboard" replace />;
  }

  const toggle = (doctorId) => {
    if (expandedId === doctorId) { setExpandedId(null); return; }
    setExpandedId(doctorId);
    if (!invoicesByDoctor[doctorId]) loadInvoices(doctorId);
  };

  const download = (url) => { if (url) window.open(getApiUrl(url), '_blank'); };

  const sendEmail = async (invoiceId, doctorId) => {
    setSendingId(invoiceId);
    try {
      const j = await apiPost(`/api/admin/billing/invoices/${invoiceId}/send-email`);
      toast.success(j.message || 'Factura enviada');
      loadInvoices(doctorId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSendingId(null);
    }
  };

  const removeInvoice = async (invoiceId, doctorId) => {
    if (!window.confirm('¿Eliminar esta factura? Esta acción no se puede deshacer.')) return;
    try {
      await apiDelete(`/api/admin/billing/invoices/${invoiceId}`);
      toast.success('Factura eliminada');
      loadInvoices(doctorId);
      loadDoctors();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const filtered = doctors.filter((d) =>
    `${d.firstName} ${d.lastName} ${d.tax?.taxId || ''} ${d.email || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-3xl font-bold text-gray-900">Relación de facturación</h1>
        <InformationCircleIcon className="w-6 h-6 text-gray-400" title="Facturas de la suscripción que emites a cada doctor" />
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Aquí registras y envías las facturas de la <strong>suscripción</strong> a cada doctor (los usuarios de paga).
        Solo factura cuando hay un pago real; los meses gratis o de promoción regístralos con importe <strong>$0.00</strong>.
      </p>

      <div className="relative mb-5">
        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, RFC o correo del doctor…"
          className="w-full border rounded-lg pl-10 pr-4 py-3"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">Sin doctores que coincidan.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const expanded = expandedId === d.id;
            const invoices = invoicesByDoctor[d.id] || [];
            const tax = d.tax || {};
            const hasTax = tax.taxName || tax.taxId || tax.taxAddress || tax.taxPostalCode || tax.taxRegime;
            return (
              <div key={d.id} className="bg-white border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50" onClick={() => toggle(d.id)}>
                  <div className="flex items-center gap-3">
                    {expanded ? <ChevronDownIcon className="w-5 h-5 text-gray-400" /> : <ChevronRightIcon className="w-5 h-5 text-gray-400" />}
                    <div>
                      <div className="font-semibold text-gray-900">Dr(a). {d.firstName} {d.lastName}</div>
                      <div className="text-xs text-gray-500">{d.email} · {d.specialization}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SubStatusBadge status={d.subscriptionStatus} />
                    <span className="text-xs text-gray-400">{d.invoicesCount} factura(s)</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setModalDoctor(d); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <PlusIcon className="w-4 h-4" /> Añadir factura
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">Datos fiscales</h4>
                        <button onClick={() => setEditTaxDoctor(d)} className="text-xs text-blue-600 hover:underline">
                          {hasTax ? 'Editar' : 'Capturar datos fiscales'}
                        </button>
                      </div>
                      {hasTax ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                          {tax.taxName && <div><span className="font-medium">Razón social:</span> {tax.taxName}</div>}
                          {tax.taxId && <div><span className="font-medium">RFC:</span> {tax.taxId}</div>}
                          {tax.taxAddress && <div className="sm:col-span-2"><span className="font-medium">Dirección:</span> {tax.taxAddress}</div>}
                          {tax.taxPostalCode && <div><span className="font-medium">C.P. fiscal:</span> {tax.taxPostalCode}</div>}
                          {tax.taxRegime && <div><span className="font-medium">Régimen fiscal:</span> {TAX_REGIME_LABELS[tax.taxRegime] ? `${tax.taxRegime} - ${TAX_REGIME_LABELS[tax.taxRegime]}` : tax.taxRegime}</div>}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">Este doctor aún no tiene datos fiscales registrados.</p>
                      )}
                    </div>

                    {loadingInvoices && !invoicesByDoctor[d.id] ? (
                      <p className="text-sm text-gray-500">Cargando facturas…</p>
                    ) : invoices.length === 0 ? (
                      <p className="text-sm text-gray-500">Aún no hay facturas para este doctor.</p>
                    ) : (
                      <div className="overflow-x-auto bg-white rounded-lg border">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-gray-600">
                              <th className="py-2 px-3">Fecha</th>
                              <th className="py-2 px-3">Importe</th>
                              <th className="py-2 px-3">PDF</th>
                              <th className="py-2 px-3">XML</th>
                              <th className="py-2 px-3">Enviada</th>
                              <th className="py-2 px-3">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.map((inv) => (
                              <tr key={inv.id} className="border-b border-gray-100">
                                <td className="py-2 px-3 whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                                <td className="py-2 px-3 font-medium">{money(inv.amount, inv.currency)}</td>
                                <td className="py-2 px-3">
                                  {inv.pdfUrl
                                    ? <button onClick={() => download(inv.pdfUrl)} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><DocumentArrowDownIcon className="w-4 h-4" /> PDF</button>
                                    : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="py-2 px-3">
                                  {inv.xmlUrl
                                    ? <button onClick={() => download(inv.xmlUrl)} className="inline-flex items-center gap-1 text-blue-600 hover:underline"><DocumentArrowDownIcon className="w-4 h-4" /> XML</button>
                                    : <span className="text-gray-400">—</span>}
                                </td>
                                <td className="py-2 px-3 text-xs text-gray-500">{inv.sentAt ? fmtDate(inv.sentAt) : '—'}</td>
                                <td className="py-2 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => sendEmail(inv.id, d.id)}
                                      disabled={sendingId === inv.id || !inv.pdfUrl}
                                      title={inv.pdfUrl ? 'Enviar por correo al doctor' : 'Sube el PDF para poder enviar'}
                                      className="text-green-600 hover:text-green-800 disabled:opacity-40"
                                    >
                                      <EnvelopeIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => removeInvoice(inv.id, d.id)} title="Eliminar" className="text-red-500 hover:text-red-700">
                                      <TrashIcon className="w-5 h-5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalDoctor && (
        <AddInvoiceModal
          doctor={modalDoctor}
          onClose={() => setModalDoctor(null)}
          onSaved={() => { loadInvoices(modalDoctor.id); loadDoctors(); }}
        />
      )}

      {editTaxDoctor && (
        <EditTaxModal
          doctor={editTaxDoctor}
          onClose={() => setEditTaxDoctor(null)}
          onSaved={(tax) => setDoctors((prev) => prev.map((x) => (x.id === editTaxDoctor.id ? { ...x, tax } : x)))}
        />
      )}
    </div>
  );
};

export default AdminBilling;
