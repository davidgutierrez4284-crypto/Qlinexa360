import React, { useState, useEffect, useRef } from 'react';
import { getFormTemplates } from '../../services/doctorService';
import { getDoctorFormTemplates } from '../../services/doctorFormTemplateService';
import { toast } from 'react-toastify';
import {
  applySpecialtyFormComputations,
  getSpecialtyComputedFieldProps
} from '../../utils/medicalCalculations';
import { parseAgeFieldValue, ageToMonths, formatAgeFieldValue } from '../../utils/ageUtils';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import Tooltip from '../common/Tooltip';

const AGE_TOOLTIP = 'Esta edad representa un corte en el tiempo: el momento en que se realizó el análisis o la consulta.';

// Componente para renderizar un campo individual del formulario
const FormField = ({ field, value, onChange, readOnly = false }) => {
  const { label, fieldType, placeholder, options, isRequired } = field;
  const inputId = `smart-form-${field.id}`;
  const isAgeField = label && label.toLowerCase().includes('edad');

  const handleChange = (e) => {
    const { type, value, checked } = e.target;
    onChange(field.id, type === 'checkbox' ? checked : value);
  };

  // Campo edad: años y meses con tooltip
  if (isAgeField && (fieldType === 'NUMBER' || fieldType === 'TEXT')) {
    const { years, months } = parseAgeFieldValue(value);
    const handleYearsChange = (e) => {
      const y = e.target.value;
      const m = (months === '' ? 0 : months);
      onChange(field.id, y === '' ? '' : ageToMonths(y, m));
    };
    const handleMonthsChange = (e) => {
      const m = e.target.value;
      const y = (years === '' ? 0 : years);
      onChange(field.id, m === '' ? (years === '' ? '' : ageToMonths(years, 0)) : ageToMonths(y, m));
    };
    return (
      <div>
        <label htmlFor={inputId} className="form-label flex items-center gap-1">
          {label}{isRequired && ' *'}
          <Tooltip text={AGE_TOOLTIP} placement="top">
            <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
          </Tooltip>
        </label>
        <div className="flex gap-2 mt-1">
          <div className="flex-1">
            <input
              type="number"
              id={inputId}
              value={years === '' ? '' : years}
              onChange={handleYearsChange}
              placeholder="Años"
              min={0}
              max={120}
              readOnly={readOnly}
              className={`form-input w-full ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
          </div>
          <div className="flex-1">
            <input
              type="number"
              id={`${inputId}-meses`}
              value={months === '' ? '' : months}
              onChange={handleMonthsChange}
              placeholder="Meses"
              min={0}
              max={11}
              readOnly={readOnly}
              className={`form-input w-full ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>
      </div>
    );
  }

  switch (fieldType) {
    case 'TEXT':
    case 'NUMBER':
    case 'DATE':
      return (
        <div>
          <label htmlFor={inputId} className="form-label">{label}{isRequired && ' *'}</label>
          <input
            type={fieldType.toLowerCase()}
            id={inputId}
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder || ''}
            required={isRequired && !readOnly}
            readOnly={readOnly}
            className={`form-input mt-1 w-full ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
          />
          {readOnly && (
            <p className="text-xs text-gray-500 mt-1">Calculado automáticamente</p>
          )}
        </div>
      );
    case 'TEXTAREA':
      return (
        <div className="min-h-[120px] flex flex-col" style={{ contain: 'layout', overflowAnchor: 'none' }}>
          <label htmlFor={inputId} className="form-label">{label}{isRequired && ' *'}</label>
          <textarea
            id={inputId}
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder || ''}
            required={isRequired}
            className="form-textarea mt-1 w-full resize-none overflow-y-auto h-[100px] min-h-[100px] max-h-[100px]"
            style={{ flexShrink: 0, overflowAnchor: 'none' }}
          />
        </div>
      );
    case 'SELECT':
      return (
        <div>
          <label htmlFor={inputId} className="form-label">{label}{isRequired && ' *'}</label>
          <select
            id={inputId}
            value={value || ''}
            onChange={handleChange}
            required={isRequired}
            className="form-select mt-1 w-full"
          >
            <option value="">{placeholder || `Seleccionar ${label}`}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      );
    case 'CHECKBOX':
      // Casilla con porcentaje (ej: Necrótico [ ] ___ %)
      if (options && options.includes('%')) {
        const numVal = value !== undefined && value !== '' && !isNaN(Number(value)) ? String(value) : '';
        const isChecked = value !== undefined && value !== '';
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="checkbox"
              id={inputId}
              checked={!!isChecked}
              onChange={(e) => onChange(field.id, e.target.checked ? (numVal || '0') : '')}
              className="form-checkbox"
            />
            <label htmlFor={inputId} className="form-label">{label}</label>
            {isChecked && (
              <>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={numVal}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange(field.id, v === '' ? '0' : v);
                  }}
                  placeholder="0"
                  className="form-input w-16 text-center"
                />
                <span className="text-gray-500 text-sm">%</span>
              </>
            )}
          </div>
        );
      }
      // Casilla con medida en cm (ej: Maceración [ ] ___ cm)
      if (options && options.includes('cm')) {
        const numVal = value !== undefined && value !== '' && !isNaN(Number(value)) ? String(value) : '';
        const isChecked = value !== undefined && value !== '';
        return (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="checkbox"
              id={inputId}
              checked={!!isChecked}
              onChange={(e) => onChange(field.id, e.target.checked ? (numVal !== '' ? String(numVal) : '') : '')}
              className="form-checkbox"
            />
            <label htmlFor={inputId} className="form-label">{label}</label>
            {isChecked && (
              <>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={numVal}
                  onChange={(e) => {
                    const v = e.target.value;
                    onChange(field.id, v === '' ? '' : v);
                  }}
                  placeholder="0"
                  className="form-input w-20 text-center"
                />
                <span className="text-gray-500 text-sm">cm</span>
              </>
            )}
          </div>
        );
      }
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            id={inputId}
            checked={!!value}
            onChange={handleChange}
            className="form-checkbox"
          />
          <label htmlFor={inputId} className="ml-2 form-label">{label}</label>
        </div>
      );
    default:
      return null;
  }
};


// Mapear campo de plantilla doctor a formato FormField
const mapDoctorFieldToFormField = (f) => ({
  id: f.id,
  label: f.label,
  fieldType: f.fieldType === 'numeric' ? 'NUMBER' : 'TEXT',
  placeholder: '',
  options: [],
  isRequired: false,
});

const mapDoctorTemplates = (customTemplates) =>
  (customTemplates || []).map(t => ({
    ...t,
    source: 'doctor',
    fields: (t.fields || []).map(f => ({
      ...f,
      fieldType: f.fieldType === 'numeric' ? 'NUMBER' : 'TEXT',
    })),
  }));

const pickTemplatesWithValues = (allTemplates, data) => {
  if (!data || Object.keys(data).length === 0) return [];
  return allTemplates.filter(template =>
    Object.keys(data).some(key =>
      (template.fields || []).some(field => field.id === key)
    )
  );
};

// Componente principal del formulario inteligente
const SmartForm = ({ fields = [], values = {}, onChange, onDoctorFormDataChange, readOnly = false }) => {
  const [templates, setTemplates] = useState([]);
  const [doctorTemplates, setDoctorTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [formData, setFormData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  // Solo hidratar con el values inicial: si values va en deps del fetch, cada tecla
  // re-dispara loading/spinner y provoca saltos de layout/scroll en la consulta.
  const initialValuesRef = useRef(values);
  const didHydrateFromValuesRef = useRef(false);

  // Cargar plantillas una sola vez (no re-fetch al escribir en campos)
  useEffect(() => {
    let cancelled = false;

    const fetchTemplates = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [systemTemplates, customTemplates] = await Promise.all([
          getFormTemplates(),
          getDoctorFormTemplates().catch(() => []),
        ]);
        if (cancelled) return;

        const mappedDoctor = mapDoctorTemplates(customTemplates);
        setTemplates(systemTemplates);
        setDoctorTemplates(mappedDoctor);

        const initialValues = initialValuesRef.current;
        if (initialValues && Object.keys(initialValues).length > 0) {
          const allTemplates = [...systemTemplates, ...mappedDoctor];
          const templatesWithData = pickTemplatesWithValues(allTemplates, initialValues);
          if (templatesWithData.length > 0) {
            setSelectedTemplates(templatesWithData);
            setFormData(initialValues);
            didHydrateFromValuesRef.current = true;
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error al cargar plantillas:', err);
        setError(err.message || 'Error al cargar las plantillas de formulario');
        toast.error('Error al cargar formularios especiales');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hidratar una sola vez cuando values tiene datos (async / edición).
  // No depende de teclas posteriores: didHydrate evita re-aplicar y saltos.
  useEffect(() => {
    if (didHydrateFromValuesRef.current) return;
    if (!values || Object.keys(values).length === 0) return;
    const allTemplates = [...templates, ...doctorTemplates];
    if (allTemplates.length === 0) return;
    // Si el usuario ya eligió plantillas, no pisar su trabajo
    if (selectedTemplates.length > 0) {
      didHydrateFromValuesRef.current = true;
      return;
    }

    const templatesWithData = pickTemplatesWithValues(allTemplates, values);
    if (templatesWithData.length > 0) {
      setSelectedTemplates(templatesWithData);
      setFormData(values);
      didHydrateFromValuesRef.current = true;
    }
  }, [values, templates, doctorTemplates, selectedTemplates.length]);

  const allTemplates = [...templates, ...doctorTemplates];

  const handleTemplateSelection = (templateId) => {
    if (!templateId) return;
    
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      const newData = { ...formData };
      (template.fields || []).forEach(field => {
        if (newData[field.id] === undefined) newData[field.id] = '';
      });
      setSelectedTemplates(prev => [...prev, template]);
      setFormData(newData);
      notifyChanges(newData, [...selectedTemplates, template]);
    }
  };

  const notifyChanges = (data, selected = selectedTemplates) => {
    const systemData = {};
    const doctorData = [];
    selected.forEach(t => {
      if (t.source === 'doctor') {
        const templateData = {};
        (t.fields || []).forEach(f => {
          const val = data[f.id];
          if (val !== undefined && val !== '') templateData[f.id] = val;
        });
        if (Object.keys(templateData).length > 0) {
          doctorData.push({ templateId: t.id, data: templateData });
        }
      } else {
        (t.fields || []).forEach(f => {
          systemData[f.id] = data[f.id];
        });
      }
    });
    onChange(systemData);
    if (onDoctorFormDataChange) onDoctorFormDataChange(doctorData);
  };

  const handleTemplateRemoval = (templateId) => {
    const template = allTemplates.find(t => t.id === templateId);
    if (template) {
      const nextSelected = selectedTemplates.filter(t => t.id !== templateId);
      setSelectedTemplates(nextSelected);
      setFormData(prev => {
        const newData = { ...prev };
        (template.fields || []).forEach(field => {
          delete newData[field.id];
        });
        notifyChanges(newData, nextSelected);
        return newData;
      });
    }
  };

  const handleFieldChange = (fieldId, value) => {
    let newData = { ...formData, [fieldId]: value };
    selectedTemplates.forEach((template) => {
      newData = applySpecialtyFormComputations(newData, template.fields || []);
    });
    setFormData(newData);
    notifyChanges(newData);
  };

  const getComputedFieldProps = (template, field) =>
    getSpecialtyComputedFieldProps(formData, template.fields || [], field);

  const availableTemplates = allTemplates.filter(
    t => !selectedTemplates.some(st => st.id === t.id)
  );

  if (readOnly) {
    // Visualización solo lectura
    if (selectedTemplates.length === 0) {
      return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
          <h3 className="font-semibold text-lg text-gray-800">Formularios especiales</h3>
          <div className="text-gray-500 text-sm">No hay formularios especiales registrados.</div>
        </div>
      );
    }
    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4">
        <h3 className="font-semibold text-lg text-gray-800">Formularios especiales</h3>
        <div className="space-y-6">
          {selectedTemplates.map(template => (
            <div key={template.id} className="space-y-4 p-4 border rounded-md">
              <h4 className="font-semibold text-md text-gray-700">{template.name}</h4>
              {[...template.fields].sort((a, b) => a.order - b.order).map(field => {
                const isAgeField = field.label && field.label.toLowerCase().includes('edad');
                const displayVal = formData[field.id];
                let formattedVal = isAgeField && (displayVal !== undefined && displayVal !== '')
                  ? formatAgeFieldValue(displayVal)
                  : null;
                if (formattedVal === null && displayVal !== undefined && displayVal !== '') {
                  if (field.options && field.options.includes('%')) formattedVal = `${displayVal}%`;
                  else if (field.options && field.options.includes('cm')) formattedVal = `${displayVal} cm`;
                }
                return (
                  <div key={field.id} className="flex flex-col">
                    <span className="text-xs text-gray-500 font-medium mb-1">{field.label}</span>
                    <span className="text-gray-900 text-sm bg-gray-50 rounded px-2 py-1 border min-h-[32px]">
                      {displayVal !== undefined && displayVal !== ''
                        ? (formattedVal !== null ? formattedVal : String(displayVal))
                        : <span className="text-gray-400">Sin dato</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-200 space-y-4" style={{ contain: 'layout' }}>
      <h3 className="font-semibold text-lg text-gray-800">Formulario por Especialidad</h3>
      
      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Cargando plantillas...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error al cargar formularios</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
                <p className="mt-1">Verifica tu conexión y estado de suscripción.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {!isLoading && !error && templates.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">No hay plantillas disponibles</h3>
          <p className="text-sm text-gray-500">
            No se encontraron formularios especiales. Contacta al administrador.
          </p>
        </div>
      )}
      
      {!isLoading && !error && templates.length > 0 && (
        <div>
          <select 
            onChange={(e) => handleTemplateSelection(e.target.value)} 
            className="form-select w-full mb-3"
            value=""
          >
            <option value="">Añadir formulario especial...</option>
            {availableTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          
          <div className="flex flex-wrap gap-2">
            {selectedTemplates.map(template => (
              <div key={template.id} className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2">
                <span>{template.name}</span>
                <button 
                  onClick={() => handleTemplateRemoval(template.id)}
                  className="text-blue-600 hover:text-blue-800"
                  aria-label={`Quitar ${template.name}`}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTemplates.length > 0 && (
        <div className="space-y-6 pt-4 border-t">
          {selectedTemplates.map(template => (
            <div key={template.id} className="space-y-4 p-4 border rounded-md">
               <h4 className="font-semibold text-md text-gray-700">{template.name}</h4>
              {template.fields.map(field => {
                const computed = getComputedFieldProps(template, field);
                const displayValue = computed.value !== undefined ? computed.value : formData[field.id];
                return (
                  <FormField
                    key={field.id}
                    field={field}
                    value={displayValue}
                    onChange={handleFieldChange}
                    readOnly={computed.readOnly}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartForm; 