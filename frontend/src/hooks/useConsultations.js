import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import medicalService from '../services/medicalService';

const useConsultations = (patientId) => {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cargar consultas
  const loadConsultations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await medicalService.getPatientConsultations(patientId);
      setConsultations(data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al cargar las consultas';
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Crear nueva consulta
  const createConsultation = async (consultationData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Validar datos antes de enviar
      if (!consultationData.diagnosis?.trim()) {
        throw new Error('El diagnóstico es requerido');
      }

      // Crear FormData para los archivos
      const formData = new FormData();
      formData.append('diagnosis', consultationData.diagnosis);
      formData.append('notes', consultationData.notes || '');
      formData.append('prescription', consultationData.prescription || '');

      // Agregar archivos
      if (consultationData.documents?.length > 0) {
        consultationData.documents.forEach((file, index) => {
          formData.append(`documents`, file);
        });
      }

      const newConsultation = await medicalService.createConsultation(patientId, formData);
      setConsultations(prev => [newConsultation, ...prev]);

      toast.success('Consulta creada exitosamente', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      return newConsultation;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al crear la consulta';
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cargar consultas al montar el componente
  useEffect(() => {
    if (patientId) {
      loadConsultations();
    }
  }, [patientId]);

  return {
    consultations,
    loading,
    error,
    isSubmitting,
    createConsultation,
    refreshConsultations: loadConsultations
  };
};

export default useConsultations; 