import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SelectedDoctorContext = createContext();

export const useSelectedDoctor = () => {
  const context = useContext(SelectedDoctorContext);
  if (!context) {
    throw new Error('useSelectedDoctor debe ser usado dentro de un SelectedDoctorProvider');
  }
  return context;
};

export const SelectedDoctorProvider = ({ children }) => {
  const { user } = useAuth();
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [linkedDoctors, setLinkedDoctors] = useState([]);
  const [loading, setLoading] = useState(false);

  const clearSelectedDoctorStorage = () => {
    localStorage.removeItem('selectedDoctorId');
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('selectedDoctorId_')) {
        localStorage.removeItem(key);
      }
    });
  };

  // Cargar doctores vinculados cuando el usuario es asistente
  useEffect(() => {
    if (user?.role === 'ASISTENTE') {
      loadLinkedDoctors();
    } else {
      // Si no es asistente, limpiar el estado
      setLinkedDoctors([]);
      setSelectedDoctor(null);
      clearSelectedDoctorStorage();
    }
  }, [user]);

  // Cargar el doctor seleccionado del localStorage al iniciar
  useEffect(() => {
    if (user?.role === 'ASISTENTE' && linkedDoctors.length > 0) {
      const storedDoctorId = localStorage.getItem('selectedDoctorId');
      if (storedDoctorId) {
        const doctor = linkedDoctors.find(d => d.doctorId === storedDoctorId);
        if (doctor) {
          setSelectedDoctor(doctor);
        } else if (linkedDoctors.length > 0) {
          // Si el doctor guardado no existe, seleccionar el primero
          setSelectedDoctor(linkedDoctors[0]);
          localStorage.setItem('selectedDoctorId', linkedDoctors[0].doctorId);
        }
      } else if (linkedDoctors.length > 0) {
        // Si no hay doctor guardado, seleccionar el primero
        setSelectedDoctor(linkedDoctors[0]);
        localStorage.setItem('selectedDoctorId', linkedDoctors[0].doctorId);
      }
    }
  }, [linkedDoctors, user]);

  const loadLinkedDoctors = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/assistants/my-doctors', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const doctors = response.data || [];
      setLinkedDoctors(doctors);
      if (doctors.length === 0) {
        setSelectedDoctor(null);
        clearSelectedDoctorStorage();
      }
    } catch (error) {
      console.error('Error cargando doctores vinculados:', error);
      setLinkedDoctors([]);
      setSelectedDoctor(null);
      clearSelectedDoctorStorage();
    } finally {
      setLoading(false);
    }
  };

  const selectDoctor = (doctor, module = null) => {
    setSelectedDoctor(doctor);
    localStorage.setItem('selectedDoctorId', doctor.doctorId);
    // Si se especifica un módulo, guardar también para ese módulo específico
    if (module) {
      localStorage.setItem(`selectedDoctorId_${module}`, doctor.doctorId);
    }
  };

  // Función para obtener el doctor seleccionado para un módulo específico
  const getSelectedDoctorForModule = (module) => {
    if (user?.role === 'DOCTOR') {
      return null; // Los doctores no necesitan esto
    }
    if (user?.role === 'ASISTENTE' && module) {
      const moduleDoctorId = localStorage.getItem(`selectedDoctorId_${module}`);
      if (moduleDoctorId) {
        const doctor = linkedDoctors.find(d => d.doctorId === moduleDoctorId);
        if (doctor) return doctor;
      }
      // Si no hay doctor guardado para este módulo, usar el doctor seleccionado globalmente
      return selectedDoctor;
    }
    return selectedDoctor;
  };

  // Función para obtener el header con el doctorId seleccionado
  const getDoctorHeader = (module = null) => {
    if (user?.role === 'ASISTENTE') {
      // Si se especifica un módulo, usar el doctor de ese módulo
      const doctorToUse = module ? getSelectedDoctorForModule(module) : selectedDoctor;
      if (doctorToUse) {
        return {
          'X-Selected-Doctor-Id': doctorToUse.doctorId
        };
      }
    }
    return {};
  };

  // Función para verificar si el asistente tiene permiso para un módulo
  const hasPermission = (module) => {
    if (user?.role === 'DOCTOR') {
      return true; // Los doctores tienen todos los permisos
    }
    if (user?.role === 'ASISTENTE') {
      // Verificar si hay al menos un doctor con permiso para este módulo
      const doctorsWithPermission = getDoctorsWithPermission(module);
      return doctorsWithPermission.length > 0;
    }
    return false;
  };

  // Función para obtener doctores que tienen permiso para un módulo específico
  const getDoctorsWithPermission = (module) => {
    if (user?.role === 'DOCTOR') {
      return []; // Los doctores no necesitan esta función
    }
    if (user?.role === 'ASISTENTE') {
      return linkedDoctors.filter(doctor => doctor.permissions[module] || false);
    }
    return [];
  };

  return (
    <SelectedDoctorContext.Provider
      value={{
        selectedDoctor,
        linkedDoctors,
        loading,
        selectDoctor,
        loadLinkedDoctors,
        getDoctorHeader,
        hasPermission,
        getDoctorsWithPermission,
        getSelectedDoctorForModule
      }}
    >
      {children}
    </SelectedDoctorContext.Provider>
  );
};

