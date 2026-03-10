// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedDoctor } from '../context/SelectedDoctorContext';
import DoctorDashboardStats from '../components/medical/DoctorDashboardStats';
import QuickActions from '../components/medical/QuickActions';
import PatientHealthCharts from '../components/medical/PatientHealthCharts';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  ChartBarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { user } = useAuth();
  const { selectedDoctor, getDoctorHeader, hasPermission } = useSelectedDoctor();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Verificar permisos para asistentes y administradores
  const canAccess = user?.role === 'DOCTOR' || user?.role === 'ADMIN' || (user?.role === 'ASISTENTE' && hasPermission('appointments'));

  // Cargar pacientes al montar
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoadingPatients(true);
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`,
          ...getDoctorHeader()
        };
        const response = await axios.get('/api/doctors/my-patients', { headers });
        const data = response.data;
        setPatients(data);
        // Seleccionar el primer paciente por defecto si existe
        if (data.length > 0 && !selectedPatientId) {
          setSelectedPatientId(data[0].id);
        }
      } catch (error) {
        console.error('Error cargando pacientes:', error);
        toast.error('Error al cargar lista de pacientes');
      } finally {
        setLoadingPatients(false);
      }
    };

    // Los administradores pueden ver el dashboard pero no necesitan cargar pacientes
    if (canAccess && user?.role !== 'ADMIN') {
      fetchPatients();
    }
  }, [user, selectedDoctor, canAccess, selectedPatientId, getDoctorHeader]);

  // Si no es doctor, asistente ni admin, mostrar mensaje de acceso denegado
  if (user?.role !== 'DOCTOR' && user?.role !== 'ASISTENTE' && user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Acceso Denegado
            </h1>
            <p className="text-lg text-gray-600">
              Esta sección está disponible solo para profesionales de la salud.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Si es asistente pero no tiene permisos o no hay doctor seleccionado
  // Los administradores tienen acceso completo
  if (user?.role === 'ASISTENTE' && (!canAccess || !selectedDoctor)) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Acceso Denegado
            </h1>
            <p className="text-lg text-gray-600">
              {!selectedDoctor 
                ? 'No tienes doctores vinculados. Por favor contacta a tu administrador.'
                : 'No tienes permisos para acceder a esta sección.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header del Dashboard */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {user?.role === 'ADMIN'
                  ? `Bienvenido, ${user?.firstName} ${user?.lastName} (Administrador)`
                  : user?.role === 'ASISTENTE' 
                  ? `Bienvenida, ${user?.firstName} ${user?.lastName}`
                  : (() => {
                      const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ');
                      const sinTitulo = fullName.replace(/^(Dr\.?|Dra\.?)\s*/i, '').trim();
                      return `Bienvenido, ${sinTitulo || fullName}`;
                    })()
                }
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                {user?.role === 'ADMIN'
                  ? 'Panel de administración de Qlinexa360'
                  : user?.role === 'ASISTENTE' && selectedDoctor
                  ? `Panel de control - ${selectedDoctor.doctorName}`
                  : 'Panel de control de tu práctica clínica'
                }
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Última actualización</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="mb-8">
          <QuickActions />
        </div>

        {/* Estadísticas del Dashboard (solo Doctor; Admin no tiene doctorId) */}
        {user?.role === 'DOCTOR' && (
          <div className="mb-8">
            <DoctorDashboardStats />
          </div>
        )}

        {/* Gráficas de Evolución de Pacientes */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center mb-4">
                <ChartBarIcon className="h-6 w-6 text-indigo-600 mr-2" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Evolución de Indicadores de Salud
                </h2>
              </div>
              <p className="text-gray-600">
                Visualiza la evolución temporal de parámetros médicos con rangos normales y alertas
              </p>
            </div>

            {user?.role === 'ADMIN' ? (
              <div className="p-8 text-center text-gray-500">
                <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>Panel de administración</p>
                <p className="text-sm mt-2">Como administrador, puedes gestionar videos tutoriales desde la sección "Ayuda y tutoriales".</p>
              </div>
            ) : patients.length === 0 && !loadingPatients ? (
              <div className="p-8 text-center text-gray-500">
                <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No tienes pacientes registrados aún.</p>
                <p className="text-sm mt-2">Las gráficas aparecerán cuando tengas pacientes con consultas registradas.</p>
              </div>
            ) : null}

            {user?.role !== 'ADMIN' && patients.length > 0 && (
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar paciente
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.firstName} {patient.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                
                {selectedPatientId && (
                  <PatientHealthCharts patientId={selectedPatientId} />
                )}
              </div>
            )}

            {loadingPatients && (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Footer del Dashboard */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Qlinexa360 - Plataforma Integral para Profesionales de la Salud
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Última versión: 2.0.0
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;