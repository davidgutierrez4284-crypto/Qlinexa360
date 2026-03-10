import React, { useState, useEffect } from 'react';
import { InformationCircleIcon, PlusIcon, MagnifyingGlassIcon, ChevronDownIcon, ChevronRightIcon, DocumentArrowDownIcon, TrashIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import AddInvoiceModal from '../components/billing/AddInvoiceModal';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/api';

const Billing = () => {
  const { user } = useAuth();
  const isPatient = user?.role === 'PATIENT';
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [invoicesByPatient, setInvoicesByPatient] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [sendingInvoiceId, setSendingInvoiceId] = useState(null);
  const [patientInvoices, setPatientInvoices] = useState([]); // Para pacientes

  // Función para normalizar la fecha a formato YYYY-MM-DD
  const normalizeDate = (dateValue) => {
    if (!dateValue) return null;

    if (typeof dateValue === 'string') {
      if (dateValue.includes('T')) {
        // Es un ISO string (UTC), convertir a fecha local correctamente
        const date = new Date(dateValue);
        // Usar UTC para obtener los componentes de fecha sin conversión de zona horaria
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
      } else if (dateValue.includes('-')) {
        // Ya está en formato YYYY-MM-DD
        return dateValue;
      } else {
        // Otro formato, intentar parsear
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
    } else if (dateValue instanceof Date) {
      // Es un objeto Date
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return null;
  };

  // Función para mostrar la fecha correctamente
  const formatInvoiceDate = (dateValue) => {
    const normalizedDate = normalizeDate(dateValue);
    if (!normalizedDate) return 'Fecha inválida';

    const [year, month, day] = normalizedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  // Cargar datos según el rol del usuario
  useEffect(() => {
    if (isPatient) {
      // Si es paciente, cargar directamente sus facturas
      const fetchPatientInvoices = async () => {
        setLoadingPatients(true);
        try {
          console.log('=== Frontend: Fetching patient invoices ===');
          const response = await axios.get('/api/doctors/invoices', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          console.log('Response status:', response.status);
          console.log('Response data:', response.data);
          console.log('Number of invoices:', response.data?.length || 0);
          setPatientInvoices(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
          console.error('Error al cargar facturas del paciente:', error);
          console.error('Error response:', error.response?.data);
          console.error('Error status:', error.response?.status);
          const errorMessage = error.response?.data?.message || error.message || 'Error al cargar facturas';
          toast.error(errorMessage);
          setPatientInvoices([]);
        } finally {
          setLoadingPatients(false);
        }
      };
      fetchPatientInvoices();
    } else {
      // Si es doctor, cargar lista de pacientes
      const fetchPatients = async () => {
        setLoadingPatients(true);
        try {
          const response = await axios.get('/api/doctors/my-patients', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          setPatients(response.data);
        } catch (error) {
          toast.error('Error al cargar pacientes');
        } finally {
          setLoadingPatients(false);
        }
      };
      fetchPatients();
    }
  }, [isPatient]);

  const filteredPatients = patients.filter(p =>
    (`${p.firstName} ${p.lastName} ${p.rfc || ''} ${p.email || ''}`).toLowerCase().includes(search.toLowerCase())
  );

  const handleAddInvoiceClick = (patient) => {
    setSelectedPatient(patient);
    setModalOpen(true);
  };

  const handleSaveInvoice = async ({ pdf, xml, invoiceDate }) => {
    try {
      const formData = new FormData();
      formData.append('patientId', selectedPatient.id);
      formData.append('patientName', selectedPatient.firstName || 'Sin nombre');
      formData.append('patientLastName', selectedPatient.lastName || 'Sin apellido');
      formData.append('patientRFC', selectedPatient.rfc || 'SIN RFC');
      formData.append('invoiceDate', invoiceDate);
      formData.append('pdf', pdf);
      formData.append('xml', xml);
      await axios.post('/api/doctors/invoices', formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Factura subida correctamente');
      setModalOpen(false);
      setSelectedPatient(null);
      if (expandedPatientId) fetchInvoicesForPatient(expandedPatientId);
    } catch (error) {
      toast.error('Error al subir la factura');
      throw error;
    }
  };

  const fetchInvoicesForPatient = async (patientId) => {
    setLoadingInvoices(true);
    try {
      const response = await axios.get('/api/doctors/invoices', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Facturas del backend:', response.data);
      console.log('patientId actual:', patientId);
      const invoices = response.data.filter(inv => (inv.patientId || '').trim() === (patientId || '').trim());
      setInvoicesByPatient(prev => ({ ...prev, [patientId]: invoices }));
    } catch (error) {
      toast.error('Error al cargar facturas');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleExpandPatient = (patientId) => {
    if (expandedPatientId === patientId) {
      setExpandedPatientId(null);
    } else {
      setExpandedPatientId(patientId);
      fetchInvoicesForPatient(patientId);
    }
  };

  const handleDownload = (url) => {
    if (!url) return;
    // Usar URL absoluta del API: en producción /uploads/ está en api.qlinexa360.com,
    // no en www. Si se abre la URL relativa, el frontend recibe la petición, devuelve
    // el SPA y redirige a /login -> /dashboard/patients (bug: paciente ve "Mis pacientes").
    const fullUrl = url.startsWith('http') ? url : getApiUrl(url) || url;
    try {
      window.open(fullUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error al abrir archivo:', error);
      toast.error('Error al abrir el archivo');
    }
  };

  const handleDeleteInvoice = async (invoiceId, patientId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta factura? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await axios.delete(`/api/doctors/invoices/${invoiceId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      toast.success('Factura eliminada correctamente');
      
      // Actualizar la lista de facturas
      if (expandedPatientId === patientId) {
        fetchInvoicesForPatient(patientId);
      }
    } catch (error) {
      console.error('Error al eliminar factura:', error);
      toast.error('Error al eliminar la factura');
    }
  };

  const handleSendInvoiceByEmail = async (invoiceId, patientId) => {
    try {
      setSendingInvoiceId(invoiceId);
      const response = await axios.post(`/api/doctors/invoices/${invoiceId}/send-email`, {}, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        toast.success('Factura enviada por correo al paciente');
      } else {
        toast.error(response.data.message || 'No se pudo enviar la factura por correo');
      }
    } catch (error) {
      console.error('Error al enviar factura por correo:', error);
      toast.error(error.response?.data?.message || 'Error al enviar la factura por correo');
    } finally {
      setSendingInvoiceId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Título y Tooltip */}
        <div className="flex items-center mb-6 space-x-2">
          <h1 className="text-3xl font-bold text-gray-900">Relación de facturación</h1>
          <div className="relative group">
            <InformationCircleIcon className="h-6 w-6 text-blue-500 cursor-pointer" />
            <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-normal max-w-lg z-10 shadow-lg" style={{ width: '420px', maxWidth: '90vw' }}>
              Qlinexa360 no es un PAC de facturación, es necesario que el personal de la salud cuente con una herramienta para poder facturar a sus pacientes de manera independiente a esta plataforma. Esta sección permite relacionar las facturas por paciente, RFC y consulta de tal forma que ayude a identificarlas rápidamente por parte del Usuario y sus pacientes. <br /><br />Hemos visto que muchas llamadas de pacientes son para pedir sus facturas por lo que con esta relación a través de Qlinexa360 puede facilitar y disminuir estas llamadas de tipo administrativo.
            </div>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="mb-8">
          <div className="relative max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isPatient ? "Buscar por fecha de factura..." : "Buscar por nombre, apellido o RFC del paciente..."}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
            />
          </div>
        </div>

        {/* Lista de pacientes (acordeón) o facturas del paciente */}
        <div className="bg-white rounded-lg shadow divide-y divide-gray-100">
          {loadingPatients ? (
            <div className="p-6 text-center text-gray-500">{isPatient ? 'Cargando facturas...' : 'Cargando pacientes...'}</div>
          ) : isPatient ? (
            // Vista para pacientes: mostrar directamente sus facturas
            patientInvoices.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No se encontraron facturas.</div>
            ) : (
              <div className="p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-600 border-b">
                      <th className="text-left py-3">Fecha</th>
                      <th className="text-left py-3">PDF</th>
                      <th className="text-left py-3">XML</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientInvoices
                      .filter(inv => {
                        const searchLower = search.toLowerCase();
                        const dateStr = formatInvoiceDate(inv.invoiceDate);
                        return dateStr.toLowerCase().includes(searchLower);
                      })
                      .map(inv => (
                        <tr key={inv.id} className="border-b last:border-b-0 hover:bg-gray-50">
                          <td className="py-3">{formatInvoiceDate(inv.invoiceDate)}</td>
                          <td className="py-3">
                            <button 
                              className="text-blue-600 hover:underline flex items-center" 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDownload(inv.pdfUrl);
                              }}
                            >
                              <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> PDF
                            </button>
                          </td>
                          <td className="py-3">
                            <button 
                              className="text-blue-600 hover:underline flex items-center" 
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDownload(inv.xmlUrl);
                              }}
                            >
                              <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> XML
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredPatients.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No se encontraron pacientes.</div>
          ) : (
            filteredPatients.map(patient => (
              <div key={patient.id}>
                <div
                  className="flex flex-wrap items-center justify-between px-8 py-4 hover:bg-gray-50 transition cursor-pointer min-w-0"
                  onClick={() => handleExpandPatient(patient.id)}
                >
                  <div className="flex items-center min-w-0">
                    {expandedPatientId === patient.id
                      ? <ChevronDownIcon className="h-5 w-5 text-blue-500 mr-2" />
                      : <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2" />}
                    <div className="font-medium text-gray-900 truncate">{patient.firstName} {patient.lastName}</div>
                  </div>
                  {!isPatient && (
                    <button
                      className="ml-4 inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      onClick={e => { e.stopPropagation(); handleAddInvoiceClick(patient); }}
                    >
                      <PlusIcon className="h-4 w-4 mr-1" /> Añadir factura
                    </button>
                  )}
                </div>
                {expandedPatientId === patient.id && (
                  <div className="bg-gray-50 px-8 py-4">
                    {loadingInvoices ? (
                      <div className="text-gray-500 text-sm">Cargando facturas...</div>
                    ) : (invoicesByPatient[patient.id]?.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-600">
                            <th className="text-left py-1">Fecha</th>
                            <th className="text-left py-1">PDF</th>
                            <th className="text-left py-1">XML</th>
                            <th className="text-left py-1">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoicesByPatient[patient.id].map(inv => (
                            <tr key={inv.id} className="border-b last:border-b-0">
                              <td className="py-1">{formatInvoiceDate(inv.invoiceDate)}</td>
                              <td className="py-1">
                                <button 
                                  className="text-blue-600 hover:underline flex items-center" 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('PDF URL:', inv.pdfUrl);
                                    handleDownload(inv.pdfUrl);
                                  }}
                                >
                                  <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> PDF
                                </button>
                              </td>
                              <td className="py-1">
                                <button 
                                  className="text-blue-600 hover:underline flex items-center" 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('XML URL:', inv.xmlUrl);
                                    handleDownload(inv.xmlUrl);
                                  }}
                                >
                                  <DocumentArrowDownIcon className="h-4 w-4 mr-1" /> XML
                                </button>
                              </td>
                              <td className="py-1">
                                <div className="flex items-center space-x-2">
                                  <button 
                                    className="text-indigo-600 hover:text-indigo-800 flex items-center" 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleSendInvoiceByEmail(inv.id, patient.id);
                                    }}
                                    disabled={sendingInvoiceId === inv.id}
                                    title="Enviar por correo al paciente"
                                  >
                                    {sendingInvoiceId === inv.id ? (
                                      <span className="text-xs">Enviando...</span>
                                    ) : (
                                      <EnvelopeIcon className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button 
                                    className="text-red-600 hover:text-red-800 flex items-center" 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleDeleteInvoice(inv.id, patient.id);
                                    }}
                                    title="Eliminar factura"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-gray-500 text-sm">No hay facturas registradas para este paciente.</div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal para subir factura (solo para doctores) */}
        {!isPatient && modalOpen && selectedPatient && (
          <AddInvoiceModal
            open={modalOpen}
            onClose={() => { setModalOpen(false); setSelectedPatient(null); }}
            patient={selectedPatient}
            onSave={handleSaveInvoice}
          />
        )}
      </div>
    </div>
  );
};

export default Billing; 