import React from 'react';
import { Link, useParams } from 'react-router-dom';
import LabPatientDashboard from './LabPatientDashboard';

const LabPatientDashboardPage = () => {
  const { patientId } = useParams();
  return (
    <div>
      <Link to="/dashboard/laboratorio-inteligente" className="text-sm text-blue-600 hover:underline mb-4 inline-block">← Laboratorio Inteligente</Link>
      <LabPatientDashboard patientId={patientId} />
    </div>
  );
};

export default LabPatientDashboardPage;
