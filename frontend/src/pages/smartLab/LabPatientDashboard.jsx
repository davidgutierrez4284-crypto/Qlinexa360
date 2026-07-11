import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabHealthDashboard from '../../components/smartLab/LabHealthDashboard';
import LabAlertsPanel from '../../components/smartLab/LabAlertsPanel';
import LabProcessingStatus from '../../components/smartLab/LabProcessingStatus';
import {
  dismissLabAlert,
  getPatientLabAlerts,
  getPatientLabDashboard,
  listPatientReports,
} from '../../services/smartLabService';
import { formatLabReportListTitle, labReportListTitleClassName } from '../../utils/labReportDisplay';
import Loader from '../../components/common/Loader';

const LabPatientDashboard = ({ patientId, showHeader = true, compact = false }) => {
  const [dashboard, setDashboard] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState(null);

  const load = async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [dashRes, alertRes, repRes] = await Promise.all([
        getPatientLabDashboard(patientId),
        getPatientLabAlerts(patientId),
        listPatientReports(patientId),
      ]);
      setDashboard(dashRes?.dashboard || []);
      setAlerts(alertRes?.alerts || []);
      setReports(repRes?.reports || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cargar panel de laboratorio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const handleDismiss = async (alertId) => {
    setDismissingId(alertId);
    try {
      await dismissLabAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      toast.error('No se pudo descartar la alerta.');
    } finally {
      setDismissingId(null);
    }
  };

  if (!patientId) {
    return <p className="text-sm text-gray-500">Selecciona un paciente.</p>;
  }

  if (loading) return <Loader text="Cargando estudios de laboratorio..." />;

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">Panel de laboratorio</h1>
          <Link to={'/dashboard/laboratorio-inteligente/paciente/' + patientId + '/comparar'} className="text-sm text-blue-600 hover:underline">
            Comparar estudios
          </Link>
        </div>
      ) : null}
      <LabDisclaimer />
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Resumen por categoría</h2>
        <LabHealthDashboard scores={dashboard} />
      </section>
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Alertas</h2>
        <LabAlertsPanel alerts={alerts} onDismiss={handleDismiss} dismissingId={dismissingId} />
      </section>
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Estudios</h2>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {reports.map((r) => {
            const listTitle = formatLabReportListTitle(r);
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className={labReportListTitleClassName(listTitle)} title={listTitle}>
                    {listTitle}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <LabProcessingStatus status={r.extractionStatus} />
                  <Link to={'/dashboard/laboratorio-inteligente/reportes/' + r.id} className="text-sm text-blue-600 hover:underline whitespace-nowrap">
                    Ver
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default LabPatientDashboard;

