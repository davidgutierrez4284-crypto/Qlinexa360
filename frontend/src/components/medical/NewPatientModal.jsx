import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import PhoneInput from '../common/PhoneInput';

const NewPatientModal = ({ isOpen, onClose, onSubmit }) => {
  const [patientData, setPatientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    setPatientData({ ...patientData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(patientData);
      // Limpiar el formulario tras el registro exitoso
      setPatientData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
      });
      // No cerrar el modal aquí, se cerrará desde el componente padre
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo registrar al paciente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Limpiar formulario cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setPatientData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
      });
      setIsSubmitting(false);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-xl font-bold text-gray-800 flex justify-between items-center">
            Registrar Nuevo Paciente
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
              <XMarkIcon className="h-6 w-6 text-gray-600" />
            </button>
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Campos del formulario */}
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">Nombre</label>
              <input type="text" name="firstName" id="firstName" value={patientData.firstName} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Apellido</label>
              <input type="text" name="lastName" id="lastName" value={patientData.lastName} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 flex items-center">
                Correo Electrónico (Opcional)
                <div className="relative ml-1 group">
                  <InformationCircleIcon className="h-4 w-4 text-blue-500 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-2 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none">
                    A este correo le llegará una invitación a tu paciente y podrá entrar a la plataforma, le llegarán las recetas, citas y eventos de calendario. Puedes capturar este dato después.
                  </div>
                </div>
              </label>
              <input type="email" name="email" id="email" value={patientData.email} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="email@ejemplo.com" />
            </div>
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">Fecha de Nacimiento</label>
              <input type="date" name="dateOfBirth" id="dateOfBirth" value={patientData.dateOfBirth} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <PhoneInput name="phone" label="Teléfono (Opcional)" value={patientData.phone} onChange={handleChange} placeholder="Ej: 55 1234 5678" />
            </div>
            {/* Botones */}
            <div className="flex justify-end space-x-3 pt-4">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                Cancelar
              </button>
              <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {isSubmitting ? 'Registrando...' : 'Registrar Paciente'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default NewPatientModal; 