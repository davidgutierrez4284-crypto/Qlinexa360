import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import BasicConsultationForm from '../components/medical/BasicConsultationForm';
import ConsultationAttachmentsForm from '../components/medical/ConsultationAttachmentsForm';
import { getApiUrl } from '../utils/api';
import { getPatientDetails } from '../services/doctorService';
import { saveDoctorFormData } from '../services/doctorFormTemplateService';

/**
 * Página completa para registrar una nueva consulta.
 * Recomendada por doctores para evitar saltos al escribir en formularios largos.
 */
const NewConsultationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientId = searchParams.get('patientId');
  const clinicalCaseId = searchParams.get('clinicalCaseId');

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [consultationId, setConsultationId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!patientId) {
      toast.error('Falta el ID del paciente');
      navigate('/dashboard/medical-records');
      return;
    }
    const load = async () => {
      try {
        const data = await getPatientDetails(patientId);
        setPatient(data);
      } catch (err) {
        toast.error('Error al cargar datos del paciente');
        navigate('/dashboard/medical-records');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId, navigate]);

  const handleCreateBasicConsultation = async (data) => {
    try {
      setIsSubmitting(true);
      const response = await fetch(getApiUrl('/api/consultations/basic'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          patientId,
          clinicalCaseId: clinicalCaseId || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        const consultationId = result.data.id;
        setConsultationId(consultationId);

        // Guardar datos de formularios personalizados del doctor si existen
        const doctorCustomFormData = data.doctorCustomFormData || [];
        if (doctorCustomFormData.length > 0 && patientId) {
          try {
            await Promise.all(
              doctorCustomFormData.map(({ templateId, data: formData }) =>
                saveDoctorFormData(consultationId, templateId, patientId, formData)
              )
            );
          } catch (err) {
            console.error('Error al guardar formularios personalizados:', err);
            toast.warning('Consulta creada, pero hubo un error al guardar algunos datos personalizados.');
          }
        }

        toast.success('Consulta básica creada. Ahora agrega archivos (opcional).');
        setStep(2);
      } else {
        let errorMessage = 'Error al crear la consulta';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (_) {}
        toast.error(errorMessage, { autoClose: 8000 });
        throw new Error(errorMessage);
      }
    } catch (error) {
      toast.error(error.message || 'Error de conexión');
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAttachments = async () => {
    toast.success('Consulta registrada exitosamente.');
    window.location.href = `${window.location.origin}/dashboard/medical-records?patientId=${patientId}${clinicalCaseId ? `&clinicalCaseId=${clinicalCaseId}` : ''}`;
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setConsultationId(null);
    } else {
      // Usar window.location para garantizar que funcione en pestaña nueva (target="_blank")
      const qs = `patientId=${patientId}${clinicalCaseId ? `&clinicalCaseId=${clinicalCaseId}` : ''}`;
      window.location.href = `${window.location.origin}/dashboard/medical-records?${qs}`;
    }
  };

  if (loading || !patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Paciente';
  const selectedCase = patient.clinicalCases?.find(c => c.id === clinicalCaseId);
  const padecimiento = selectedCase?.padecimiento || null;

  return (
    <div className="flex flex-col bg-gray-50 min-h-0 flex-1" style={{ overflowAnchor: 'none' }}>
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              {step === 1 ? 'Volver al historial' : 'Volver al formulario'}
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              Nueva Consulta — {patientName}
              {padecimiento && <span className="text-gray-600 font-normal"> ({padecimiento})</span>}
            </h1>
            <div className="w-24" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4" style={{ WebkitOverflowScrolling: 'touch', overflowAnchor: 'none', contain: 'layout' }}>
        <div className="max-w-4xl mx-auto pb-8">
        {step === 1 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <BasicConsultationForm
              isOpen={true}
              asFullPage={true}
              onClose={handleBack}
              onSubmit={handleCreateBasicConsultation}
              patientName={patientName}
              padecimiento={padecimiento}
            />
          </div>
        ) : (
          <ConsultationAttachmentsForm
            isOpen={true}
            asFullPage={true}
            onClose={() => { window.location.href = `${window.location.origin}/dashboard/medical-records?patientId=${patientId}${clinicalCaseId ? `&clinicalCaseId=${clinicalCaseId}` : ''}`; }}
            onSubmit={handleAddAttachments}
            consultationId={consultationId}
            patientId={patientId}
            patientName={patientName}
            padecimiento={padecimiento}
            patient={patient}
            clinicalCase={selectedCase}
          />
        )}
        </div>
      </div>
    </div>
  );
};

export default NewConsultationPage;
