// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSelectedDoctor } from '../context/SelectedDoctorContext';
import DoctorDashboardStats from '../components/medical/DoctorDashboardStats';
import QuickActions from '../components/medical/QuickActions';
import PatientHealthCharts from '../components/medical/PatientHealthCharts';
import PatientDashboardCharts from '../components/medical/PatientDashboardCharts';
import PatientOmsDashboardCharts from '../components/medical/PatientOmsDashboardCharts';
import PatientAppointments from './PatientAppointments';
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

  const isPatientView = user?.role === 'PATIENT';
  const canAccess = user?.role === 'DOCTOR' || user?.role === 'ADMIN' || (user?.role === 'ASISTENTE' && hasPermission('appointments'));

  // Cargar pacientes al montar (solo para doctores/asistentes)
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
        const uniquePatients = data.reduce((acc, p) => {
          if (!acc.some(x => x.id === p.id)) acc.push(p);
          return acc;
        }, []);
        setPatients(uniquePatients);
        if (uniquePatients.length > 0 && !selectedPatientId) {
          setSelectedPatientId(uniquePatients[0].id);
        }
      } catch (error) {
        console.error('Error cargando pacientes:', error);
        toast.error('Error al cargar lista de pacientes');
      } finally {
        setLoadingPatients(false);
      }
    };

    if (canAccess && user?.role !== 'ADMIN') {
      fetchPatients();
    }
  }, [user, selectedDoctor, canAccess, selectedPatientId, getDoctorHeader]);

  // Vista exclusiva para pacientes: solo su información, sin selector ni edición
  if (isPatientView) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Bienvenido, {user?.firstName} {user?.lastName}
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              Tu panel de información clínica
            </p>
          </div>

          <div className="mb-8">
            <PatientAppointments />
          </div>

          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center mb-4">
                <ChartBarIcon className="h-6 w-6 text-indigo-600 mr-2" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Casos clínicos y frecuencia de consultas
                </h2>
              </div>
              <p className="text-gray-600">
                Casos clínicos por fecha y consultas por caso
              </p>
            </div>
            <div className="p-6">
              <PatientDashboardCharts isPatientView={true} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-8">
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
            <div className="p-6">
              <PatientHealthCharts isPatientView={true} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center mb-4">
                <ChartBarIcon className="h-6 w-6 text-emerald-600 mr-2" />
                <h2 className="text-2xl font-bold text-gray-900">
                  Crecimiento: percentiles y rangos OMS
                </h2>
              </div>
              <p className="text-gray-600">
                Peso, talla e IMC: en menores de 19 años, bandas OMS (P3–P97); en adultos, evolución en el tiempo con rango
                orientativo cuando aplique
              </p>
            </div>
            <div className="p-6">
              <PatientOmsDashboardCharts isPatientView={true} />
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              Qlinexa360 - Plataforma Integral para Profesionales de la Salud
            </p>
          </div>
        </div>
      </div>
    );
  }

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

        {/* Selector de paciente: aplica a todas las gráficas siguientes */}
        {user?.role !== 'ADMIN' && patients.length > 0 && (
          <div className="mb-6 flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Seleccionar paciente
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.firstName} {patient.lastName}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Gráficas de Casos Clínicos y Consultas */}
        {user?.role !== 'ADMIN' && patients.length > 0 && selectedPatientId && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center mb-4">
                  <ChartBarIcon className="h-6 w-6 text-indigo-600 mr-2" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Casos clínicos y frecuencia de consultas
                  </h2>
                </div>
                <p className="text-gray-600">
                  Casos clínicos por fecha y consultas por caso
                </p>
              </div>
              <div className="p-6">
                <PatientDashboardCharts patientId={selectedPatientId} isPatientView={false} />
              </div>
            </div>
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

            {user?.role !== 'ADMIN' && patients.length > 0 && selectedPatientId && (
              <div className="p-6">
                <PatientHealthCharts patientId={selectedPatientId} />
              </div>
            )}

            {loadingPatients && (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            )}
          </div>
        </div>

        {/* Percentiles OMS (peso, talla, IMC) — adicional a la evolución por parámetro manual */}
        {user?.role !== 'ADMIN' && patients.length > 0 && selectedPatientId && (
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center mb-4">
                  <ChartBarIcon className="h-6 w-6 text-emerald-600 mr-2" />
                  <h2 className="text-2xl font-bold text-gray-900">
                    Crecimiento: percentiles y rangos OMS
                  </h2>
                </div>
                <p className="text-gray-600">
                  Peso, talla e IMC: menores de 19 años con bandas OMS (P3–P97); adultos con tendencia y rango orientativo.
                  Complementa la sección anterior; no sustituye al selector de parámetros.
                </p>
              </div>
              <div className="p-6">
                <PatientOmsDashboardCharts patientId={selectedPatientId} isPatientView={false} />
              </div>
            </div>
          </div>
        )}

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