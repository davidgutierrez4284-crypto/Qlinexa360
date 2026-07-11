import React, { useState } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import { uploadLabReport } from '../../services/smartLabService';

const LabUploadForm = ({ patientId, onUploaded }) => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!patientId) {
      toast.warn('Selecciona un paciente.');
      return;
    }
    if (!file) {
      toast.warn('Selecciona un archivo PDF.');
      return;
    }
    if (file.type && file.type !== 'application/pdf') {
      toast.warn('Solo se permiten archivos PDF.');
      return;
    }
    setLoading(true);
    setProgress(0);
    try {
      const data = await uploadLabReport(patientId, file, (ev) => {
        if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
      });
      toast.success('Reporte subido y procesado.');
      setFile(null);
      onUploaded?.(data?.report || data);
    } catch (err) {
      const msg = err.response?.data?.message || 'No se pudo subir el reporte.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Subir estudio de laboratorio (PDF)</h3>
      <p className="text-sm text-gray-600 mb-4">El sistema extraerá los resultados automáticamente para revisión.</p>
      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
        <CloudArrowUpIcon className="h-10 w-10 text-gray-400 mb-2" />
        <span className="text-sm text-gray-600">{file ? file.name : 'Haz clic o arrastra un PDF'}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      {loading && progress > 0 ? (
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: progress + '%' }} />
        </div>
      ) : null}
      <button
        type="submit"
        disabled={loading || !patientId}
        className="mt-4 inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Subiendo...' : 'Subir y procesar'}
      </button>
    </form>
  );
};

export default LabUploadForm;
