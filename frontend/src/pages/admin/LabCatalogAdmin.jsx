import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import {
  createAdminAnalyteCatalog,
  listAdminAnalyteCatalog,
  updateAdminAnalyteCatalog,
} from '../../services/smartLabService';
import Loader from '../../components/common/Loader';

const emptyForm = {
  category: '',
  name: '',
  defaultUnit: '',
  defaultReferenceLow: '',
  defaultReferenceHigh: '',
  active: true,
};

const LabCatalogAdmin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listAdminAnalyteCatalog();
      setItems(data?.items || data?.catalog || data || []);
    } catch (e) {
      if (e.response?.status === 404) {
        toast.info('El API de catálogo admin aún no está disponible en el servidor.');
      } else {
        toast.error('Error al cargar catálogo.');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      defaultReferenceLow: form.defaultReferenceLow === '' ? null : Number(form.defaultReferenceLow),
      defaultReferenceHigh: form.defaultReferenceHigh === '' ? null : Number(form.defaultReferenceHigh),
    };
    try {
      if (editId) {
        await updateAdminAnalyteCatalog(editId, payload);
        toast.success('Analito actualizado.');
      } else {
        await createAdminAnalyteCatalog(payload);
        toast.success('Analito creado.');
      }
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch {
      toast.error('No se pudo guardar (verifica que el backend exponga /admin/catalog).');
    }
  };

  const startEdit = (row) => {
    setEditId(row.id);
    setForm({
      category: row.category || '',
      name: row.name || '',
      defaultUnit: row.defaultUnit || '',
      defaultReferenceLow: row.defaultReferenceLow ?? '',
      defaultReferenceHigh: row.defaultReferenceHigh ?? '',
      active: row.active !== false,
    });
  };

  return (
    <div className="w-full max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Catálogo de parámetros de laboratorio</h1>
      <LabDisclaimer />
      <form onSubmit={save} className="bg-white p-4 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="rounded-md border-gray-300" placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        <input className="rounded-md border-gray-300" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input className="rounded-md border-gray-300" placeholder="Unidad" value={form.defaultUnit} onChange={(e) => setForm({ ...form, defaultUnit: e.target.value })} />
        <input type="number" className="rounded-md border-gray-300" placeholder="Ref. baja" value={form.defaultReferenceLow} onChange={(e) => setForm({ ...form, defaultReferenceLow: e.target.value })} />
        <input type="number" className="rounded-md border-gray-300" placeholder="Ref. alta" value={form.defaultReferenceHigh} onChange={(e) => setForm({ ...form, defaultReferenceHigh: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Activo</label>
        <div className="md:col-span-2 flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">{editId ? 'Actualizar' : 'Agregar'}</button>
          {editId ? <button type="button" className="px-4 py-2 border rounded-md text-sm" onClick={() => { setEditId(null); setForm(emptyForm); }}>Cancelar</button> : null}
        </div>
      </form>
      {loading ? <Loader /> : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-3 py-2 text-left">Categoría</th>
              <th className="px-3 py-2 text-left">Nombre</th>
              <th className="px-3 py-2 text-left">Unidad</th>
              <th className="px-3 py-2 text-left">Referencia</th>
              <th className="px-3 py-2 text-left">Activo</th>
              <th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2">{row.defaultUnit}</td>
                  <td className="px-3 py-2">{row.defaultReferenceLow ?? '—'} – {row.defaultReferenceHigh ?? '—'}</td>
                  <td className="px-3 py-2">{row.active ? 'Sí' : 'No'}</td>
                  <td className="px-3 py-2"><button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(row)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LabCatalogAdmin;
