import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  UserPlusIcon, 
  CalendarIcon, 
  DocumentTextIcon, 
  FolderIcon
} from '@heroicons/react/24/outline';
import { useReadOnlyMode } from '../../hooks/useReadOnlyMode';
import { toast } from 'react-toastify';

const QuickActions = () => {
  const navigate = useNavigate();
  const { isReadOnly, message } = useReadOnlyMode();

  const quickActions = [
    {
      name: 'Registrar Paciente',
      description: 'Agregar nuevo paciente al sistema',
      icon: UserPlusIcon,
      href: '/dashboard/patients',
      color: 'bg-blue-500 hover:bg-blue-600',
      iconColor: 'text-blue-600'
    },
    {
      name: 'Nueva Cita',
      description: 'Programar cita con paciente',
      icon: CalendarIcon,
      href: '/dashboard/calendario',
      color: 'bg-green-500 hover:bg-green-600',
      iconColor: 'text-green-600'
    },
    {
      name: 'Crear Receta',
      description: 'Generar receta médica',
      icon: DocumentTextIcon,
      href: '/dashboard/prescriptions',
      color: 'bg-purple-500 hover:bg-purple-600',
      iconColor: 'text-purple-600'
    },
    {
      name: 'Historial Clínico',
      description: 'Ver expedientes médicos',
      icon: FolderIcon,
      href: '/dashboard/medical-records',
      color: 'bg-indigo-500 hover:bg-indigo-600',
      iconColor: 'text-indigo-600'
    }
  ];

  const handleActionClick = (action) => {
    // Las acciones de solo lectura (ver historial) siempre están permitidas
    if (action.name === 'Historial Clínico') {
      navigate(action.href);
      return;
    }

    // Si está en modo solo lectura, bloquear acciones de escritura
    if (isReadOnly) {
      toast.error(message || 'Tu suscripción está cancelada. Solo puedes consultar información.');
      return;
    }

    navigate(action.href);
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Acciones Rápidas</h3>
        <p className="text-sm text-gray-500">Acceso directo a las funcionalidades más utilizadas</p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const isReadOnlyAction = action.name !== 'Historial Clínico';
            const disabled = isReadOnly && isReadOnlyAction;
            
            return (
              <button
                key={action.name}
                onClick={() => handleActionClick(action)}
                disabled={disabled}
                className={`${action.color} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} text-white rounded-lg p-4 text-center transition-all duration-200 transform ${disabled ? '' : 'hover:scale-105'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
              <div className="flex flex-col items-center space-y-2">
                <action.icon className={`h-8 w-8 ${action.iconColor} bg-white rounded-full p-1`} />
                <div>
                  <p className="text-sm font-medium">{action.name}</p>
                  <p className="text-xs opacity-90">{action.description}</p>
                </div>
              </div>
            </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
