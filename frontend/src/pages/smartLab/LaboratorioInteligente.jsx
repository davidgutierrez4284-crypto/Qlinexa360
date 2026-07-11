import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BeakerIcon, ArrowUpTrayIcon, ChartBarIcon, ArrowsRightLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { searchPatients } from '../../services/doctorService';
import { deleteLabReport, listPatientReports } from '../../services/smartLabService';
import { toast } from 'react-toastify';
import LabDisclaimer from '../../components/smartLab/LabDisclaimer';
import LabProcessingStatus from '../../components/smartLab/LabProcessingStatus';
import { formatLabReportListTitle, labReportListTitleClassName, labReportStatusNote } from '../../utils/labReportDisplay';
import Loader from '../../components/common/Loader';
import { debounce } from 'lodash';

const LaboratorioInteligente = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId') || '';
  const [patientId, setPatientId] = useState('');
  const [patientLabel, setPatientLabel] = useState('');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user?.role === 'PATIENT' && user?.patientId) {
      setPatientId(user.patientId);
    } else if (queryPatientId) {
      setPatientId(queryPatientId);
    }
  }, [user, queryPatientId]);

  const loadReports = useCallback(async (pid) => {
    if (!pid) return;
    setLoading(true);
    try {
      const { reports: list } = await listPatientReports(pid);
      setReports(list || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports(patientId);
  }, [patientId, loadReports]);

  const debouncedSearch = useCallback(
    debounce(async (q) => {
      if (q.length < 2) {
        setSearchResults([]);
        return;
      }
      try {
        const data = await searchPatients(q);
        setSearchResults(data || []);
      } catch {
        setSearchResults([]);
      }
    }, 400),
    []
  );

  useEffect(() => {
    debouncedSearch(search);
  }, [search, debouncedSearch]);

  const selectPatient = (p) => {
    setPatientId(p.id);
    setPatientLabel(p.firstName + ' ' + p.lastName);
    setSearch('');
    setSearchResults([]);
    setSearchParams({ patientId: p.id });
  };


  const handleDeleteStudy = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLabReport(deleteTarget.id);
      toast.success('Estudio eliminado.');
      setDeleteTarget(null);
      await loadReports(patientId);
    } catch (e) {
      toast.error(e.response?.data?.message || 'No se pudo eliminar el estudio.');
    } finally {
      setDeleting(false);
    }
  };

  const base = '/dashboard/laboratorio-inteligente';
  const pidSeg = patientId ? '/paciente/' + patientId : '';

  return (
    <div className="w-full space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <BeakerIcon className="h-8 w-8 text-blue-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Laboratorio Inteligente</h1>
        </div>
        <p className="text-gray-600 mb-4">Carga, revisa y visualiza estudios de laboratorio de forma estructurada.</p>
        <LabDisclaimer className="mb-4" />

        {user?.role !== 'PATIENT' && (
          <div className="mb-6 max-w-xl">
            <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
            <input
              type="search"
              className="w-full rounded-md border-gray-300 shadow-sm"
              placeholder="Buscar paciente por nombre..."
              value={search || patientLabel}
              onChange={(e) => {
                setSearch(e.target.value);
                setPatientLabel('');
              }}
            />
            {searchResults.length > 0 && (
              <ul className="mt-1 border border-gray-200 rounded-md bg-white shadow-lg max-h-48 overflow-auto z-10 relative">
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm" onClick={() => selectPatient(p)}>
                      {p.firstName} {p.lastName} — {p.email}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {patientId && !search ? (
              <p className="text-xs text-gray-500 mt-1">ID paciente: {patientId}</p>
            ) : null}
          </div>
        )}

        {patientId ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Link to={base + '/subir?patientId=' + patientId} className="flex items-center gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100">
              <ArrowUpTrayIcon className="h-6 w-6 text-blue-700" />
              <span className="font-medium text-blue-900">Subir estudio</span>
            </Link>
            <Link to={base + pidSeg + '/dashboard'} className="flex items-center gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100">
              <ChartBarIcon className="h-6 w-6 text-emerald-700" />
              <span className="font-medium text-emerald-900">Panel del paciente</span>
            </Link>
            <Link to={base + pidSeg + '/comparar'} className="flex items-center gap-3 p-4 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100">
              <ArrowsRightLeftIcon className="h-6 w-6 text-violet-700" />
              <span className="font-medium text-violet-900">Comparar estudios</span>
            </Link>
          </div>
        ) : (
          <p className="text-sm text-amber-700 mb-6">Selecciona un paciente para continuar.</p>
        )}

        <h2 className="text-lg font-semibold text-gray-900 mb-3">Reportes recientes</h2>
        {loading ? <Loader /> : null}
        {!loading && !reports.length ? (
          <p className="text-sm text-gray-500">No hay reportes para este paciente.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
            {reports.map((r) => {
              const listTitle = formatLabReportListTitle(r);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 bg-white min-w-0">
                  <div className="min-w-0 flex-1">
                    <p className={labReportListTitleClassName(listTitle)} title={listTitle}>
                      {listTitle}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <LabProcessingStatus status={r.extractionStatus} confidence={r.extractionConfidence} note={labReportStatusNote(r)} />
                    <div className="flex items-center gap-2">
                      {r.extractionStatus === 'pending_review' ? (
                        <Link to={base + '/reportes/' + r.id + '/revision'} className="text-sm text-amber-700 hover:underline whitespace-nowrap">
                          Revisar
                        </Link>
                      ) : null}
                      <Link to={base + '/reportes/' + r.id} className="text-sm text-blue-700 hover:underline whitespace-nowrap">
                        Ver detalle
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                        aria-label="Eliminar estudio"
                        title="Eliminar estudio"
                      >
                        <TrashIcon className="h-5 w-5" aria-hidden />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-study-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 id="delete-study-title" className="text-lg font-semibold text-gray-900 mb-2">Eliminar estudio</h3>
            <p className="text-sm text-gray-600 mb-6">¿Eliminar este estudio? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button type="button" className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </button>
              <button type="button" className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50" onClick={handleDeleteStudy} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default LaboratorioInteligente;

