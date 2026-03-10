import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const CollaborativeWork = ({ patientId, clinicalCaseId }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [newCollaborator, setNewCollaborator] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (clinicalCaseId) {
      fetchCollaborators();
    }
  }, [clinicalCaseId]);

  const fetchCollaborators = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/collaborative-work/collaborators/${clinicalCaseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCollaborators(data);
      }
    } catch (error) {
      console.error('Error al obtener colaboradores:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCollaborator = async () => {
    if (!newCollaborator.trim()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/collaborative-work/collaborators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          padecimientoId: clinicalCaseId,
          doctorId: newCollaborator,
          rol: 'colaborador'
        })
      });

      if (response.ok) {
        setNewCollaborator('');
        fetchCollaborators();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error al agregar colaborador:', error);
      alert('Error al agregar colaborador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        Trabajo Colaborativo
      </h3>
      
      {/* Agregar colaborador */}
      <div className="mb-6">
        <h4 className="text-md font-medium mb-2 text-gray-700">
          Agregar Colaborador
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ID del doctor colaborador"
            value={newCollaborator}
            onChange={(e) => setNewCollaborator(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addCollaborator}
            disabled={loading || !newCollaborator.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Agregando...' : 'Agregar'}
          </button>
        </div>
      </div>

      {/* Lista de colaboradores */}
      <div>
        <h4 className="text-md font-medium mb-2 text-gray-700">
          Colaboradores ({collaborators.length})
        </h4>
        {loading ? (
          <p className="text-gray-500">Cargando colaboradores...</p>
        ) : collaborators.length > 0 ? (
          <div className="space-y-2">
            {collaborators.map((collaborator) => (
              <div key={collaborator.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                <div>
                  <p className="font-medium text-gray-800">
                    {collaborator.doctor.user.firstName} {collaborator.doctor.user.lastName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {collaborator.doctor.user.email} • {collaborator.rol}
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  collaborator.rol === 'titular' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {collaborator.rol}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No hay colaboradores asignados</p>
        )}
      </div>
    </div>
  );
};

export default CollaborativeWork; 