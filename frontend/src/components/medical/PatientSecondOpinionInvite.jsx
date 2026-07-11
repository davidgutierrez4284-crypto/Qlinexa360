import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, EnvelopeIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-toastify';
import {
  searchDoctorsForCollaboration,
  patientInviteRegisteredCollaborator,
  patientInviteExternalCollaborator
} from '../../services/patientService';

/**
 * Invitación a colaboración / segunda opinión iniciada por el paciente.
 */
const PatientSecondOpinionInvite = ({ clinicalCaseId, onInvited }) => {
  const [mode, setMode] = useState('registered');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [externalEmail, setExternalEmail] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchDoctorsForCollaboration(query);
        setResults(Array.isArray(data) ? data.filter((p) => p.role === 'DOCTOR') : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setResults([]);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleRegistered = async (e) => {
    e.preventDefault();
    if (!selected?.id) {
      toast.error('Busca y selecciona un profesional de la lista');
      return;
    }
    setSubmitting(true);
    try {
      const data = await patientInviteRegisteredCollaborator(clinicalCaseId, selected.id);
      toast.success(data?.message || 'Solicitud enviada. Revisa tu correo para firmar el consentimiento.');
      onInvited?.();
      setSelected(null);
      setQuery('');
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || err.message;
      toast.error(msg || 'No se pudo enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExternal = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(externalEmail.trim())) {
      toast.error('Ingresa un correo electrónico válido');
      return;
    }
    setSubmitting(true);
    try {
      const data = await patientInviteExternalCollaborator(clinicalCaseId, externalEmail.trim());
      toast.success(data?.message || 'Invitación enviada');
      onInvited?.();
      setExternalEmail('');
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(msg || 'No se pudo enviar la invitación');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4 sm:p-5">
      <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
        <UserGroupIcon className="h-5 w-5 text-blue-600" />
        Segunda opinión o colaboración
      </h3>
      <p className="text-sm text-slate-600 mt-1 mb-3">
        Puedes invitar a otro profesional de la plataforma o indicar un correo para quien aún no está dado
        de alta. En ambos casos, para compartir el caso en Qlinexa360 hace falta el procedimiento de aviso
        de privacidad (te llegará al correo). También puedes usar <strong>Imprimir / PDF</strong> en esta
        misma pantalla para llevar tu historial a quien tú elijas por fuera de la app.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('registered')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            mode === 'registered' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Profesional en Qlinexa360
        </button>
        <button
          type="button"
          onClick={() => setMode('external')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium ${
            mode === 'external' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          Invitar por correo
        </button>
      </div>

      {mode === 'registered' && (
        <form onSubmit={handleRegistered} className="space-y-3">
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">Buscar por nombre o correo</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelected(null);
                  }}
                  placeholder="Mínimo 2 caracteres"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md"
                  autoComplete="off"
                />
                {searching && <p className="text-xs text-slate-500 mt-1">Buscando…</p>}
                {results.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-md shadow-lg">
                    {results.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                          onClick={() => {
                            setSelected(d);
                            setQuery(`${d.firstName} ${d.lastName}`.trim());
                            setResults([]);
                          }}
                        >
                          {d.firstName} {d.lastName}
                          {d.specialization ? <span className="text-slate-500"> — {d.specialization}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {selected && (
              <p className="text-sm text-slate-600 mt-2">
                Seleccionado: <strong>{selected.firstName} {selected.lastName}</strong>
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar solicitud (consentimiento por correo)'}
          </button>
        </form>
      )}

      {mode === 'external' && (
        <form onSubmit={handleExternal} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Correo del profesional</label>
            <div className="flex gap-2">
              <EnvelopeIcon className="h-5 w-5 text-slate-400 flex-shrink-0 mt-2" />
              <input
                type="email"
                value={externalEmail}
                onChange={(e) => setExternalEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Recibirá un correo para registrarse como profesional en Qlinexa360. No comparte el expediente
              automáticamente hasta que se complete el alta y la colaboración quede acordada.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Enviando…' : 'Enviar invitación por correo'}
          </button>
        </form>
      )}
    </div>
  );
};

export default PatientSecondOpinionInvite;
