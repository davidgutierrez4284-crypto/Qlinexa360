import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import clinicalCaseService from '../services/clinicalCaseService';

const useClinicalCases = (patientId) => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Listar casos clínicos
  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clinicalCaseService.listClinicalCases(patientId);
      setCases(data);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al cargar los casos clínicos';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Crear nuevo caso clínico
  const createCase = async (caseData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const newCase = await clinicalCaseService.createClinicalCase(patientId, caseData);
      setCases(prev => [newCase, ...prev]);
      toast.success('Nuevo caso clínico creado');
      return newCase;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al crear el caso clínico';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actualizar caso clínico
  const updateCase = async (caseId, caseData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const updated = await clinicalCaseService.updateClinicalCase(caseId, caseData);
      setCases(prev => prev.map(c => c.id === caseId ? updated : c));
      toast.success('Caso clínico actualizado');
      return updated;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al actualizar el caso clínico';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar caso clínico (solo si no tiene consultas asociadas)
  const deleteCase = async (caseId) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await clinicalCaseService.deleteClinicalCase(caseId);
      setCases(prev => prev.filter(c => c.id !== caseId));
      toast.success('Caso clínico eliminado');
      if (selectedCase && selectedCase.id === caseId) {
        setSelectedCase(null);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al eliminar el caso clínico';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (patientId) loadCases();
    // eslint-disable-next-line
  }, [patientId]);

  return {
    cases,
    loading,
    error,
    isSubmitting,
    selectedCase,
    setSelectedCase,
    createCase,
    updateCase,
    deleteCase,
    refreshCases: loadCases
  };
};

export default useClinicalCases; 