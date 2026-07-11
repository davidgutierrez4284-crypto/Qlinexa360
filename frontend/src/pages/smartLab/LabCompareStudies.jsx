import { formatLabReportListTitle } from '../../utils/labReportDisplay';
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabStudyComparator from '../../components/smartLab/LabStudyComparator';
import { useAuth } from '../../context/AuthContext';
import { getPatientDetails } from '../../services/doctorService';
import { getMyProfile } from '../../services/patientService';
import { compareLabReports, listPatientReports } from '../../services/smartLabService';
import { hasPrintableLabComparison, printLabCompareStudy } from '../../utils/labComparePrint';
import Loader from '../../components/common/Loader';

function formatPatientDisplayName(patient) {
  if (!patient) return '—';
  const fromUser = [patient.user?.firstName, patient.user?.lastName].filter(Boolean).join(' ').trim();
  if (fromUser) return fromUser;
  return [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || '—';
}

async function resolveComparePatientName(patientId, user) {
  const isPatientView = user?.role === 'PATIENT';

  if (isPatientView) {
    try {
      return formatPatientDisplayName(await getMyProfile());
    } catch {
      const fromAuth = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
      return fromAuth || '—';
    }
  }

  if (!patientId) return '—';

  try {
    return formatPatientDisplayName(await getPatientDetails(patientId));
  } catch {
    return '—';
  }
}

const MIN_SLOTS = 4;
const MAX_SLOTS = 6;
const REPORT_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

const LabCompareStudies = () => {
  const { patientId } = useParams();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => Array(MIN_SLOTS).fill(''));
  const [comparison, setComparison] = useState(null);
  const [patientName, setPatientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [reportsRes, name] = await Promise.all([
          listPatientReports(patientId),
          resolveComparePatientName(patientId, user),
        ]);
        if (cancelled) return;
        const confirmed = (reportsRes.reports || []).filter((r) => r.extractionStatus === 'confirmed');
        setReports(confirmed);
        setPatientName(name);
      } catch {
        if (!cancelled) toast.error('No se pudieron cargar los reportes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [patientId, user?.role, user?.firstName, user?.lastName]);

  const updateSlot = (index, value) => {
    setSelectedIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addSlot = () => {
    if (selectedIds.length >= MAX_SLOTS) return;
    setSelectedIds((prev) => [...prev, '']);
  };

  const removeSlot = (index) => {
    if (selectedIds.length <= MIN_SLOTS) return;
    setSelectedIds((prev) => prev.filter((_, i) => i !== index));
  };

  const runCompare = async () => {
    const ids = selectedIds.filter(Boolean);
    if (ids.length < 2) {
      toast.warn('Selecciona al menos dos reportes confirmados.');
      return;
    }
    if (new Set(ids).size !== ids.length) {
      toast.warn('Cada reporte debe ser diferente.');
      return;
    }
    setComparing(true);
    try {
      const { comparison: c } = await compareLabReports(ids);
      setComparison(c);
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo comparar.');
      setComparison(null);
    } finally {
      setComparing(false);
    }
  };

  const canPrint = hasPrintableLabComparison(comparison);

  const handlePrint = () => {
    if (!canPrint) return;
    const ok = printLabCompareStudy({ patientName, comparison });
    if (!ok) {
      toast.error('No se pudo abrir la vista de impresión. Permite ventanas emergentes e inténtalo de nuevo.');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Comparar estudios</h1>
        <Link to={'/dashboard/laboratorio-inteligente/paciente/' + patientId + '/dashboard'} className="text-sm text-blue-600 hover:underline">Panel</Link>
      </div>
      <LabDisclaimer />
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {selectedIds.map((reportId, index) => (
            <label key={index} className="text-sm block">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Reporte {REPORT_LABELS[index]}</span>
                {selectedIds.length > MIN_SLOTS && (
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="text-xs text-gray-500 hover:text-red-600"
                    aria-label={`Quitar reporte ${REPORT_LABELS[index]}`}
                  >
                    Quitar
                  </button>
                )}
              </div>
              <select
                className="mt-1 w-full rounded-md border-gray-300"
                value={reportId}
                onChange={(e) => updateSlot(index, e.target.value)}
              >
                <option value="">—</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{formatLabReportListTitle(r)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        {selectedIds.length < MAX_SLOTS && (
          <button
            type="button"
            onClick={addSlot}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            + Agregar reporte
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={runCompare} disabled={comparing} className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
          {comparing ? 'Comparando...' : 'Comparar'}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={!canPrint}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PrinterIcon className="h-4 w-4" aria-hidden />
          Imprimir
        </button>
      </div>
      <LabStudyComparator comparison={comparison} loading={comparing} />
    </div>
  );
};

export default LabCompareStudies;
