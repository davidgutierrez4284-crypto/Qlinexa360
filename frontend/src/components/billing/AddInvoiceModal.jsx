import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';

const AddInvoiceModal = ({ open, onClose, patient, onSave }) => {
  const [pdf, setPdf] = useState(null);
  const [xml, setXml] = useState(null);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (type === 'pdf' && file.type !== 'application/pdf') {
      setError('El archivo PDF debe ser de tipo PDF.');
      return;
    }
    if (type === 'xml' && file.type !== 'text/xml' && !file.name.endsWith('.xml')) {
      setError('El archivo XML debe tener extensión .xml.');
      return;
    }
    setError('');
    if (type === 'pdf') setPdf(file);
    if (type === 'xml') setXml(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pdf || !xml || !invoiceDate) {
      setError('Todos los campos son obligatorios.');
      return;
    }
    setLoading(true);
    try {
      await onSave({ pdf, xml, invoiceDate });
      setPdf(null); setXml(null); setInvoiceDate(''); setError('');
    } catch (err) {
      setError('Error al subir la factura.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="fixed z-50 inset-0 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full z-10 p-6 relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
          <Dialog.Title className="text-lg font-bold mb-2">Subir factura para {patient.firstName} {patient.lastName}</Dialog.Title>
          <div className="text-xs text-gray-500 mb-4">RFC: {patient.rfc}</div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de facturación</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo PDF</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={e => handleFileChange(e, 'pdf')}
                className="w-full"
                required
              />
              {pdf && <div className="text-xs text-green-600 mt-1">{pdf.name}</div>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Archivo XML</label>
              <input
                type="file"
                accept=".xml,text/xml"
                onChange={e => handleFileChange(e, 'xml')}
                className="w-full"
                required
              />
              {xml && <div className="text-xs text-green-600 mt-1">{xml.name}</div>}
            </div>
            {error && <div className="text-xs text-red-500">{error}</div>}
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
                {loading ? 'Subiendo...' : 'Subir factura'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Dialog>
  );
};

export default AddInvoiceModal; 