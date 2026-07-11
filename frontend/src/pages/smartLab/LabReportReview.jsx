import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabStudySummary from '../../components/smartLab/LabStudySummary';
import LabReviewTable, { hasDoubtfulRows, mapRowsToCorrections } from '../../components/smartLab/LabReviewTable';
import { confirmLabReport, getLabReport, patchLabReportResults, processLabReport, rejectLabReport } from '../../services/smartLabService';
import Loader from '../../components/common/Loader';

const REVIEW_THRESHOLD = Number(import.meta.env.VITE_SMART_LAB_REVIEW_THRESHOLD ?? 0.9);

const LabReportReview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { report: r } = await getLabReport(id);
      setReport(r);
      setRows(r?.results || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo cargar el reporte.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const saveDraft = async () => {
    setSaving(true);
    try {
      const { report: r } = await patchLabReportResults(id, mapRowsToCorrections(rows));
      setReport(r);
      toast.success('Cambios guardados.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (hasDoubtfulRows(rows, REVIEW_THRESHOLD)) {
      const ok = window.confirm(
        'Hay indicadores con baja confianza o errores de validación. ¿Confirmar de todos modos?'
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await confirmLabReport(id, mapRowsToCorrections(rows));
      toast.success('Reporte confirmado.');
      navigate('/dashboard/laboratorio-inteligente/reportes/' + id);
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo confirmar.');
    } finally {
      setSaving(false);
    }
  };

  const reprocess = async () => {
    setSaving(true);
    try {
      const { report: r } = await processLabReport(id);
      setReport(r);
      setRows(r?.results || []);
      toast.success('Reprocesado.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al reprocesar.');
    } finally {
      setSaving(false);
    }
  };

  const reject = async () => {
    const reason = window.prompt('Motivo del rechazo (opcional):') || undefined;
    setSaving(true);
    try {
      await rejectLabReport(id, reason);
      toast.success('Reporte rechazado.');
      navigate('/dashboard/laboratorio-inteligente');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al rechazar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  const trace = report?.extractionTraceJson;
  const needsDetailedReview =
    typeof report?.extractionConfidence === 'number' && report.extractionConfidence < REVIEW_THRESHOLD;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Revisión de reporte</h1>
        <Link to="/dashboard/laboratorio-inteligente" className="text-sm text-blue-600 hover:underline">Volver</Link>
      </div>
      <LabDisclaimer />
      {needsDetailedReview ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Revisión detallada recomendada: la confianza global del reporte está por debajo del umbral (
          {Math.round(REVIEW_THRESHOLD * 100)}%).
        </div>
      ) : null}
      <LabStudySummary report={report} />
      {trace ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 space-y-1">
          <p>
            <span className="font-medium text-gray-800">Motor:</span> {report?.parserUsed || trace.parserUsed}
            {' · '}
            <span className="font-medium text-gray-800">Laboratorio detectado:</span> {report?.classifiedVendor || trace.classifiedVendor}
            {' · '}
            <span className="font-medium text-gray-800">Filas:</span> {trace.rowCount}
            {' · '}
            <span className="font-medium text-gray-800">Procesamiento:</span> {trace.processingMs} ms
          </p>
          {trace.rowsWithValidationErrors > 0 ? (
            <p className="text-amber-800">{trace.rowsWithValidationErrors} fila(s) con advertencias de validación clínica.</p>
          ) : null}
        </div>
      ) : null}
      <LabReviewTable results={rows} editable onChange={setRows} reviewThreshold={REVIEW_THRESHOLD} />
      <div>
        <button
          type="button"
          className="text-sm text-gray-600 hover:text-gray-900 underline"
          onClick={() => setShowRawText((v) => !v)}
        >
          {showRawText ? 'Ocultar texto extraído' : 'Ver texto extraído del PDF'}
        </button>
        {showRawText ? (
          <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 whitespace-pre-wrap">
            {report?.rawText || 'Sin texto almacenado.'}
          </pre>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={saveDraft} disabled={saving} className="px-4 py-2 rounded-md bg-white border border-gray-300 text-sm font-medium hover:bg-gray-50">Guardar borrador</button>
        <button type="button" onClick={confirm} disabled={saving} className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Confirmar reporte</button>
        <button type="button" onClick={reprocess} disabled={saving} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Reprocesar PDF</button>
        <button type="button" onClick={reject} disabled={saving} className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">Rechazar</button>
      </div>
    </div>
  );
};

export default LabReportReview;
