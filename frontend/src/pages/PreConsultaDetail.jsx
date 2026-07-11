import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import ClinicalIntakeFormView from '../components/medical/ClinicalIntakeFormView';

const appointmentStatusLabel = (status) => {
  switch (status) {
    case 'PENDING':
      return 'Pendiente de aprobación';
    case 'CONFIRMED':
      return 'Confirmada';
    case 'RESCHEDULED':
      return 'Reagendada';
    case 'CANCELLED':
      return 'Cancelada';
    default:
      return status || '—';
  }
};

const statusLabel = (status) => {
  switch (status) {
    case 'SUBMITTED_PENDING_VALIDATION':
      return 'Enviada — pendiente de revisión';
    case 'APPROVED':
      return 'Lista';
    case 'REJECTED':
      return 'Requiere cambios';
    case 'CONVERTED':
      return 'Guardada en historial clínico';
    default:
      return status || '—';
  }
};

const PreConsultaDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [intake, setIntake] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const patientName = useMemo(() => {
    if (intake?.patientDisplayName) return intake.patientDisplayName;
    const p = intake?.patient;
    return `${p?.firstName || 'Paciente'} ${p?.lastName || ''}`.trim();
  }, [intake]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/clinical-intakes/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.data?.success) {
        setIntake(res.data.data);
        setNotes(res.data.data?.staffNotes || '');
      } else {
        toast.error(res.data?.message || 'No se pudo cargar');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
  }, [id]);

  const handleConvert = async () => {
    if (!window.confirm('¿Guardar esta pre-consulta en el Historial Clínico?')) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `/api/clinical-intakes/${id}/convert`,
        { staffNotes: notes.trim() || undefined },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.data?.success) {
        toast.success('Guardada en Historial Clínico');
        load();
      } else {
        toast.error(res.data?.message || 'Error');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="w-full bg-white p-6 rounded-lg shadow-md">Cargando…</div>;
  }

  if (!intake) {
    return (
      <div className="w-full bg-white p-6 rounded-lg shadow-md">
        <p className="text-sm text-gray-600">No encontrado.</p>
        <Link className="text-blue-600 hover:underline text-sm" to="/dashboard/pre-consultas">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full bg-white p-6 rounded-lg shadow-md space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Detalle de pre-consulta</h2>
          <div className="text-sm text-gray-600 mt-1">
            <span className="font-medium text-gray-900">{patientName}</span>
            {' · '}
            {statusLabel(intake.status)}
          </div>
          {intake.patient?.email && (
            <div className="text-xs text-gray-500 mt-0.5">{intake.patient.email}</div>
          )}
        </div>
        <Link className="text-sm text-blue-600 hover:underline" to="/dashboard/pre-consultas">
          Volver
        </Link>
      </div>

      {(intake.consentPdfUrl || intake.consentSignedAt) && (
        <div className="border rounded-lg p-4 bg-blue-50/40 border-blue-100">
          <p className="text-sm font-medium text-gray-900 mb-2">Consentimientos firmados</p>
          <div className="text-sm text-gray-700 space-y-1">
            {intake.consentSignerName && (
              <p>
                <span className="text-gray-500">Firma:</span> {intake.consentSignerName}
              </p>
            )}
            {intake.consentSignedAt && (
              <p>
                <span className="text-gray-500">Fecha:</span>{' '}
                {new Date(intake.consentSignedAt).toLocaleString('es-MX', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              </p>
            )}
            {intake.consentIp && (
              <p>
                <span className="text-gray-500">IP:</span> {intake.consentIp}
              </p>
            )}
          </div>
          {intake.consentPdfUrl && (
            <a
              href={intake.consentPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-blue-600 hover:underline font-medium"
            >
              Ver PDF de consentimientos
            </a>
          )}
        </div>
      )}

      {intake.appointment && (
        <div className="border rounded-lg p-4 bg-emerald-50/40 border-emerald-100">
          <p className="text-sm font-medium text-gray-900 mb-1">Cita agendada vinculada</p>
          <div className="text-sm text-gray-700">
            {intake.appointment.date && (
              <span className="font-medium text-gray-900">
                {new Date(intake.appointment.date).toLocaleString('es-MX', {
                  dateStyle: 'long',
                  timeStyle: 'short'
                })}
              </span>
            )}
            {intake.appointment.confirmationStatus && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {appointmentStatusLabel(intake.appointment.confirmationStatus)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="border rounded-lg p-4">
        <p className="text-sm font-medium text-gray-800 mb-3">Datos capturados por el paciente</p>
        <ClinicalIntakeFormView
          formData={intake.formData || {}}
          formTemplates={intake.formTemplates || []}
        />
      </div>

      <div className="border rounded p-4 space-y-2">
        <p className="text-sm font-medium text-gray-800">Notas internas (solo clínica)</p>
        <p className="text-xs text-gray-500">
          Se guardan automáticamente al pulsar &quot;Guardar en Historial Clínico&quot;.
        </p>
        <textarea
          className="w-full border rounded px-3 py-2 text-sm min-h-[90px] disabled:bg-gray-50"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas para el equipo (no visibles al paciente)"
          disabled={intake.status === 'CONVERTED'}
        />
        <div className="flex justify-end pt-1">
          <button
            type="button"
            className="px-4 py-2 text-sm bg-green-600 text-white rounded disabled:opacity-50"
            onClick={handleConvert}
            disabled={saving || intake.status === 'CONVERTED'}
          >
            {intake.status === 'CONVERTED' ? 'Ya guardada en historial' : saving ? 'Guardando…' : 'Guardar en Historial Clínico'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PreConsultaDetail;
