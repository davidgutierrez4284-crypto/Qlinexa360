import React, { useMemo } from 'react';
import { formatAgeFieldValue } from '../../utils/ageUtils';

const FILE_CATEGORY_LABELS = {
  CONSENT_DOCUMENT: 'Consentimientos firmados (PDF)',
  STUDY_RESULT: 'Estudios / resultados',
  PATIENT_PHOTO: 'Fotos del paciente',
  DOCTOR_PHOTO: 'Fotos',
  PRESCRIPTION_REQUEST: 'Recetas / solicitudes'
};

const RESERVED_KEYS = new Set([
  'patient',
  'health',
  'additional',
  'attachments',
  'scheduling',
  'files',
  'notes',
  'clinical'
]);

const formatFieldValue = (field, raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const label = field?.label || '';
  if (label.toLowerCase().includes('edad')) {
    return formatAgeFieldValue(raw);
  }
  if (field?.fieldType === 'CHECKBOX') {
    if (field.options?.includes('%')) return `${raw}%`;
    if (field.options?.includes('cm')) return `${raw} cm`;
    return raw ? 'Sí' : 'No';
  }
  return String(raw);
};

const ClinicalIntakeFormView = ({ formData = {}, formTemplates = [] }) => {
  const fd = formData || {};

  const specialtyValues = useMemo(() => {
    const nested = fd.health?.datosMedicosGenerales || {};
    const top = {};
    Object.entries(fd).forEach(([k, v]) => {
      if (!RESERVED_KEYS.has(k) && v !== undefined && v !== null && v !== '') top[k] = v;
    });
    return { ...top, ...nested };
  }, [fd]);

  const templatesWithData = useMemo(() => {
    if (!Array.isArray(formTemplates) || formTemplates.length === 0) return [];
    return formTemplates
      .map((tpl) => {
        const fields = (tpl.fields || [])
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((f) => {
            const raw = specialtyValues[f.id];
            const display = formatFieldValue(f, raw);
            return display != null ? { ...f, display } : null;
          })
          .filter(Boolean);
        return fields.length ? { ...tpl, fields } : null;
      })
      .filter(Boolean);
  }, [formTemplates, specialtyValues]);

  const Row = ({ label, value }) => {
    if (!value) return null;
    return (
      <div className="py-2 border-b border-gray-100 last:border-0">
        <div className="text-xs font-medium text-gray-500">{label}</div>
        <div className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{value}</div>
      </div>
    );
  };

  const patient = fd.patient || {};
  const additional = fd.additional || {};
  const health = fd.health || {};
  const attachments = fd.attachments || {};
  const fileGroups = attachments.files || {};

  return (
    <div className="space-y-5 text-sm">
      <section className="border rounded-lg p-4 bg-gray-50/50">
        <h3 className="font-semibold text-gray-900 mb-2">Datos del paciente</h3>
        <Row label="Nombre" value={[patient.firstName, patient.lastName].filter(Boolean).join(' ')} />
        <Row label="Correo" value={patient.email} />
        <Row label="Teléfono" value={patient.phone} />
        <Row label="Fecha de nacimiento" value={patient.birthDate} />
        <Row label="Género" value={additional.gender} />
        <Row label="Tipo de sangre" value={additional.bloodType} />
      </section>

      <section className="border rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Motivo y síntomas</h3>
        <Row label="Motivo de consulta" value={health.motivoConsulta} />
        <Row label="Notas del paciente" value={health.notasPaciente} />
      </section>

      {templatesWithData.map((tpl) => (
        <section key={tpl.id} className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">{tpl.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            {tpl.fields.map((f) => (
              <Row key={f.id} label={f.label} value={f.display} />
            ))}
          </div>
        </section>
      ))}

      {(additional.allergies || additional.chronicDiseases) && (
        <section className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Antecedentes</h3>
          <Row label="Alergias" value={additional.allergies} />
          <Row label="Enfermedades crónicas" value={additional.chronicDiseases} />
        </section>
      )}

      {(attachments.links?.length > 0 || Object.keys(fileGroups).some((k) => fileGroups[k]?.length)) && (
        <section className="border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Archivos y enlaces</h3>
          {Object.entries(fileGroups).map(([cat, arr]) =>
            Array.isArray(arr) && arr.length > 0 ? (
              <div key={cat} className="mb-3">
                <div className="text-xs font-medium text-gray-500 mb-1">
                  {FILE_CATEGORY_LABELS[cat] || cat}
                </div>
                <ul className="list-disc list-inside text-sm text-gray-800">
                  {arr.map((f, i) => (
                    <li key={i}>
                      {f.fileName || f.url || 'Archivo'}
                      {f.url ? (
                        <>
                          {' '}
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Ver
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}
          {attachments.links?.length > 0 && (
            <ul className="list-disc list-inside text-sm text-blue-700">
              {attachments.links.map((l, i) => (
                <li key={i}>
                  <a href={l.url || l} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {l.title || l.url || l}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default ClinicalIntakeFormView;
