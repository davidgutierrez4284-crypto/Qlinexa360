import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabStudySummary from '../../components/smartLab/LabStudySummary';
import LabReviewTable from '../../components/smartLab/LabReviewTable';
import { deleteLabReport, downloadLabReportPdf, getLabReport } from '../../services/smartLabService';
import Loader from '../../components/common/Loader';

const LabReportDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { report: r } = await getLabReport(id);
        setReport(r);
      } catch (e) {
        toast.error(e.response?.data?.message || 'No se pudo cargar el reporte.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);


  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLabReport(id);
      toast.success('Estudio eliminado.');
      navigate('/dashboard/laboratorio-inteligente');
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo eliminar el estudio.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const download = async () => {
    try {
      const { url } = await downloadLabReportPdf(id);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('No se pudo descargar el PDF.');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">Detalle del reporte</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={download} className="text-sm text-blue-600 hover:underline">Descargar PDF</button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1 p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label="Eliminar estudio"
            title="Eliminar estudio"
          >
            <TrashIcon className="h-5 w-5" aria-hidden />
            <span className="text-sm">Eliminar</span>
          </button>
          {report?.extractionStatus === 'pending_review' ? (
            <Link to={'/dashboard/laboratorio-inteligente/reportes/' + id + '/revision'} className="text-sm text-amber-700 hover:underline">Ir a revisión</Link>
          ) : null}
          <Link to="/dashboard/laboratorio-inteligente" className="text-sm text-gray-600 hover:underline">Volver</Link>
        </div>
      </div>
      <LabDisclaimer />
      <LabStudySummary report={report} />
      <LabReviewTable results={report?.results || []} editable={false} />

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-report-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 id="delete-report-title" className="text-lg font-semibold text-gray-900 mb-2">Eliminar estudio</h3>
            <p className="text-sm text-gray-600 mb-6">¿Eliminar este estudio? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </button>
              <button type="button" className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LabReportDetail;
