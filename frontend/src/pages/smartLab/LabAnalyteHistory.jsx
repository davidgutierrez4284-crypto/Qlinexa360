import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabParameterChart from '../../components/smartLab/LabParameterChart';
import { comparePatientAnalyte } from '../../services/smartLabService';
import Loader from '../../components/common/Loader';

const LabAnalyteHistory = () => {
  const { analyteId } = useParams();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId') || '';
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { comparison: c } = await comparePatientAnalyte(patientId, analyteId);
        setComparison(c);
      } catch (e) {
        toast.error(e.response?.data?.message || 'No hay suficientes estudios para el historial.');
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, analyteId]);

  if (!patientId) {
    return <p className="text-sm text-amber-700">Falta patientId en la URL (?patientId=).</p>;
  }

  if (loading) return <Loader />;

  const analyte = comparison?.analyte;
  const points = comparison?.points || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Historial de analito</h1>
        <Link to={'/dashboard/laboratorio-inteligente/paciente/' + patientId + '/dashboard'} className="text-sm text-blue-600 hover:underline">Panel</Link>
      </div>
      <LabDisclaimer />
      {analyte ? <p className="text-gray-700">{analyte.name} — {analyte.category}</p> : null}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <LabParameterChart
          points={points}
          referenceLow={analyte?.defaultReferenceLow}
          referenceHigh={analyte?.defaultReferenceHigh}
          unit={analyte?.defaultUnit}
          title={analyte?.name}
        />
      </div>
    </div>
  );
};

export default LabAnalyteHistory;
