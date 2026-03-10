import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getMyConsultations } from '../services/patientService';

const usePatientMedicalRecords = (clinicalCaseId = null) => {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clinicalCaseIdState, setClinicalCaseIdState] = useState(clinicalCaseId);

  // Cargar consultas del paciente
  const loadMedicalRecords = async () => {
    try {
      console.log('=== usePatientMedicalRecords: loadMedicalRecords ===');
      console.log('clinicalCaseIdState:', clinicalCaseIdState);
      
      setLoading(true);
      setError(null);
      
      const params = {};
      if (clinicalCaseIdState) {
        params.clinicalCaseId = clinicalCaseIdState;
      }
      
      console.log('Parámetros enviados:', params);
      const data = await getMyConsultations(params);
      console.log('Datos recibidos:', data);
      
      setMedicalRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error en usePatientMedicalRecords:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error al cargar las consultas';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Funciones dummy para compatibilidad con useMedicalRecords
  const createMedicalRecord = async () => {
    toast.error('Los pacientes no pueden crear consultas');
    throw new Error('Los pacientes no pueden crear consultas');
  };

  const updateMedicalRecord = async () => {
    toast.error('Los pacientes no pueden actualizar consultas');
    throw new Error('Los pacientes no pueden actualizar consultas');
  };

  const deleteMedicalRecord = async () => {
    toast.error('Los pacientes no pueden eliminar consultas');
    throw new Error('Los pacientes no pueden eliminar consultas');
  };

  const setClinicalCaseId = (id) => {
    setClinicalCaseIdState(id);
  };

  useEffect(() => {
    // Solo cargar si hay un clinicalCaseId o si no se ha especificado ninguno
    if (clinicalCaseIdState !== undefined) {
      loadMedicalRecords();
    }
    // eslint-disable-next-line
  }, [clinicalCaseIdState]);

  return {
    medicalRecords,
    loading,
    error,
    isSubmitting: false, // Los pacientes no pueden crear/editar consultas
    clinicalCaseId: clinicalCaseIdState,
    setClinicalCaseId,
    createMedicalRecord,
    updateMedicalRecord,
    deleteMedicalRecord,
    refreshMedicalRecords: loadMedicalRecords
  };
};

export default usePatientMedicalRecords;
