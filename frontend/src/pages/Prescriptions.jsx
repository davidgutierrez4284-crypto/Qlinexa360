import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getApiUrl, getApiHeaders } from '../utils/api';
import { getAllMyPatients } from '../services/doctorService';
import { 
  PlusIcon, 
  DocumentTextIcon, 
  PencilIcon, 
  TrashIcon,
  EyeIcon,
  ShareIcon,
  StarIcon,
  DocumentPlusIcon,
  BeakerIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import RecipeStats from '../components/medical/RecipeStats';
import DoctorProfileConfig from '../components/medical/DoctorProfileConfig';
import { useAuth } from '../context/AuthContext';

// Componente para crear nueva receta
function CreateRecipe({ onRecipeCreated, setActiveTab }) {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  
  const [formData, setFormData] = useState({
    pacienteId: '',
    citaId: '',
    esRecetaMedicamento: true,
    esSolicitudEstudios: false,
    observaciones: '',
    medicamentos: [{ medicamento: '', dosis: '', frecuencia: '', duracion: '' }],
    estudios: [{ nombreEstudio: '', indicaciones: '' }]
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      const patientSearchContainer = document.getElementById('patient-search-container');
      if (patientSearchContainer && !patientSearchContainer.contains(event.target)) {
        setShowPatientDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (formData.pacienteId) {
      fetchConsultations(formData.pacienteId);
    }
  }, [formData.pacienteId]);

  const fetchPatients = async () => {
    try {
      const data = await getAllMyPatients();
      if (Array.isArray(data)) {
        // Deduplicar por id (my-patients puede devolver varias filas por paciente según casos clínicos)
        const seen = new Set();
        const unique = data.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
        setPatients(unique);
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error('Error fetching patients for recipes:', error);
      setPatients([]);
    }
  };

  const fetchConsultations = async (patientId) => {
    try {
      const res = await fetch(getApiUrl(`/api/consultations/patient/${patientId}`), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(Array.isArray(data) ? data : []);
      } else {
        console.error('Error fetching consultations:', res.status);
        setAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching consultations:', error);
      setAppointments([]);
    }
  };

  // Filtrar pacientes basado en la búsqueda
  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.firstName || ''} ${patient.lastName || ''}`.toLowerCase();
    const email = patient.email || '';
    const searchTerm = patientSearch.toLowerCase();
    return fullName.includes(searchTerm) || email.includes(searchTerm);
  });

  const handlePatientSelect = (patient) => {
    console.log('handlePatientSelect called with patient:', patient);
    setSelectedPatient(patient);
    setFormData(prev => ({ ...prev, pacienteId: patient.id }));
    setPatientSearch(`${patient.firstName} ${patient.lastName}`);
    setShowPatientDropdown(false);
    
    // Fetch consultations for the selected patient
    fetchConsultations(patient.id);
  };

  const handlePatientSearchChange = (value) => {
    console.log('handlePatientSearchChange called with value:', value);
    setPatientSearch(value);
    setShowPatientDropdown(true);
    if (!value) {
      setSelectedPatient(null);
      setFormData(prev => ({ ...prev, pacienteId: '' }));
      setAppointments([]);
    }
  };

  const addMedicamento = () => {
    setFormData(prev => ({
      ...prev,
      medicamentos: [...prev.medicamentos, { medicamento: '', dosis: '', frecuencia: '', duracion: '' }]
    }));
  };

  const removeMedicamento = (index) => {
    setFormData(prev => ({
      ...prev,
      medicamentos: prev.medicamentos.filter((_, i) => i !== index)
    }));
  };

  const updateMedicamento = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      medicamentos: prev.medicamentos.map((med, i) => 
        i === index ? { ...med, [field]: value } : med
      )
    }));
  };

  const addEstudio = () => {
    setFormData(prev => ({
      ...prev,
      estudios: [...prev.estudios, { nombreEstudio: '', indicaciones: '' }]
    }));
  };

  const removeEstudio = (index) => {
    setFormData(prev => ({
      ...prev,
      estudios: prev.estudios.filter((_, i) => i !== index)
    }));
  };

  const updateEstudio = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      estudios: prev.estudios.map((estudio, i) => 
        i === index ? { ...estudio, [field]: value } : estudio
      )
    }));
  };

  const createRecipe = async () => {
    if (!formData.pacienteId) {
      toast.error('Selecciona un paciente');
      return;
    }

    if (!formData.esRecetaMedicamento && !formData.esSolicitudEstudios) {
      toast.error('Selecciona al menos un tipo de receta');
        return;
      }

    try {
      setLoading(true);
      
      const doctorId = JSON.parse(localStorage.getItem('user')).doctorId;
      const userId = JSON.parse(localStorage.getItem('user')).id;
      
             const recipeData = {
         doctorId,
         pacienteId: formData.pacienteId,
         citaId: formData.citaId || null, // Esto vincula la receta a la consulta seleccionada
         observaciones: formData.observaciones,
         esRecetaMedicamento: formData.esRecetaMedicamento,
         esSolicitudEstudios: formData.esSolicitudEstudios,
         medicamentos: formData.esRecetaMedicamento ? formData.medicamentos.filter(m => m.medicamento.trim()) : [],
         estudios: formData.esSolicitudEstudios ? formData.estudios.filter(e => e.nombreEstudio.trim()) : [],
         realizadoPor: userId,
         vinculadoADoctor: doctorId
       };
       
       console.log('Creating recipe with data:', recipeData);

      const res = await fetch(getApiUrl('/api/recipes'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(recipeData)
      });

      if (res.ok) {
         toast.success('Receta creada exitosamente. Ve a la pestaña "Recetas Emitidas" para verla.');
         setFormData({
           pacienteId: '',
           citaId: '',
           esRecetaMedicamento: true,
           esSolicitudEstudios: false,
           observaciones: '',
           medicamentos: [{ medicamento: '', dosis: '', frecuencia: '', duracion: '' }],
           estudios: [{ nombreEstudio: '', indicaciones: '' }]
         });
         setPatientSearch('');
         setSelectedPatient(null);
         onRecipeCreated();
      } else {
        const error = await res.json();
        throw new Error(error.message || 'Error al crear receta');
      }
    } catch (error) {
      toast.error('Error al crear receta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow w-full">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <PlusIcon className="w-5 h-5 mr-2" />
        Crear Nueva Receta
      </h3>
      
    <div className="space-y-6">
        {/* Selección de paciente y cita */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative" id="patient-search-container">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paciente *
            </label>
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => handlePatientSearchChange(e.target.value)}
              placeholder="Buscar paciente por nombre o email..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onFocus={() => setShowPatientDropdown(true)}
            />
            {showPatientDropdown && (
              <div className="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map(patient => (
                    <div
                      key={patient.id}
                      className="p-3 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Patient clicked:', patient);
                        handlePatientSelect(patient);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <div className="font-medium">
                        {patient.firstName} {patient.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient.email}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-500">
                    {patientSearch ? 'No se encontraron pacientes' : 'Escribe para buscar pacientes...'}
                  </div>
                )}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <div className="text-sm font-medium text-green-800">
                  ✓ Paciente seleccionado: {selectedPatient.firstName} {selectedPatient.lastName}
                </div>
                <div className="text-xs text-green-600">
                  {selectedPatient.email}
                </div>
              </div>
            )}
          </div>
          
                     <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">
               Consulta (opcional) - La receta se vinculará a esta consulta
             </label>
            <select
              value={formData.citaId}
              onChange={(e) => setFormData(prev => ({ ...prev, citaId: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={!formData.pacienteId}
            >
              <option value="">Seleccionar consulta</option>
              {appointments.length === 0 && formData.pacienteId && (
                <option value="" disabled>No hay consultas para este paciente</option>
              )}
              {appointments.map(consultation => {
                const consultationDate = new Date(consultation.date || consultation.createdAt);
                const dateStr = consultationDate.toLocaleDateString('es-ES', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                });
                return (
                  <option key={consultation.id} value={consultation.id}>
                    {dateStr} - {consultation.clinicalCase?.padecimiento || 'Sin padecimiento'} - {consultation.notes || 'Sin notas'}
                  </option>
                );
              })}
            </select>
            {formData.pacienteId && appointments.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Este paciente no tiene consultas registradas
              </p>
            )}
          </div>
        </div>

        {/* Tipo de receta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de Receta *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.esRecetaMedicamento}
                onChange={(e) => setFormData(prev => ({ ...prev, esRecetaMedicamento: e.target.checked }))}
                className="mr-2"
              />
                             <BeakerIcon className="w-4 h-4 mr-1" />
               Medicamentos
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.esSolicitudEstudios}
                onChange={(e) => setFormData(prev => ({ ...prev, esSolicitudEstudios: e.target.checked }))}
                className="mr-2"
              />
              <BeakerIcon className="w-4 h-4 mr-1" />
              Estudios
            </label>
          </div>
        </div>

        {/* Medicamentos */}
        {formData.esRecetaMedicamento && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Medicamentos</h4>
              <button
                onClick={addMedicamento}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                + Agregar medicamento
              </button>
            </div>
            
            <div className="space-y-3">
              {formData.medicamentos.map((med, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      placeholder="Medicamento"
                      value={med.medicamento}
                      onChange={(e) => updateMedicamento(index, 'medicamento', e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2"
                    />
                    <input
                      placeholder="Dosis"
                      value={med.dosis}
                      onChange={(e) => updateMedicamento(index, 'dosis', e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2"
                    />
                    <input
                      placeholder="Frecuencia"
                      value={med.frecuencia}
                      onChange={(e) => updateMedicamento(index, 'frecuencia', e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2"
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder="Duración (opcional)"
                        value={med.duracion}
                        onChange={(e) => updateMedicamento(index, 'duracion', e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 flex-1"
                      />
                      {formData.medicamentos.length > 1 && (
                        <button
                          onClick={() => removeMedicamento(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
          </div>
        </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estudios */}
        {formData.esSolicitudEstudios && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Estudios Solicitados</h4>
              <button
                onClick={addEstudio}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                + Agregar estudio
              </button>
      </div>

            <div className="space-y-3">
              {formData.estudios.map((estudio, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      placeholder="Nombre del estudio"
                      value={estudio.nombreEstudio}
                      onChange={(e) => updateEstudio(index, 'nombreEstudio', e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2"
                    />
                    <input
                      placeholder="Indicaciones (opcional)"
                      value={estudio.indicaciones}
                      onChange={(e) => updateEstudio(index, 'indicaciones', e.target.value)}
                      className="border border-gray-300 rounded px-3 py-2"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1" />
                      {formData.estudios.length > 1 && (
                        <button
                          onClick={() => removeEstudio(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Observaciones
          </label>
          <textarea
            value={formData.observaciones}
            onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            placeholder="Observaciones adicionales..."
          />
        </div>

                 {/* Botón crear */}
         <button
           onClick={createRecipe}
           disabled={loading}
           className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
         >
           {loading ? 'Creando...' : 'Crear Receta'}
         </button>
         
         {/* Información adicional */}
         <div className="mt-4 space-y-4">
           {/* Información sobre vinculación */}
           <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
             <div className="flex items-start">
               <div className="flex-shrink-0">
                 <DocumentTextIcon className="h-5 w-5 text-green-400" />
               </div>
               <div className="ml-3">
                 <h3 className="text-sm font-medium text-green-800">
                   Vinculación de Recetas
                 </h3>
                 <div className="mt-2 text-sm text-green-700">
                   <p>• Si seleccionas una consulta, la receta se vinculará automáticamente a esa consulta</p>
                   <p>• La receta aparecerá en el historial clínico del paciente</p>
                   <p>• Si no seleccionas consulta, la receta será independiente</p>
                 </div>
               </div>
             </div>
           </div>
           
           {/* Información sobre ubicación */}
           <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
             <div className="flex items-start">
               <div className="flex-shrink-0">
                 <DocumentTextIcon className="h-5 w-5 text-blue-400" />
               </div>
               <div className="ml-3 flex-1">
                 <h3 className="text-sm font-medium text-blue-800">
                   ¿Dónde encontrar mis recetas?
                 </h3>
                 <div className="mt-2 text-sm text-blue-700">
                   <p>• Ve a la pestaña <strong>"Recetas Emitidas"</strong> para ver todas las recetas creadas</p>
                   <p>• También puedes ver estadísticas en la pestaña <strong>"Estadísticas"</strong></p>
                 </div>
                 <div className="mt-3">
                   <button
                     onClick={() => setActiveTab && setActiveTab('list')}
                     className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                   >
                     <DocumentTextIcon className="h-4 w-4 mr-2" />
                     Ver Recetas Emitidas
                   </button>
                 </div>
               </div>
             </div>
           </div>
         </div>
      </div>
    </div>
  );
}

// Componente para listar recetas
function RecipeList({ recipes, onRefresh, loading, isAssistant }) {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [search, setSearch] = useState('');
  const [sendingId, setSendingId] = useState(null);

  const filteredRecipes = recipes.filter((r) => {
    const name = `${r.paciente?.firstName || ''} ${r.paciente?.lastName || ''}`.toLowerCase();
    const email = (r.paciente?.user?.email || r.paciente?.email || '').toLowerCase();
    const padecimiento = (r.padecimiento || r.consulta?.clinicalCase?.padecimiento || '').toLowerCase();
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return name.includes(q) || email.includes(q) || padecimiento.includes(q);
  });

  const shareByEmail = async (recipe) => {
    try {
      setSendingId(recipe.id);
      const res = await fetch(getApiUrl(`/api/recipes/${recipe.id}/email-to-patient`), {
        method: 'POST',
        headers: { ...getApiHeaders(), 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Receta enviada por correo al paciente');
      } else {
        toast.error(data.message || 'No se pudo enviar la receta por correo');
      }
    } catch (e) {
      toast.error('Error al enviar correo: ' + e.message);
    } finally {
      setSendingId(null);
    }
  };

  const viewRecipe = async (recipe) => {
    try {
      console.log('Loading recipe details for:', recipe.id);
      const res = await fetch(getApiUrl(`/api/recipes/${recipe.id}`), {
        headers: getApiHeaders()
      });
      
      console.log('Recipe details response status:', res.status);

      if (res.ok) {
        const response = await res.json();
        console.log('Recipe details response:', response);
        
        if (response.success && response.data) {
          setSelectedRecipe(response.data);
        } else {
          console.error('Invalid response format:', response);
          toast.error('Error: Formato de respuesta inválido');
        }
      } else {
        console.error('Failed to load recipe details:', res.status);
        const errorText = await res.text();
        console.error('Error response:', errorText);
        toast.error('Error al cargar detalles de la receta: ' + res.status);
      }
    } catch (error) {
      console.error('Error loading recipe details:', error);
      toast.error('Error al cargar detalles de la receta: ' + error.message);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta receta?')) {
      return;
  }

    try {
      console.log('Deleting recipe with ID:', recipeId);
      const res = await fetch(getApiUrl(`/api/recipes/${recipeId}`), {
        method: 'DELETE',
        headers: getApiHeaders()
      });

      console.log('Delete response status:', res.status);
      
      if (res.ok) {
      const data = await res.json();
        console.log('Delete response data:', data);
        toast.success('Receta eliminada exitosamente');
        onRefresh();
      } else {
        console.error('Failed to delete recipe:', res.status);
        const errorText = await res.text();
        console.error('Error response:', errorText);
        toast.error('Error al eliminar receta: ' + res.status);
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      toast.error('Error al eliminar receta: ' + error.message);
    }
  };

  const openRecipePdf = async (recipe) => {
    try {
      const res = await fetch(getApiUrl(`/api/recipes/${recipe.id}/pdf`), {
        headers: getApiHeaders()
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receta_${recipe.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('PDF descargado exitosamente');
      } else {
        console.error('Failed to download PDF:', res.status);
        const errorText = await res.text();
        console.error('Error response:', errorText);
        toast.error('Error al descargar PDF: ' + res.status);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Error al descargar PDF: ' + error.message);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 sm:p-6 shadow w-full max-w-full overflow-hidden">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <DocumentTextIcon className="w-5 h-5 mr-2" />
        Recetas Emitidas
      </h3>
      {/* Search bar */}
      <div className="mb-4">
        <div className="relative w-full max-w-xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o padecimiento..."
            className="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <MagnifyingGlassIcon className="w-5 h-5" />
          </span>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => (
            <div key={recipe.id} className="border rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-medium">
                      Receta #{recipe.id.slice(0, 8)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(recipe.fechaEmision).toLocaleDateString()}
                    </span>
                    {recipe.esRecetaMedicamento && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        Medicamentos
                      </span>
                    )}
                    {recipe.esSolicitudEstudios && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        Estudios
                      </span>
                    )}
        </div>
                  
                  {recipe.observaciones && (
                    <p className="text-sm text-gray-600 mb-2">
                      {recipe.observaciones}
                    </p>
                  )}
                  
                                     <div className="text-sm text-gray-500">
                     Paciente: {recipe.paciente?.firstName} {recipe.paciente?.lastName}
        </div>
      </div>

                <div className="flex flex-wrap gap-2 sm:gap-4 flex-shrink-0">
                  <button
                    onClick={() => viewRecipe(recipe)}
                    className="text-blue-600 hover:text-blue-700 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                    title="Ver detalles"
                  >
                    <EyeIcon className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => shareByEmail(recipe)}
                    disabled={sendingId === recipe.id}
                    className="text-indigo-600 hover:text-indigo-700 p-2 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                    title="Compartir por email"
                  >
                    {sendingId === recipe.id ? (
                      <span className="text-xs">Enviando...</span>
                    ) : (
                      <ShareIcon className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => openRecipePdf(recipe)}
                    className="text-green-600 hover:text-green-700 p-2 rounded-lg hover:bg-green-50 transition-colors"
                    title="Ver PDF"
                  >
                    <DocumentTextIcon className="w-6 h-6" />
                  </button>
                  {!isAssistant && (
                    <button
                      onClick={() => deleteRecipe(recipe.id)}
                      className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <TrashIcon className="w-6 h-6" />
                    </button>
                  )}
        </div>
        </div>
        </div>
          ))}
          
          {recipes.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No hay recetas emitidas
              </div>
          )}
        </div>
      )}

      {/* Modal de detalles */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Detalles de la Receta</h3>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <strong>ID de Receta:</strong> {selectedRecipe.id}
              </div>
              
              <div>
                <strong>Fecha:</strong> {selectedRecipe.fechaEmision ? new Date(selectedRecipe.fechaEmision).toLocaleString() : 'No especificada'}
              </div>
              
              <div>
                <strong>Paciente:</strong> {selectedRecipe.paciente?.firstName} {selectedRecipe.paciente?.lastName}
              </div>

              <div>
                <strong>Profesional:</strong> {selectedRecipe.doctor?.user?.firstName} {selectedRecipe.doctor?.user?.lastName}
              </div>

              {selectedRecipe.observaciones && (
                <div>
                  <strong>Observaciones:</strong> {selectedRecipe.observaciones}
                </div>
              )}
              
              {selectedRecipe.esRecetaMedicamento && selectedRecipe.detalleMedicamentos?.length > 0 && (
              <div>
                  <strong>Medicamentos:</strong>
                  <div className="mt-2 space-y-2">
                    {selectedRecipe.detalleMedicamentos.map((med, index) => (
                      <div key={index} className="border rounded p-2">
                        <div><strong>Medicamento:</strong> {med.medicamento}</div>
                        <div><strong>Dosis:</strong> {med.dosis}</div>
                        <div><strong>Frecuencia:</strong> {med.frecuencia}</div>
                        {med.duracion && <div><strong>Duración:</strong> {med.duracion}</div>}
                      </div>
                    ))}
                  </div>
              </div>
              )}
              
              {selectedRecipe.esSolicitudEstudios && selectedRecipe.estudiosSolicitados?.length > 0 && (
                <div>
                  <strong>Estudios Solicitados:</strong>
                  <div className="mt-2 space-y-2">
                    {selectedRecipe.estudiosSolicitados.map((estudio, index) => (
                      <div key={index} className="border rounded p-2">
                        <div><strong>Estudio:</strong> {estudio.nombreEstudio}</div>
                        {estudio.indicaciones && <div><strong>Indicaciones:</strong> {estudio.indicaciones}</div>}
            </div>
          ))}
                  </div>
                </div>
              )}
        </div>
      </div>
        </div>
      )}
    </div>
  );
}

// Componente principal
export default function Prescriptions() {
  const { user } = useAuth();
  const isAssistant = user?.role === 'ASISTENTE';
  const [activeTab, setActiveTab] = useState('create');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Si hay patientId en la URL, abrir la pestaña de crear receta
  useEffect(() => {
    const patientId = searchParams.get('patientId');
    if (patientId && !isAssistant) {
      setActiveTab('create');
    }
  }, [searchParams, isAssistant]);

  useEffect(() => {
    if (isAssistant && activeTab === 'create') {
      setActiveTab('list');
    }
  }, [isAssistant, activeTab]);

  useEffect(() => {
    fetchRecipes();
  }, []);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const selectedDoctorId = localStorage.getItem('selectedDoctorId');
      const doctorId = isAssistant
        ? selectedDoctorId
        : JSON.parse(localStorage.getItem('user')).doctorId;

      if (!doctorId) {
        toast.error('No se pudo determinar el doctor seleccionado');
        setRecipes([]);
        return;
      }

      console.log('Fetching recipes for doctorId:', doctorId);
      
      const res = await fetch(getApiUrl(`/api/recipes/doctor/${doctorId}`), {
        headers: getApiHeaders()
      });
      
      console.log('Response status:', res.status);
      const response = await res.json();
      console.log('Response data:', response);
      
      // El backend devuelve { success: true, data: [...], pagination: {...} }
      if (response.success && Array.isArray(response.data)) {
        const normalized = response.data.map((r) => ({
          ...r,
          padecimiento: r.padecimiento || r?.consulta?.clinicalCase?.padecimiento || ''
        }));
        console.log('Setting recipes (normalized):', normalized);
        setRecipes(normalized);
      } else {
        console.log('No recipes found or invalid response');
        setRecipes([]);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
      toast.error('Error al cargar recetas');
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRecipeCreated = () => {
    fetchRecipes();
    toast.success('Receta creada exitosamente. Ve a la pestaña "Recetas Emitidas" para verla.');
  };



  const testBackendConnection = async () => {
    try {
      console.log('Testing backend connection...');
      console.log('Token from localStorage:', localStorage.getItem('token') ? 'Present' : 'Missing');
      
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('❌ No hay token de autenticación. Por favor, inicia sesión.');
        return;
      }
      
      const res = await fetch(getApiUrl('/api/recipes/test'), {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);
      
      if (res.ok) {
        const data = await res.json();
        console.log('Backend test response:', data);
        toast.success('✅ Conexión exitosa: ' + (data.message || 'Backend funcionando correctamente'));
      } else {
        console.error('Backend test failed with status:', res.status);
        const errorText = await res.text();
        console.error('Error response:', errorText);
        toast.error('❌ Error de conexión: ' + res.status + ' - ' + errorText);
      }
    } catch (error) {
      console.error('Backend test error:', error);
      toast.error('❌ Error de conexión: ' + error.message);
    }
  };

  return (
    <div className="w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Sistema de Recetas Médicas</h1>
        <button
          onClick={testBackendConnection}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 whitespace-nowrap self-start sm:self-auto"
        >
          Probar Conexión
        </button>
      </div>

      {/* Tabs - scroll horizontal en móvil */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0 pb-px pr-2">
          {!isAssistant && (
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Crear Receta
            </button>
          )}
          <button
            onClick={() => setActiveTab('list')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Recetas Emitidas
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Estadísticas
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex-shrink-0 whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DocumentTextIcon className="w-4 h-4 inline mr-1" />
            Configuración
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="w-full">
        {!isAssistant && activeTab === 'create' && (
          <CreateRecipe onRecipeCreated={handleRecipeCreated} setActiveTab={setActiveTab} />
        )}
        
        {activeTab === 'list' && (
          <RecipeList 
            recipes={recipes} 
            onRefresh={fetchRecipes}
            loading={loading}
            isAssistant={isAssistant}
          />
        )}
        
        {activeTab === 'stats' && (
          <RecipeStats />
        )}
        
        {activeTab === 'config' && (
          <DoctorProfileConfig />
        )}
        </div>
      </div>
  );
}