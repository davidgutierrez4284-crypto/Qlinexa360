import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabUploadForm from '../../components/smartLab/LabUploadForm';

const LabUploadPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState('');

  useEffect(() => {
    if (user?.role === 'PATIENT' && user?.patientId) setPatientId(user.patientId);
    else setPatientId(searchParams.get('patientId') || '');
  }, [user, searchParams]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Subir estudio</h1>
        <Link to="/dashboard/laboratorio-inteligente" className="text-sm text-blue-600 hover:underline">Volver</Link>
      </div>
      <LabDisclaimer />
      <LabUploadForm
        patientId={patientId}
        onUploaded={(report) => {
          if (report?.extractionStatus === 'pending_review') {
            navigate('/dashboard/laboratorio-inteligente/reportes/' + report.id + '/revision');
          } else {
            navigate('/dashboard/laboratorio-inteligente/reportes/' + report.id);
          }
        }}
      />
    </div>
  );
};

export default LabUploadPage;
