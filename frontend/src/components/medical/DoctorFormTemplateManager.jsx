import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import {
  getDoctorFormTemplates,
  createDoctorFormTemplate,
  updateDoctorFormTemplate,
  deleteDoctorFormTemplate,
} from '../../services/doctorFormTemplateService';

const DoctorFormTemplateManager = ({ isOpen, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [numericLabels, setNumericLabels] = useState(Array(10).fill(''));
  const [textLabels, setTextLabels] = useState(Array(10).fill(''));

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getDoctorFormTemplates();
      setTemplates(data || []);
    } catch (err) {
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadTemplates();
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setNumericLabels(Array(10).fill(''));
    setTextLabels(Array(10).fill(''));
  };

  const handleEdit = (t) => {
    setEditingId(t.id);
    setFormName(t.name);
    const numeric = Array(10).fill('');
    const text = Array(10).fill('');
    const numericFields = (t.fields || []).filter(f => f.fieldType === 'NUMBER' || f.fieldType === 'numeric');
    const textFields = (t.fields || []).filter(f => f.fieldType === 'TEXT' || f.fieldType === 'text');
    numericFields.forEach((f, i) => { if (i < 10) numeric[i] = f.label || ''; });
    textFields.forEach((f, i) => { if (i < 10) text[i] = f.label || ''; });
    setNumericLabels(numeric);
    setTextLabels(text);
  };

  const buildFields = () => {
    const fields = [];
    numericLabels.filter(Boolean).forEach((label) => fields.push({ fieldType: 'numeric', label }));
    textLabels.filter(Boolean).forEach((label) => fields.push({ fieldType: 'text', label }));
    return fields;
  };

  const handleSave = async () => {
    const fields = buildFields();
    if (!formName.trim()) {
      toast.error('El nombre del formulario es requerido');
      return;
    }
    if (fields.length === 0) {
      toast.error('Debe agregar al menos un campo');
      return;
    }

    try {
      if (editingId) {
        await updateDoctorFormTemplate(editingId, { name: formName.trim(), fields });
        toast.success('Plantilla actualizada');
      } else {
        await createDoctorFormTemplate(formName.trim(), fields);
        toast.success('Plantilla creada');
      }
      resetForm();
      loadTemplates();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta plantilla?')) return;
    try {
      await deleteDoctorFormTemplate(id);
      toast.success('Plantilla eliminada');
      if (editingId === id) resetForm();
      loadTemplates();
    } catch (err) {
      toast.error('Error al eliminar');
    }
  };

  const updateLabel = (arr, setter, idx, val) => {
    const next = [...arr];
    next[idx] = val;
    setter(next);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={() => { resetForm(); onClose(); }} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <Dialog.Title className="text-lg font-semibold text-gray-900">
              Formularios personalizados
            </Dialog.Title>
            <button onClick={() => { resetForm(); onClose(); }} className="p-2 rounded-lg hover:bg-gray-100">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <p className="text-sm text-gray-600">
              Crea plantillas con hasta 10 campos numéricos y 10 de texto. Los datos se guardan y pueden graficarse.
            </p>

            {/* Formulario */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-gray-800">
                {editingId ? 'Editar plantilla' : 'Nueva plantilla'}
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Control de presión"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campos numéricos (max 10)</label>
                <div className="grid grid-cols-2 gap-2">
                  {numericLabels.map((l, i) => (
                    <input
                      key={`n-${i}`}
                      type="text"
                      value={l}
                      onChange={(e) => updateLabel(numericLabels, setNumericLabels, i, e.target.value)}
                      placeholder={`Campo numérico ${i + 1}`}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Campos de texto (max 10)</label>
                <div className="grid grid-cols-2 gap-2">
                  {textLabels.map((l, i) => (
                    <input
                      key={`t-${i}`}
                      type="text"
                      value={l}
                      onChange={(e) => updateLabel(textLabels, setTextLabels, i, e.target.value)}
                      placeholder={`Campo texto ${i + 1}`}
                      className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                >
                  {editingId ? 'Actualizar' : 'Crear'} plantilla
                </button>
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>

            {/* Lista de plantillas */}
            <div>
              <h4 className="font-medium text-gray-800 mb-2">Mis plantillas</h4>
              {loading ? (
                <div className="text-gray-500 text-sm">Cargando...</div>
              ) : templates.length === 0 ? (
                <div className="text-gray-500 text-sm">No hay plantillas. Crea una arriba.</div>
              ) : (
                <ul className="space-y-2">
                  {templates.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between p-3 bg-white border rounded-lg"
                    >
                      <span className="font-medium">{t.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(t)}
                          className="p-1.5 text-gray-500 hover:text-blue-600"
                          title="Editar"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600"
                          title="Eliminar"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default DoctorFormTemplateManager;
