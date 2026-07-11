import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';

const PreConsutas = () => {
  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState(null);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sending, setSending] = useState(false);

  const portalUrl = useMemo(() => portal?.portalUrl || '', [portal]);

  const fetchPortal = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/clinical-intakes/portal-link', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data?.success) {
        setPortal(res.data.data);
      } else {
        toast.error(res.data?.message || 'No se pudo cargar el portal');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cargar portal');
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      const res = await axios.get('/api/clinical-intakes', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data?.success) {
        setItems(res.data.data || []);
        setLastRefreshed(new Date());
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cargar pre-consultas');
    }
  };

  useEffect(() => {
    fetchPortal();
    fetchItems();
    const interval = setInterval(fetchItems, 30000);
    const onFocus = () => fetchItems();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      toast.success('Link copiado');
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  const handleOpen = () => {
    if (!portalUrl) return;
    window.open(portalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendLink = async () => {
    if (!sendEmail || !sendEmail.includes('@')) {
      toast.error('Correo inválido');
      return;
    }
    setSending(true);
    try {
      const res = await axios.post(
        '/api/clinical-intakes/send-link',
        { patientId: null, email: sendEmail },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.data?.success) {
        const link = res.data?.data?.link;
        if (link) {
          try {
            await navigator.clipboard.writeText(link);
            toast.success('Listo. Enlace copiado.');
          } catch {
            toast.success('Listo. Enlace generado.');
          }
        } else {
          toast.success('Listo.');
        }
        setShowSendModal(false);
        setSendEmail('');
        fetchItems();
      } else {
        toast.error(res.data?.message || 'Error al enviar enlace');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al enviar enlace');
    } finally {
      setSending(false);
    }
  };

  const getPatientLabel = (it) =>
    it.patientDisplayName ||
    [it.patient?.firstName, it.patient?.lastName].filter(Boolean).join(' ').trim() ||
    'Paciente sin nombre';

  const filtered = items.filter((it) => statusFilter === 'ALL' || it.status === statusFilter);

  const statusLabel = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'En progreso';
      case 'SUBMITTED_PENDING_VALIDATION':
        return 'Enviada';
      case 'APPROVED':
        return 'Lista';
      case 'REJECTED':
        return 'Requiere cambios';
      case 'CONVERTED':
        return 'Guardada en historial';
      default:
        return status || '—';
    }
  };

  const statusBadgeClass = (status) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'SUBMITTED_PENDING_VALIDATION':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'CONVERTED':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Pre-consultas</h2>
          <p className="text-sm text-gray-600 mt-1">
            Comparte el enlace con tus pacientes para que completen su información antes de la consulta.
          </p>
          {lastRefreshed && (
            <p className="text-xs text-gray-400 mt-1">
              Lista actualizada automáticamente · última vez{' '}
              {lastRefreshed.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          type="button"
          className="text-sm border rounded px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
          onClick={() => {
            fetchPortal();
            fetchItems();
          }}
          disabled={loading}
          title="Actualizar"
        >
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Cargando…</div>
      ) : (
        <div className="space-y-6">
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-gray-900">Enlace para pacientes</div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Enlace permanente: compártelo con todos tus pacientes. Cada persona que lo abra
                  iniciará una pre-consulta nueva. No necesitan iniciar sesión.
                </div>
              </div>
            </div>

            <div className="mt-3">
              <input
                className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
                value={portalUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={handleCopy}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                disabled={!portalUrl}
              >
                Copiar enlace
              </button>
              <button
                type="button"
                onClick={handleOpen}
                className="px-4 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                disabled={!portalUrl}
              >
                Ver como paciente
              </button>
              <button
                type="button"
                onClick={() => setShowSendModal(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Enviar por correo
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Filtrar por estado</label>
              <select
                className="border rounded px-2 py-1 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todas las enviadas</option>
                <option value="SUBMITTED_PENDING_VALIDATION">Enviada</option>
                <option value="APPROVED">Lista</option>
                <option value="REJECTED">Requiere cambios</option>
                <option value="CONVERTED">Guardada en historial</option>
              </select>
            </div>
            <div className="text-xs text-gray-500">{filtered.length} registro(s)</div>
          </div>

          <div className="overflow-x-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-3 py-2">Paciente</th>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2">
                      <span className="font-medium text-gray-900">{getPatientLabel(it)}</span>
                      <div className="text-xs text-gray-500">{it.patient?.email || ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadgeClass(
                          it.status
                        )}`}
                      >
                        {statusLabel(it.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <Link className="text-blue-600 hover:underline" to={`/dashboard/pre-consultas/${it.id}`}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-gray-500" colSpan={3}>
                      Aún no hay pre-consultas enviadas. Aparecerán aquí cuando un paciente complete y envíe el
                      formulario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showSendModal && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow p-5 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Enviar enlace por correo</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Escribe el correo del paciente y generaremos un registro. Si el envío automático no está habilitado en
                  este ambiente, podrás copiar el enlace desde la lista.
                </p>
                <input
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="correo@ejemplo.com"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-3 py-2 text-sm border rounded" onClick={() => setShowSendModal(false)}>
                    Cancelar
                  </button>
                  <button
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded disabled:opacity-50"
                    onClick={handleSendLink}
                    disabled={sending}
                  >
                    {sending ? 'Preparando…' : 'Enviar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PreConsutas;

