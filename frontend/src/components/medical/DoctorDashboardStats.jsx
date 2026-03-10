import React, { useState, useEffect } from 'react';
import { 
  UserGroupIcon, 
  CalendarIcon, 
  DocumentTextIcon, 
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import axios from 'axios';
import { toast } from 'react-toastify';

const DoctorDashboardStats = () => {
  const [stats, setStats] = useState({
    totalPatients: 0,
    activePatients: 0,
    todayAppointments: 0,
    pendingConfirmations: 0,
    totalRecipes: 0,
    monthlyRecipes: 0,
    totalEarnings: 0,
    monthlyEarnings: 0,
    recentConsultations: 0,
    pendingConsultations: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Usar el nuevo endpoint específico para métricas del dashboard
      const statsResponse = await axios.get('/api/doctors/dashboard-stats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (statsResponse.data.success && statsResponse.data.data) {
        const data = statsResponse.data.data;
        setStats({
          totalPatients: data.totalPatients || 0,
          activePatients: data.activePatients || data.totalPatients || 0,
          todayAppointments: data.todayAppointments || 0,
          pendingConfirmations: 0, // Implementar cuando esté disponible
          totalRecipes: data.totalRecipes || 0,
          monthlyRecipes: data.monthlyRecipes || 0,
          totalEarnings: 0, // Implementar cuando esté disponible
          monthlyEarnings: 0, // Implementar cuando esté disponible
          recentConsultations: data.recentConsultations || 0,
          pendingConsultations: data.pendingConsultations || 0
        });
      } else {
        throw new Error('Formato de respuesta inválido');
      }
      
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Error al cargar estadísticas del dashboard');
      // Establecer valores por defecto en caso de error
      setStats({
        totalPatients: 0,
        activePatients: 0,
        todayAppointments: 0,
        pendingConfirmations: 0,
        totalRecipes: 0,
        monthlyRecipes: 0,
        totalEarnings: 0,
        monthlyEarnings: 0,
        recentConsultations: 0,
        pendingConsultations: 0
      });
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total de Pacientes */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total de Pacientes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPatients}</p>
            </div>
          </div>
        </div>

        {/* Citas de Hoy */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CalendarIcon className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Citas de Hoy</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.todayAppointments}</p>
            </div>
          </div>
        </div>

        {/* Total de Recetas */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentTextIcon className="h-8 w-8 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recetas del Mes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.monthlyRecipes}</p>
            </div>
          </div>
        </div>

        {/* Consultas Pendientes */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Consultas Pendientes</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingConsultations}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Estadísticas Secundarias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resumen de Actividad */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen de Actividad</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total de Recetas</span>
              <span className="text-sm font-medium text-gray-900">{stats.totalRecipes}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Consultas Recientes</span>
              <span className="text-sm font-medium text-gray-900">{stats.recentConsultations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pacientes Activos</span>
              <span className="text-sm font-medium text-gray-900">{stats.activePatients}</span>
            </div>
          </div>
        </div>

        {/* Próximas Citas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Próximas Citas</h3>
          <div className="text-center py-4">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No hay citas próximas</p>
          </div>
        </div>

        {/* Estado de Suscripción */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Estado de Suscripción</h3>
          <div className="flex items-center">
            <CheckCircleIcon className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-900">Activa</p>
              <p className="text-xs text-gray-500">Plan Premium</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default DoctorDashboardStats;
