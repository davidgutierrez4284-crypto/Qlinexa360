import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { getApiUrl, getApiHeaders } from '../../utils/api';
import { GlobeAmericasIcon } from '@heroicons/react/24/outline';

const TIMEZONE_OPTIONS = [
  { value: 'America/Mexico_City', label: 'México - Centro (CDMX, Monterrey, Guadalajara)' },
  { value: 'America/Tijuana', label: 'México - Noroeste (Tijuana, Mexicali)' },
  { value: 'America/Hermosillo', label: 'México - Pacífico (Hermosillo, Mazatlán)' },
  { value: 'America/Cancun', label: 'México - Sureste (Cancún, Mérida)' },
  { value: 'America/Matamoros', label: 'México - Frontera noreste (Matamoros, Reynosa)' },
  { value: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { value: 'America/Santiago', label: 'Chile (Santiago)' },
  { value: 'America/Lima', label: 'Perú (Lima)' },
  { value: 'America/Guayaquil', label: 'Ecuador (Guayaquil, Quito)' },
  { value: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { value: 'America/Guatemala', label: 'Guatemala' },
  { value: 'America/Costa_Rica', label: 'Costa Rica' },
  { value: 'America/Panama', label: 'Panamá' },
  { value: 'America/La_Paz', label: 'Bolivia (La Paz)' },
  { value: 'America/Asuncion', label: 'Paraguay (Asunción)' },
  { value: 'America/Montevideo', label: 'Uruguay (Montevideo)' }
];

const TimezoneConfigSection = () => {
  const [timezone, setTimezone] = useState('America/Mexico_City');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTimezone();
  }, []);

  const fetchTimezone = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/doctor-profile/config'), {
        headers: getApiHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.timezone) {
          setTimezone(data.data.timezone);
        }
      }
    } catch (error) {
      console.error('Error fetching timezone:', error);
      toast.error('Error al cargar la zona horaria');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(getApiUrl('/api/doctor-profile/config'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getApiHeaders()
        },
        body: JSON.stringify({ timezone })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Zona horaria guardada correctamente');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || 'Error al guardar la zona horaria');
      }
    } catch (error) {
      console.error('Error saving timezone:', error);
      toast.error('Error de conexión al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <GlobeAmericasIcon className="h-5 w-5 mr-2 text-blue-600" />
          Zona horaria del consultorio
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Selecciona la zona horaria donde atiendes. Esto asegura que las citas, horarios disponibles, recordatorios y correos se muestren con la hora correcta (ej. Tijuana, Colombia, Argentina).
        </p>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1 max-w-md">
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimezoneConfigSection;
