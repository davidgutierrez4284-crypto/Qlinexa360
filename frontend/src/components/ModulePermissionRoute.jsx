import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSelectedDoctor } from '../context/SelectedDoctorContext';

/**
 * Restringe rutas del dashboard por módulo (asistentes). Doctores y admin pasan siempre.
 */
const ModulePermissionRoute = ({ module, children, fallback = '/dashboard/dashboard' }) => {
  const { user } = useAuth();
  const { hasPermission } = useSelectedDoctor();

  if (user?.role === 'DOCTOR' || user?.role === 'ADMIN') {
    return children;
  }

  if (user?.role === 'ASISTENTE' && module && hasPermission(module)) {
    return children;
  }

  return <Navigate to={fallback} replace />;
};

export default ModulePermissionRoute;
