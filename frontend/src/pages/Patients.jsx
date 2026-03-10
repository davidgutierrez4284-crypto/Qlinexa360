import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  UserIcon,
  CalendarIcon,
  DocumentTextIcon,
  EyeIcon,
  PlusIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { getAllMyPatients, createPatient } from '../services/doctorService';
import axios from 'axios';
import NewPatientModal from '../components/medical/NewPatientModal';
import { toast } from 'react-toastify';
import Loader from '../components/common/Loader';

const PatientAvatar = ({ url, alt }) => {
  const [signedUrl, setSignedUrl] = React.useState('');
  React.useEffect(() => {
    let isMounted = true;
    async function fetchSigned() {
      if (!url) { setSignedUrl(''); return; }
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/api/files/signed-url', {
          params: { url },
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted) setSignedUrl(res.data.url);
      } catch {
        if (isMounted) setSignedUrl('');
      }
    }
    fetchSigned();
    return () => { isMounted = false; };
  }, [url]);
  if (!signedUrl) {
    return <div className="h-10 w-10 rounded-full bg-blue-100" />;
  }
  return <img className="h-10 w-10 rounded-full object-cover" src={signedUrl} alt={alt} />;
};

const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'firstName', direction: 'asc' });
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
  

  // Cargar pacientes al montar el componente
  useEffect(() => {
    loadPatients();
  }, []);

  // Filtrar pacientes cuando cambie el término de búsqueda
  useEffect(() => {
    filterPatients();
  }, [patients, searchTerm, sortConfig]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await getAllMyPatients();
      setPatients(data);
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      setPatients([]);
      setFilteredPatients([]);
      if (error.response?.status === 403 || error.response?.status === 400) {
        toast.error('Acceso revocado. Ya no tienes pacientes vinculados.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePatient = async (patientData) => {
    try {
      const newPatient = await createPatient(patientData);
      toast.success(`Paciente ${newPatient.firstName} registrado con éxito.`);
      setIsNewPatientModalOpen(false);
      
      // Recargar la lista de pacientes
      await loadPatients();
      
    } catch (error) {
      toast.error(error.message || 'Error al registrar al paciente.');
    }
  };

  const filterPatients = () => {
    let filtered = patients.filter(patient => {
      const searchLower = searchTerm.toLowerCase();
      return (
        patient.firstName?.toLowerCase().includes(searchLower) ||
        patient.lastName?.toLowerCase().includes(searchLower) ||
        patient.email?.toLowerCase().includes(searchLower) ||
        patient.padecimiento?.toLowerCase().includes(searchLower)
      );
    });

    // Ordenar
    filtered.sort((a, b) => {
      const aValue = a[sortConfig.key] || '';
      const bValue = b[sortConfig.key] || '';
      
      if (sortConfig.direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });

    setFilteredPatients(filtered);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ChevronUpIcon className="h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUpIcon className="h-4 w-4 text-blue-600" />
      : <ChevronDownIcon className="h-4 w-4 text-blue-600" />;
  };

  const getClinicalEvolutionLabel = (evolution) => {
    // El backend ya envía los valores mapeados, así que solo retornamos el valor tal como viene
    return evolution || 'Sin evolución';
  };

  const getClinicalEvolutionColor = (evolution) => {
    const colors = {
      'Evaluación Inicial': 'bg-blue-100 text-blue-800',
      'Diagnóstico': 'bg-yellow-100 text-yellow-800',
      'Plan de Tratamiento': 'bg-green-100 text-green-800',
      'Seguimiento': 'bg-purple-100 text-purple-800',
      'Estabilización': 'bg-indigo-100 text-indigo-800',
      'Alta Médica': 'bg-gray-100 text-gray-800',
      'Reingreso': 'bg-red-100 text-red-800'
    };
    return colors[evolution] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <Loader text="Cargando pacientes..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header Section - Always Visible */}
      <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="sm:flex sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Mis Pacientes</h1>
              <p className="mt-2 text-sm text-gray-700">
                Gestiona todos tus pacientes y sus casos clínicos
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button
                onClick={() => setIsNewPatientModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Registrar Nuevo Paciente
              </button>
            </div>
          </div>

          {/* Buscador moderno tipo Google */}
          <div className="mb-4">
            <div className="relative max-w-2xl">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                placeholder="Buscar por nombre, apellido, email o padecimiento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Section */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {/* Vista móvil: tarjetas con nombre visible */}
        <div className="md:hidden space-y-4">
          {filteredPatients.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <UserIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-500">No se encontraron pacientes</p>
              <p className="text-sm text-gray-400 mt-1">Intenta ajustar los filtros de búsqueda</p>
            </div>
          ) : (
          filteredPatients.map((patient, index) => (
            <div
              key={`${patient.id}-${patient.clinicalCaseId || index}`}
              className="bg-white rounded-lg shadow p-4 border border-gray-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center min-w-0 flex-1">
                  {patient.profilePictureUrl ? (
                    <PatientAvatar url={patient.profilePictureUrl} alt={`${patient.firstName} ${patient.lastName}`} />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-blue-600">
                        {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="ml-3 min-w-0">
                    <p className="text-base font-semibold text-gray-900 truncate">
                      {patient.firstName} {patient.lastName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{patient.email}</p>
                  </div>
                </div>
                <Link
                  to={`/dashboard/medical-records?patientId=${patient.id}${patient.clinicalCaseId ? `&clinicalCaseId=${patient.clinicalCaseId}` : ''}`}
                  className="flex-shrink-0 inline-flex items-center px-3 py-2 text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                >
                  <EyeIcon className="h-4 w-4 mr-1" />
                  Ver Historial
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {patient.padecimiento && (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {patient.padecimiento}
                  </span>
                )}
                {patient.clinicalEvolution && (
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${getClinicalEvolutionColor(patient.clinicalEvolution)}`}>
                    {getClinicalEvolutionLabel(patient.clinicalEvolution)}
                  </span>
                )}
              </div>
              {(patient.lastAppointment || patient.nextAppointment) && (
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  {patient.lastAppointment && (
                    <span className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Última: {patient.lastAppointment}
                    </span>
                  )}
                  {patient.nextAppointment && (
                    <span className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      Próx: {patient.nextAppointment}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
          )}
        </div>

        {/* Tabla de pacientes - solo desktop/tablet, columnas proporcionales sin scroll horizontal */}
        <div className="hidden md:block bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-y-visible">
            <table className="w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('firstName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Nombre</span>
                    {getSortIcon('firstName')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('lastName')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Apellido</span>
                    {getSortIcon('lastName')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('padecimiento')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Padecimiento</span>
                    {getSortIcon('padecimiento')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('clinicalEvolution')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Etapa de evolución</span>
                    {getSortIcon('clinicalEvolution')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('lastAppointment')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Última cita</span>
                    {getSortIcon('lastAppointment')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('nextAppointment')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Próxima cita</span>
                    {getSortIcon('nextAppointment')}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('collaborators')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Trabajo colaborativo</span>
                    {getSortIcon('collaborators')}
                  </div>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <UserIcon className="h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium">No se encontraron pacientes</p>
                      <p className="text-sm">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient, index) => (
                  <tr key={`${patient.id}-${patient.clinicalCaseId || index}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center min-w-0">
                        <div className="flex-shrink-0 h-10 w-10">
                          {patient.profilePictureUrl ? (
                            <PatientAvatar url={patient.profilePictureUrl} alt={`${patient.firstName} ${patient.lastName}`} />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="ml-3 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {patient.firstName}
                          </div>
                          <div className="text-sm text-gray-500 truncate">
                            {patient.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <span className="truncate block">{patient.lastName}</span>
                    </td>
                    <td className="px-4 py-4">
                      {patient.padecimiento ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {patient.padecimiento}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin padecimiento</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {patient.clinicalEvolution ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getClinicalEvolutionColor(patient.clinicalEvolution)}`}>
                          {getClinicalEvolutionLabel(patient.clinicalEvolution)}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin evolución</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {patient.lastAppointment ? (
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {patient.lastAppointment}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {patient.nextAppointment ? (
                        <div className="flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {patient.nextAppointment}
                        </div>
                      ) : (
                        <Link
                          to={`/dashboard/calendario?patientId=${patient.id}`}
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-600 hover:text-green-700 transition-colors"
                          title="Agendar cita"
                        >
                          <PlusIcon className="h-3 w-3" />
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {patient.collaborationInfo ? (
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓
                          </span>
                          <span className="text-gray-700 text-sm truncate block">
                            {patient.collaborationInfo.displayText || '✓ Trabajo colaborativo'}
                          </span>
                        </div>
                      ) : patient.collaborators && patient.collaborators.length > 0 ? (
                        <div className="flex items-center space-x-1">
                          <UserGroupIcon className="h-4 w-4 text-gray-400 mr-1" />
                          {patient.collaborators.slice(0, 2).map((collaborator, index) => (
                            <span
                              key={collaborator.id}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              title={`${collaborator.name} (${collaborator.role})`}
                            >
                              {collaborator.name.split(' ')[0]}
                            </span>
                          ))}
                          {patient.collaborators.length > 3 && (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                              +{patient.collaborators.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Sin colaboradores</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-medium">
                      <Link
                        to={`/dashboard/medical-records?patientId=${patient.id}${patient.clinicalCaseId ? `&clinicalCaseId=${patient.clinicalCaseId}` : ''}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 whitespace-nowrap transition-colors"
                      >
                        <EyeIcon className="h-3 w-3 flex-shrink-0" />
                        Ver Historial
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Información de resultados */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        Mostrando {filteredPatients.length} de {patients.length} pacientes
      </div>

      {/* Modal para registrar nuevo paciente */}
      {isNewPatientModalOpen && (
        <NewPatientModal
          isOpen={isNewPatientModalOpen}
          onClose={() => setIsNewPatientModalOpen(false)}
          onSubmit={handleCreatePatient}
        />
      )}

      
    </div>
  </div>
  );
};

export default Patients;