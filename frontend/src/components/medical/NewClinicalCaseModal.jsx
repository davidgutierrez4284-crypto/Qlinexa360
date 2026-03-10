import React, { useState } from 'react';
import Modal from 'react-modal';
import { toast } from 'react-toastify';

const NewClinicalCaseModal = ({ isOpen, onClose, onSubmit, loading }) => {
  const [padecimiento, setPadecimiento] = useState('');

  const handleChange = (e) => {
    // Limitar a 20 caracteres incluyendo espacios
    if (e.target.value.length <= 20) {
      setPadecimiento(e.target.value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!padecimiento.trim()) {
      toast.error('El campo padecimiento es obligatorio');
      return;
    }
    if (padecimiento.length > 20) {
      toast.error('El padecimiento debe tener máximo 20 caracteres');
      return;
    }
    onSubmit({ padecimiento: padecimiento.trim() });
    setPadecimiento('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Nuevo caso clínico"
      className="bg-white rounded-xl p-6 max-w-md mx-auto mt-24 shadow-xl border border-gray-200 outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
      ariaHideApp={false}
    >
      <h2 className="text-2xl font-bold mb-4">Registrar nuevo caso clínico</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Padecimiento *
            <span className="ml-1 text-gray-400 cursor-pointer" title="Describe el padecimiento en 1 o 2 palabras. El detalle del padecimiento se debe registrar en el historial de consultas. Este campo resumen de padecimiento permitirá clasificar y ordenar la información en otras pantallas.">ℹ️</span>
          </label>
          <input
            type="text"
            name="padecimiento"
            value={padecimiento}
            onChange={handleChange}
            className="form-input mt-1 w-full"
            required
            maxLength={20}
            placeholder="Ej: Diabetes, Fractura"
            autoFocus
          />
          <div className="text-xs text-gray-500 mt-1">Máximo 20 caracteres</div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50">{loading ? 'Creando...' : 'Crear caso clínico'}</button>
        </div>
      </form>
    </Modal>
  );
};

export default NewClinicalCaseModal; 