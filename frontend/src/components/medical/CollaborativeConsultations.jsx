import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

const CollaborativeConsultations = ({ patientId, clinicalCaseId }) => {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);
  const { token, user } = useAuth();

  useEffect(() => {
    if (patientId && clinicalCaseId) {
      fetchConsultations();
    }
  }, [patientId, clinicalCaseId]);

  const fetchConsultations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/collaborative-work/consultations/${patientId}/${clinicalCaseId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConsultations(data);
      }
    } catch (error) {
      console.error('Error al obtener consultas colaborativas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermissionBadge = (consultation) => {
    if (consultation.isAuthor) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
          Autor
        </span>
      );
    } else if (consultation.canEdit) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
          Colaborador
        </span>
      );
    } else {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
          Solo Lectura
        </span>
      );
    }
  };

  const getStatusBadge = (consultation) => {
    if (!consultation.isEditable) {
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
          Bloqueado
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
        Editable
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        Consultas Colaborativas
      </h3>
      
      {loading ? (
        <p className="text-gray-500">Cargando consultas...</p>
      ) : consultations.length > 0 ? (
        <div className="space-y-4">
          {consultations.map((consultation) => (
            <div key={consultation.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-gray-800">
                    Consulta del {new Date(consultation.date || consultation.createdAt).toLocaleDateString('es-ES')}
                  </h4>
                  {getPermissionBadge(consultation)}
                  {getStatusBadge(consultation)}
                </div>
                <div className="text-sm text-gray-600">
                  {consultation.user.firstName} {consultation.user.lastName}
                </div>
              </div>
              
              <div className="mb-3">
                <p className="text-sm text-gray-600 mb-1">
                  <strong>Diagnóstico:</strong>
                </p>
                <p className="text-gray-800">{consultation.diagnosis}</p>
              </div>
              
              {consultation.treatment && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Tratamiento:</strong>
                  </p>
                  <p className="text-gray-800">{consultation.treatment}</p>
                </div>
              )}
              
              {consultation.notes && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Notas:</strong>
                  </p>
                  <p className="text-gray-800">{consultation.notes}</p>
                </div>
              )}
              
              {/* Archivos adjuntos */}
              {consultation.files && consultation.files.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Archivos ({consultation.files.length}):</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {consultation.files.map((file) => (
                      <span key={file.id} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {file.fileName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recetas */}
              {consultation.prescriptions && consultation.prescriptions.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>Recetas ({consultation.prescriptions.length}):</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {consultation.prescriptions.map((prescription) => (
                      <span key={prescription.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                        Receta #{prescription.id.slice(-8)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Acciones */}
              <div className="flex gap-2 mt-4">
                {consultation.canEdit && (
                  <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                    Editar
                  </button>
                )}
                <button className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
                  Ver Detalles
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No hay consultas registradas para este padecimiento</p>
      )}
    </div>
  );
};

export default CollaborativeConsultations; 