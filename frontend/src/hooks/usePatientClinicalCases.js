import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getMyClinicalCases } from '../services/patientService';

const usePatientClinicalCases = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);

  // Listar casos clínicos del paciente
  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyClinicalCases();
      setCases(data);
      
      // Si hay casos clínicos, seleccionar el primero por defecto
      if (data && data.length > 0 && !selectedCase) {
        setSelectedCase(data[0]);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Error al cargar los casos clínicos';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCases();
    // eslint-disable-next-line
  }, []);

  // Funciones dummy para compatibilidad con useClinicalCases
  const createCase = async () => {
    toast.error('Los pacientes no pueden crear casos clínicos');
    throw new Error('Los pacientes no pueden crear casos clínicos');
  };

  const updateCase = async () => {
    toast.error('Los pacientes no pueden actualizar casos clínicos');
    throw new Error('Los pacientes no pueden actualizar casos clínicos');
  };

  const deleteCase = async () => {
    toast.error('Los pacientes no pueden eliminar casos clínicos');
    throw new Error('Los pacientes no pueden eliminar casos clínicos');
  };

  return {
    cases,
    loading,
    error,
    isSubmitting: false, // Los pacientes no pueden crear/editar casos
    selectedCase,
    setSelectedCase,
    createCase,
    updateCase,
    deleteCase,
    refreshCases: loadCases
  };
};

export default usePatientClinicalCases;
