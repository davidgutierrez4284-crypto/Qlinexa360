import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import consultationService from '../services/consultationService';

export const useDividedConsultations = (patientId, clinicalCaseId = null) => {
  // Estados principales
  const [consultations, setConsultations] = useState([]);
  const [pendingConsultations, setPendingConsultations] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    complete: 0,
    pending: 0,
    withAttachments: 0
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Estados para modales
  const [showDividedManager, setShowDividedManager] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  // Estados para formularios
  const [isCreatingBasic, setIsCreatingBasic] = useState(false);
  const [isAddingAttachments, setIsAddingAttachments] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    if (patientId) {
      loadConsultations();
      loadPendingConsultations();
      loadStats();
    }
  }, [patientId, clinicalCaseId]);

  // Cargar todas las consultas
  const loadConsultations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Aquí usarías el endpoint existente de medical records
      // Por ahora usamos el endpoint de consultas pendientes como ejemplo
      const response = await consultationService.getPendingConsultations(patientId, clinicalCaseId);
      setConsultations(response.data || []);
    } catch (error) {
      console.error('Error al cargar consultas:', error);
      setError('Error al cargar las consultas');
      toast.error('Error al cargar las consultas');
    } finally {
      setLoading(false);
    }
  }, [patientId, clinicalCaseId]);

  // Cargar consultas pendientes
  const loadPendingConsultations = useCallback(async () => {
    try {
      const response = await consultationService.getPendingConsultations(patientId, clinicalCaseId);
      setPendingConsultations(response.data || []);
    } catch (error) {
      console.error('Error al cargar consultas pendientes:', error);
    }
  }, [patientId, clinicalCaseId]);

  // Cargar estadísticas
  const loadStats = useCallback(async () => {
    try {
      const response = await consultationService.getConsultationStats(patientId, clinicalCaseId);
      setStats(response.data || {
        total: 0,
        complete: 0,
        pending: 0,
        withAttachments: 0
      });
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  }, [patientId, clinicalCaseId]);

  // Crear consulta básica
  const createBasicConsultation = useCallback(async (data) => {
    try {
      setIsCreatingBasic(true);
      
      const response = await consultationService.createBasicConsultation({
        ...data,
        patientId,
        clinicalCaseId
      });

      toast.success('Consulta básica creada exitosamente');
      
      // Recargar datos
      await loadConsultations();
      await loadPendingConsultations();
      await loadStats();

      return response.data;
    } catch (error) {
      console.error('Error al crear consulta básica:', error);
      const errorMessage = error.response?.data?.message || 'Error al crear la consulta básica';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsCreatingBasic(false);
    }
  }, [patientId, clinicalCaseId, loadConsultations, loadPendingConsultations, loadStats]);

  // Agregar archivos a consulta
  const addAttachmentsToConsultation = useCallback(async (consultationId, data) => {
    try {
      setIsAddingAttachments(true);
      
      const response = await consultationService.addAttachmentsToConsultation(consultationId, data);
      
      // Marcar como completa
      await consultationService.markConsultationComplete(consultationId);
      
      toast.success('Archivos agregados exitosamente');
      
      // Recargar datos
      await loadConsultations();
      await loadPendingConsultations();
      await loadStats();

      return response.data;
    } catch (error) {
      console.error('Error al agregar archivos:', error);
      const errorMessage = error.response?.data?.message || 'Error al agregar archivos';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsAddingAttachments(false);
    }
  }, [loadConsultations, loadPendingConsultations, loadStats]);

  // Marcar consulta como completa
  const markConsultationComplete = useCallback(async (consultationId) => {
    try {
      await consultationService.markConsultationComplete(consultationId);
      toast.success('Consulta marcada como completa');
      
      // Recargar datos
      await loadConsultations();
      await loadPendingConsultations();
      await loadStats();
    } catch (error) {
      console.error('Error al marcar consulta como completa:', error);
      toast.error('Error al marcar consulta como completa');
    }
  }, [loadConsultations, loadPendingConsultations, loadStats]);

  // Seleccionar consulta
  const selectConsultation = useCallback((consultation) => {
    setSelectedConsultation(consultation);
  }, []);

  // Abrir modal de gestión dividida
  const openDividedManager = useCallback(() => {
    setShowDividedManager(true);
  }, []);

  // Cerrar modal de gestión dividida
  const closeDividedManager = useCallback(() => {
    setShowDividedManager(false);
    setSelectedConsultation(null);
  }, []);

  // Refrescar datos
  const refresh = useCallback(async () => {
    await Promise.all([
      loadConsultations(),
      loadPendingConsultations(),
      loadStats()
    ]);
  }, [loadConsultations, loadPendingConsultations, loadStats]);

  // Obtener consultas por estado
  const getConsultationsByStatus = useCallback((status) => {
    return consultations.filter(consultation => {
      const consultationStatus = consultationService.getConsultationStatus(consultation);
      return consultationStatus.status === status;
    });
  }, [consultations]);

  // Obtener consultas completas
  const completeConsultations = getConsultationsByStatus('complete');
  
  // Obtener consultas con archivos pero no completas
  const consultationsWithAttachments = getConsultationsByStatus('with-attachments');
  
  // Obtener consultas pendientes
  const pendingConsultationsList = getConsultationsByStatus('pending');

  return {
    // Estados
    consultations,
    pendingConsultations,
    stats,
    loading,
    error,
    selectedConsultation,
    showDividedManager,
    isCreatingBasic,
    isAddingAttachments,

    // Consultas filtradas
    completeConsultations,
    consultationsWithAttachments,
    pendingConsultationsList,

    // Acciones
    createBasicConsultation,
    addAttachmentsToConsultation,
    markConsultationComplete,
    selectConsultation,
    openDividedManager,
    closeDividedManager,
    refresh,

    // Utilidades
    getConsultationsByStatus
  };
};

export default useDividedConsultations; 