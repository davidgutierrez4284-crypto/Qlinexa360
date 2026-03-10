import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import medicalService from '../services/medicalService';

const useMedicalRecords = (patientId, options = {}) => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clinicalCaseId, setClinicalCaseId] = useState(null);

  // Cargar notas clínicas
  const loadMedicalRecords = async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      // Incluir clinicalCaseId en los parámetros si está disponible
      const queryParams = {
        ...params,
        ...(clinicalCaseId && { clinicalCaseId })
      };
      const data = await medicalService.getMedicalRecords(patientId, queryParams);
      // La respuesta ahora es directamente un array de registros médicos
      setMedicalRecords(Array.isArray(data) ? data : []);
      setPagination(null); // Ya no tenemos paginación en la respuesta
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al cargar las notas clínicas';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Crear nueva nota clínica
  const createMedicalRecord = async (recordData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const newRecord = await medicalService.createMedicalRecord(patientId, recordData);
      setMedicalRecords(prev => [newRecord, ...prev]);
      // Refrescar el historial automáticamente
      await loadMedicalRecords();
      toast.success('Nota clínica creada exitosamente');
      return newRecord;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al crear la nota clínica';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actualizar nota clínica
  const updateMedicalRecord = async (recordId, recordData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await medicalService.updateMedicalRecord(patientId, recordId, recordData);
      setMedicalRecords(prev => prev.map(r => r.id === recordId ? updated.medicalRecord || updated : r));
      toast.success('Nota clínica actualizada');
      return updated;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al actualizar la nota clínica';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar nota clínica
  const deleteMedicalRecord = async (recordId) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await medicalService.deleteMedicalRecord(patientId, recordId);
      setMedicalRecords(prev => prev.filter(r => r.id !== recordId));
      toast.success('Nota clínica eliminada');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al eliminar la nota clínica';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    console.log('=== HOOK: useEffect triggered ===');
    console.log('patientId:', patientId);
    console.log('clinicalCaseId:', clinicalCaseId);
    console.log('options.params:', options.params);
    
    if (patientId && clinicalCaseId) {
      console.log('Ejecutando loadMedicalRecords CON clinicalCaseId...');
      loadMedicalRecords(options.params || {});
    } else if (patientId && !clinicalCaseId) {
      console.log('Tiene patientId pero NO clinicalCaseId - NO se ejecuta loadMedicalRecords');
      // No hacer request si no hay clinicalCaseId
    } else {
      console.log('No patientId, no se ejecuta loadMedicalRecords');
    }
    console.log('=== FIN HOOK ===');
    // eslint-disable-next-line
  }, [patientId, clinicalCaseId]);

  return {
    medicalRecords,
    pagination,
    loading,
    error,
    isSubmitting,
    createMedicalRecord,
    updateMedicalRecord,
    deleteMedicalRecord,
    refreshMedicalRecords: loadMedicalRecords,
    setClinicalCaseId
  };
};

export default useMedicalRecords; 