import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { 
  ChartBarIcon, 
  BeakerIcon, 
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { getApiUrl, getApiHeaders } from '../../utils/api';

export default function RecipeStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const doctorId = user.doctorId || localStorage.getItem('selectedDoctorId');
      if (!doctorId) {
        toast.error('No se pudo determinar el doctor');
        setLoading(false);
        return;
      }
      console.log('Fetching stats for doctorId:', doctorId);
      
      const res = await fetch(getApiUrl(`/api/recipes/stats/${doctorId}`), {
        headers: getApiHeaders()
      });
      
      console.log('Stats response status:', res.status);
      
      if (res.ok) {
        const response = await res.json();
        console.log('Stats response data:', response);
        // El backend devuelve { success: true, data: {...} }
        if (response.success && response.data) {
          console.log('Setting stats:', response.data);
          setStats(response.data);
        } else {
          console.log('No stats found or invalid response');
          setStats(null);
        }
      } else {
        throw new Error('Error al cargar estadísticas');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow w-full">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg p-6 shadow w-full">
        <div className="text-center text-gray-500">
          No se pudieron cargar las estadísticas
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 shadow w-full">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <ChartBarIcon className="w-5 h-5 mr-2" />
        Estadísticas de Recetas
      </h3>
      
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center">
            <DocumentTextIcon className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-blue-600 font-medium">Total Recetas</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalRecetas || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center">
            <BeakerIcon className="w-8 h-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-green-600 font-medium">Medicamentos</p>
              <p className="text-2xl font-bold text-green-900">{stats.recetasMedicamentos || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center">
            <BeakerIcon className="w-8 h-8 text-purple-600 mr-3" />
            <div>
              <p className="text-sm text-purple-600 font-medium">Estudios</p>
              <p className="text-2xl font-bold text-purple-900">{stats.solicitudesEstudios || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center">
            <ArrowTrendingUpIcon className="w-8 h-8 text-orange-600 mr-3" />
            <div>
              <p className="text-sm text-orange-600 font-medium">Promedio Mensual</p>
              <p className="text-2xl font-bold text-orange-900">
                {Math.round((stats.totalRecetas || 0) / 12)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Medicamentos más usados */}
      {stats.medicamentosMasUsados && stats.medicamentosMasUsados.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <BeakerIcon className="w-4 h-4 mr-2" />
            Medicamentos Más Prescritos
          </h4>
          <div className="space-y-2">
            {stats.medicamentosMasUsados.slice(0, 5).map((med, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{med.medicamento}</span>
                <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
                  {med.count || 0} prescripciones
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estudios más solicitados */}
      {stats.estudiosMasSolicitados && stats.estudiosMasSolicitados.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3 flex items-center">
            <BeakerIcon className="w-4 h-4 mr-2" />
            Estudios Más Solicitados
          </h4>
          <div className="space-y-2">
            {stats.estudiosMasSolicitados.slice(0, 5).map((estudio, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">{estudio.nombreEstudio}</span>
                <span className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
                  {estudio.count || 0} solicitudes
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
