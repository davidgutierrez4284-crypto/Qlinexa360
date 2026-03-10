import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import { getApiUrl } from '../../utils/api';
import { UserGroupIcon, EnvelopeIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline';

const AgendaConfig = () => {
  const [config, setConfig] = useState({
    estaActivo: false,
    mensajeCustom: '',
    link: ''
  });
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatients, setSelectedPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchPatients();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      const response = await axios.get(getApiUrl('/api/doctors/my-patients'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      // Filtrar pacientes únicos y que tengan email
      const patientsData = response.data || [];
      const uniquePatientsMap = new Map();
      
      patientsData.forEach(patient => {
        // Solo incluir pacientes con email registrado
        if (patient.email && !uniquePatientsMap.has(patient.id)) {
          uniquePatientsMap.set(patient.id, {
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            email: patient.email
          });
        }
      });
      
      setPatients(Array.from(uniquePatientsMap.values()));
    } catch (error) {
      console.error('Error al cargar pacientes:', error);
      toast.error('Error al cargar lista de pacientes');
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await axios.get(getApiUrl('/api/agenda-pacientes/config'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data.success) {
        // Mapear los campos de snake_case a camelCase
        const data = response.data.data;
        setConfig({
          estaActivo: data?.esta_activo || false,
          mensajeCustom: data?.mensaje_custom || '',
          link: data?.link || ''
        });
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      toast.error('Error al cargar configuración');
    }
  };

  const handleToggle = async () => {
    // Evitar múltiples llamadas simultáneas
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await axios.put(getApiUrl('/api/agenda-pacientes/config'), {
        estaActivo: !config.estaActivo,
        mensajeCustom: config.mensajeCustom || ''
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 10000 // Timeout de 10 segundos
      });

      if (response.data && response.data.success) {
        const data = response.data.data;
        setConfig({
          estaActivo: data.esta_activo || false,
          mensajeCustom: data.mensaje_custom || '',
          link: data.link || ''
        });
        toast.success(data.esta_activo ? 'Agenda activada correctamente' : 'Agenda desactivada');
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error al actualizar configuración:', error);
      if (error.response) {
        toast.error(error.response.data?.error || 'Error al actualizar configuración');
      } else if (error.request) {
        toast.error('Error de conexión. Verifica tu conexión a internet.');
      } else {
        toast.error('Error al actualizar configuración');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMessageChange = async (newMessage) => {
    setConfig(prev => ({ ...prev, mensajeCustom: newMessage }));
    
    // Debounce para guardar automáticamente
    setTimeout(async () => {
      try {
        await axios.put(getApiUrl('/api/agenda-pacientes/config'), {
          estaActivo: config.estaActivo,
          mensajeCustom: newMessage
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      } catch (error) {
        console.error('Error al guardar mensaje:', error);
        toast.error('Error al guardar mensaje');
      }
    }, 1000);
  };

  const copyLink = async () => {
    if (config.link) {
      try {
        await navigator.clipboard.writeText(config.link);
        setLinkCopied(true);
        toast.success('Link copiado al portapapeles');
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (error) {
        console.error('Error al copiar link:', error);
        toast.error('Error al copiar link');
      }
    } else {
      toast.error('No hay link disponible');
    }
  };

  const handlePatientToggle = (patientId) => {
    setSelectedPatients(prev => 
      prev.includes(patientId)
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map(p => p.id));
    }
  };

  const sendLinkToSelectedPatients = async () => {
    if (selectedPatients.length === 0) {
      toast.error('Selecciona al menos un paciente');
      return;
    }

    if (!config.link) {
      toast.error('No hay link disponible. Activa el agendamiento primero.');
      return;
    }

    // Validar que todos los pacientes seleccionados tengan email
    const selectedPatientsData = patients.filter(p => selectedPatients.includes(p.id));
    const patientsWithoutEmail = selectedPatientsData.filter(p => !p.email);
    
    if (patientsWithoutEmail.length > 0) {
      toast.error(`Algunos pacientes no tienen email registrado: ${patientsWithoutEmail.map(p => `${p.firstName} ${p.lastName}`).join(', ')}`);
      return;
    }

    setSendingEmails(true);
    try {
      const response = await axios.post(getApiUrl('/api/agenda-pacientes/config/send-link'), {
        patientIds: selectedPatients
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 30000 // Timeout de 30 segundos para envío de múltiples emails
      });

      if (response.data.success) {
        const { results } = response.data;
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;

        if (successCount > 0) {
          toast.success(`✅ Link de agendamiento enviado a ${successCount} paciente(s) por email`);
        }
        if (failCount > 0) {
          const failedPatients = results.filter(r => !r.success);
          const failedNames = failedPatients.map(r => r.patientName).join(', ');
          toast.warning(`⚠️ ${failCount} email(s) no se pudieron enviar: ${failedNames}`);
        }

        // Mostrar detalles si hay errores
        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
          console.error('Errores al enviar emails:', failed);
          failed.forEach(f => {
            console.error(`- ${f.patientName} (${f.email}): ${f.error}`);
          });
        }

        setSelectedPatients([]);
      } else {
        throw new Error(response.data.message || 'Error al enviar emails');
      }
    } catch (error) {
      console.error('Error al enviar emails:', error);
      if (error.response) {
        toast.error(error.response.data?.error || 'Error al enviar emails');
      } else if (error.request) {
        toast.error('Error de conexión. Verifica tu conexión a internet.');
      } else {
        toast.error('Error al enviar emails');
      }
    } finally {
      setSendingEmails(false);
    }
  };


  const generateLink = async () => {
    // Evitar múltiples llamadas simultáneas
    if (loading) return;
    
    setLoading(true);
    try {
      const response = await axios.put(getApiUrl('/api/agenda-pacientes/config'), {
        estaActivo: true,
        mensajeCustom: config.mensajeCustom || ''
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        timeout: 10000 // Timeout de 10 segundos
      });

      if (response.data && response.data.success) {
        const data = response.data.data;
        setConfig({
          estaActivo: data.esta_activo || false,
          mensajeCustom: data.mensaje_custom || '',
          link: data.link || ''
        });
        toast.success('Link de agendamiento generado correctamente');
      } else {
        throw new Error('Respuesta inválida del servidor');
      }
    } catch (error) {
      console.error('Error al generar link:', error);
      if (error.response) {
        toast.error(error.response.data?.error || 'Error al generar link');
      } else if (error.request) {
        toast.error('Error de conexión. Verifica tu conexión a internet.');
      } else {
        toast.error('Error al generar link');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Configuración de Agenda</h3>
      
      {/* Toggle para activar/desactivar */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Permitir agendamiento directo</h4>
            <p className="text-sm text-gray-600">
              Los pacientes podrán agendar citas directamente desde tu link personalizado
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            type="button"
            aria-label={config.estaActivo ? 'Desactivar agendamiento directo' : 'Activar agendamiento directo'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              config.estaActivo ? 'bg-blue-600' : 'bg-gray-200'
            } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              </span>
            )}
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
                config.estaActivo ? 'translate-x-6' : 'translate-x-1'
              } ${loading ? 'opacity-0' : 'opacity-100'}`}
            />
          </button>
        </div>
        {config.estaActivo && (
          <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              ✅ El agendamiento directo está activado. Los pacientes pueden usar tu link personalizado.
            </p>
          </div>
        )}
      </div>

      {/* Mensaje personalizado */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mensaje personalizado
        </label>
        <textarea
          value={config.mensajeCustom}
          onChange={(e) => handleMessageChange(e.target.value)}
          placeholder="Escribe un mensaje de bienvenida para tus pacientes..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">
          Este mensaje aparecerá cuando los pacientes visiten tu link de agendamiento
        </p>
      </div>

      {/* Link compartible */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tu link de agendamiento
        </label>
        
        {config.link ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={config.link}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
              />
              <button
                onClick={copyLink}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors ${
                  linkCopied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {linkCopied ? (
                  <>
                    <CheckIcon className="h-4 w-4" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="h-4 w-4" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            
            {/* Sección para enviar por email a pacientes */}
            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-medium text-purple-900 flex items-center">
                  <EnvelopeIcon className="h-5 w-5 mr-2" />
                  Enviar link por email a pacientes
                </h5>
                {patients.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-purple-600 hover:text-purple-800 underline"
                  >
                    {selectedPatients.length === patients.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                )}
              </div>
              
              {loadingPatients ? (
                <p className="text-sm text-gray-600">Cargando pacientes...</p>
              ) : patients.length === 0 ? (
                <p className="text-sm text-gray-600">No hay pacientes con email registrado</p>
              ) : (
                <>
                  <div className="max-h-48 overflow-y-auto border border-purple-200 rounded-md bg-white p-2 mb-3">
                    {patients.map(patient => (
                        <label
                          key={patient.id}
                          className="flex items-center space-x-2 p-2 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPatients.includes(patient.id)}
                            onChange={() => handlePatientToggle(patient.id)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {patient.firstName} {patient.lastName}
                              </span>
                              {selectedPatients.includes(patient.id) && (
                                <span className="text-xs text-purple-600 font-semibold">✓ Seleccionado</span>
                              )}
                            </div>
                            {patient.email ? (
                              <span className="text-xs text-gray-500 block truncate" title={patient.email}>
                                📧 {patient.email}
                              </span>
                            ) : (
                              <span className="text-xs text-red-500 block">
                                ⚠️ Sin email registrado
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                  </div>
                  
                  <div className="space-y-2">
                    <button
                      onClick={sendLinkToSelectedPatients}
                      disabled={sendingEmails || selectedPatients.length === 0}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center space-x-2 transition-colors"
                    >
                      {sendingEmails ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>Enviando link a {selectedPatients.length} paciente(s)...</span>
                        </>
                      ) : (
                        <>
                          <EnvelopeIcon className="h-4 w-4" />
                          <span>Enviar link por email a {selectedPatients.length} paciente(s)</span>
                        </>
                      )}
                    </button>
                    {selectedPatients.length > 0 && (
                      <p className="text-xs text-gray-600 text-center">
                        Se enviará el link de agendamiento al email registrado de cada paciente
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            
            <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
              💡 <strong>Tip:</strong> Comparte este link con tus pacientes para que puedan agendar citas directamente. 
              El link se genera automáticamente cuando activas el agendamiento directo.
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-3">No hay link de agendamiento generado</p>
            <button
              onClick={generateLink}
              disabled={loading}
              type="button"
              className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 min-w-[200px]"
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Generar Link de Agendamiento</span>
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Activa el agendamiento directo y genera tu link personalizado
            </p>
          </div>
        )}
      </div>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-800 mb-3">¿Cómo funciona el agendamiento directo?</h4>
        <div className="space-y-2">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">1.</span>
            <p className="text-sm text-blue-700">Los pacientes acceden a tu <strong>link personalizado</strong></p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">2.</span>
            <p className="text-sm text-blue-700">Ven solo los <strong>horarios disponibles</strong> en tu calendario</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">3.</span>
            <p className="text-sm text-blue-700">Pueden <strong>agendar citas directamente</strong> sin tu intervención</p>
          </div>
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 font-bold">4.</span>
            <p className="text-sm text-blue-700">Reciben <strong>confirmación automática</strong> por email</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-blue-700">
          Tu agenda siempre permanece oculta, el paciente únicamente verá horarios disponibles. La privacidad de tu agenda se mantiene.
        </p>
        
        <div className="mt-4 p-3 bg-white rounded border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>💡 Ventajas:</strong> Ahorras tiempo, reduces llamadas telefónicas, y tus pacientes pueden agendar 
            citas 24/7 desde cualquier dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AgendaConfig; 