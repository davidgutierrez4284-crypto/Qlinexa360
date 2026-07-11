import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl, getApiHeaders } from '../utils/api';
import { toast } from 'react-toastify';

const CATEGORIES = [
  { id: 'system_access', label: 'Logs de acceso al sistema (AccessLog)' },
  { id: 'clinical_record_access', label: 'Accesos a expediente / módulo clínico' },
  { id: 'file_clinical_access', label: 'Accesos a archivos clínicos' },
  { id: 'consent_accepted', label: 'Consentimientos aceptados (metadatos)' },
  { id: 'https_validation', label: 'Validación HTTPS (URL configurada)' },
  { id: 'login_events', label: 'Eventos de login (éxito / fallo)' },
  { id: 'medical_record_changes', label: 'Cambios relevantes en expediente (updatedAt)' },
];

async function downloadExport(format, daysBack, selected) {
  const res = await fetch(getApiUrl('/api/admin/audit-evidence/export'), {
    method: 'POST',
    headers: {
      ...getApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      format,
      daysBack,
      categories: selected.length ? selected : CATEGORIES.map((c) => c.id),
    }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.message || `Error ${res.status}`);
  }
  const sha = res.headers.get('X-Audit-Evidence-Sha256');
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  const m = cd && cd.match(/filename="([^"]+)"/);
  const name = m ? m[1] : `audit-evidence.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  if (sha) toast.success(`Exportación lista. SHA-256: ${sha.slice(0, 16)}…`);
}

const AdminAuditEvidence = () => {
  const { user } = useAuth();
  const [daysBack, setDaysBack] = useState(30);
  const [selected, setSelected] = useState(() => CATEGORIES.map((c) => c.id));
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/admin/audit-evidence/exports'), {
        headers: getApiHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.exports || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard/dashboard" replace />;
  }

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const run = async (format) => {
    if (!selected.length) {
      toast.error('Selecciona al menos un tipo de evidencia.');
      return;
    }
    setLoading(true);
    try {
      await downloadExport(format, daysBack, selected);
      await loadHistory();
    } catch (e) {
      toast.error(e.message || 'Error al generar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <nav className="text-sm text-gray-500 mb-2">
        <span className="text-gray-700 font-medium">Admin</span>
        <span className="mx-1">/</span>
        <span className="text-gray-700 font-medium">Auditoría</span>
        <span className="mx-1">/</span>
        <span className="text-blue-800 font-semibold">Evidencias</span>
      </nav>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Evidencia de producción (anonimizada)</h1>
      <p className="text-gray-600 mb-6 text-sm leading-relaxed">
        Genera exportaciones reales desde la base de datos y trazas de login, con datos personales y clínicos
        enmascarados o excluidos. Cada descarga queda registrada con hash SHA-256 del archivo. Solo rol{' '}
        <strong>ADMIN</strong>.
      </p>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-1">Días hacia atrás</label>
        <input
          type="number"
          min={1}
          max={365}
          value={daysBack}
          onChange={(e) => setDaysBack(Number(e.target.value) || 30)}
          className="border rounded px-3 py-2 w-32 mb-6"
        />

        <h2 className="text-lg font-semibold text-gray-800 mb-3">Tipos de evidencia</h2>
        <div className="grid sm:grid-cols-2 gap-2 mb-6">
          {CATEGORIES.map((c) => (
            <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="mt-1"
              />
              <span>{c.label}</span>
            </label>
          ))}
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-3">Descargar</h2>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => run('json')}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50"
          >
            JSON
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => run('csv')}
            className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
          >
            CSV
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => run('pdf')}
            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50"
          >
            PDF
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          HTTPS: se usa la variable de entorno <code className="bg-gray-100 px-1">AUDIT_EVIDENCE_HTTPS_URL</code> o,
          si no existe, <code className="bg-gray-100 px-1">FRONTEND_URL</code>.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Historial de generaciones</h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">Aún no hay exportaciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Ambiente</th>
                  <th className="py-2 pr-4">Formato</th>
                  <th className="py-2 pr-4">Días</th>
                  <th className="py-2 pr-4">SHA-256 archivo</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString('es-MX')}
                    </td>
                    <td className="py-2 pr-4">{row.environment}</td>
                    <td className="py-2 pr-4 uppercase">{row.format}</td>
                    <td className="py-2 pr-4">{row.daysBack}</td>
                    <td className="py-2 pr-4 font-mono text-xs break-all">{row.fileSha256}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAuditEvidence;
