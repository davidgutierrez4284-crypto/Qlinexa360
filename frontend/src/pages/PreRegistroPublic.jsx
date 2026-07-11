import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import PhoneInput from '../components/common/PhoneInput';
import LinkManager from '../components/medical/LinkManager';
import Loader from '../components/common/Loader';
import Tooltip from '../components/common/Tooltip';
import { InformationCircleIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { parseAgeFieldValue, ageToMonths } from '../utils/ageUtils';
import {
  applySpecialtyFormComputations,
  getSpecialtyComputedFieldProps
} from '../utils/medicalCalculations';

const AGE_FIELD_TOOLTIP =
  'Esta edad representa un corte en el tiempo: el momento en que se realizó el análisis o la consulta.';

const LegalDocLink = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-blue-700 underline hover:text-blue-900 font-medium"
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
  >
    {children}
  </a>
);

const normalizeFormTemplates = (templates) => {
  if (!Array.isArray(templates)) return [];
  return templates.map((t) => ({
    ...t,
    fields: Array.isArray(t.fields) ? t.fields : []
  }));
};

const pickDefaultTemplateId = (templates, currentId) => {
  const list = normalizeFormTemplates(templates);
  if (list.length === 0) return '';
  if (currentId && list.some((t) => t.id === currentId)) return currentId;
  const preferred = list.find((t) => t.name === 'Datos médicos generales') || list[0];
  return preferred?.id || '';
};

/**
 * Formulario público de pre-registro clínico (multi-paso — base).
 * Equivalente a registro de paciente + datos clínicos + archivos + consentimiento PDF.
 */
const PreRegistroPublic = () => {
  const { token: tokenParam, portalToken, doctorSlug: doctorSlugParam, segment } = useParams();
  const doctorSlug = doctorSlugParam || segment;
  const [loading, setLoading] = useState(true);
  const [busyText, setBusyText] = useState('');
  const [meta, setMeta] = useState(null);
  const [effectiveToken, setEffectiveToken] = useState(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    patient: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      birthDate: ''
    },
    additional: {
      gender: '',
      bloodType: '',
      allergies: '',
      chronicDiseases: '',
      emergencyContactFirstName: '',
      emergencyContactLastName: '',
      emergencyContactEmail: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: ''
    },
    health: {
      motivoConsulta: '',
      notasPaciente: '',
      datosMedicosGenerales: {}
    },
    attachments: {
      files: {},
      links: []
    },
    scheduling: {
      preferredDate: '',
      preferredTime: '',
      notes: ''
    }
  });
  const [consultationReason, setConsultationReason] = useState('GENERAL_MEDICINE');
  const templatesAutoRetryRef = useRef(false);

  const [consents, setConsents] = useState({
    privacy: false,
    treatment: false,
    platform: false,
    signerName: ''
  });
  const [showMedicalFields, setShowMedicalFields] = useState(false);
  const [appointmentBooked, setAppointmentBooked] = useState(false);

  const agendaLink = meta?.agenda?.enabled && meta?.agenda?.link ? meta.agenda.link : null;
  const agendaMessage = meta?.agenda?.enabled && meta?.agenda?.message ? meta.agenda.message : null;
  const intakeTokenForAgenda = tokenParam || effectiveToken;

  /** Enlace de agenda con token de pre-consulta para prellenar datos en AgendarCita */
  const agendaLinkForBooking = useMemo(() => {
    if (!agendaLink || !intakeTokenForAgenda) return agendaLink;
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : '';
      const url = agendaLink.startsWith('http') ? new URL(agendaLink) : new URL(agendaLink, base);
      url.searchParams.set('clinicalIntake', intakeTokenForAgenda);
      return url.toString();
    } catch {
      const sep = agendaLink.includes('?') ? '&' : '?';
      return `${agendaLink}${sep}clinicalIntake=${encodeURIComponent(intakeTokenForAgenda)}`;
    }
  }, [agendaLink, intakeTokenForAgenda]);

  const steps = useMemo(() => {
    const base = [
      { title: 'Tus datos', subtitle: 'Primero, necesitamos tu información básica.' },
      { title: 'Datos de salud', subtitle: 'Cuéntanos el motivo y tu información médica.' },
      { title: 'Archivos y enlaces', subtitle: 'Agrega estudios, fotos o enlaces (opcional).' }
    ];
    if (agendaLink) {
      return [...base, { title: 'Agenda tu cita', subtitle: 'Agenda desde la disponibilidad del profesional y envía tu pre-consulta.' }];
    }
    return [...base, { title: 'Enviar', subtitle: 'Acepta los consentimientos y envía tu pre-consulta.' }];
  }, [agendaLink]);

  const resolveIntakeToken = useCallback(async () => {
    let tokenToUse = tokenParam || effectiveToken;
    if (!tokenToUse && portalToken) {
      const started = await axios.post(`/api/clinical-intakes/public/portal/${portalToken}/start`);
      if (started.data?.success && started.data?.data?.token) {
        tokenToUse = started.data.data.token;
        setEffectiveToken(tokenToUse);
      }
    }
    if (!tokenToUse && doctorSlug) {
      const started = await axios.post(`/api/clinical-intakes/public/doctor/${doctorSlug}/start`);
      if (started.data?.success && started.data?.data?.token) {
        tokenToUse = started.data.data.token;
        setEffectiveToken(tokenToUse);
      }
    }
    return tokenToUse;
  }, [tokenParam, effectiveToken, portalToken, doctorSlug]);

  const applyIntakePayload = useCallback((payload, options = {}) => {
    const { mergeFormData = true } = options;
    const templates = normalizeFormTemplates(payload?.formTemplates);
    setMeta((prev) => ({
      ...(prev || {}),
      ...payload,
      formTemplates: templates
    }));
    setSelectedTemplateId((current) => pickDefaultTemplateId(templates, current));
    if (mergeFormData && payload?.formData) {
      setFormData((prev) => ({ ...prev, ...(payload.formData || {}) }));
    }
    if (payload?.consultationReason) {
      setConsultationReason(payload.consultationReason);
    }
    return templates;
  }, []);

  const fetchIntakeMeta = useCallback(
    async (options = {}) => {
      const { mergeFormData = true, showErrorToast = true } = options;
      const tokenToUse = await resolveIntakeToken();
      if (!tokenToUse) {
        if (showErrorToast) toast.error('Enlace no válido');
        return null;
      }
      const res = await axios.get(`/api/clinical-intakes/public/${tokenToUse}`);
      if (!res.data?.success) {
        if (showErrorToast) toast.error(res.data?.message || 'Enlace no válido');
        return null;
      }
      const templates = applyIntakePayload(res.data.data, { mergeFormData });
      return { tokenToUse, templates };
    },
    [resolveIntakeToken, applyIntakePayload]
  );

  useEffect(() => {
    setSelectedTemplateId('');
    templatesAutoRetryRef.current = false;
  }, [tokenParam, portalToken, doctorSlug]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await fetchIntakeMeta({ mergeFormData: true, showErrorToast: true });
      } catch (e) {
        const noServer =
          !e.response && (e.code === 'ERR_NETWORK' || e.message === 'Network Error');
        toast.error(
          noServer
            ? 'No se pudo conectar con el servidor. Verifica que el backend esté en marcha y recarga la página.'
            : e.response?.data?.message || 'Enlace no válido'
        );
      } finally {
        setLoading(false);
      }
    };
    if (tokenParam || portalToken || doctorSlug) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar enlace
  }, [tokenParam, portalToken, doctorSlug]);

  const formTemplates = normalizeFormTemplates(meta?.formTemplates);

  // Si el backend no estaba disponible al cargar, reintentar una vez al entrar al paso de salud
  useEffect(() => {
    if (step !== 1 || loading) return;
    if (formTemplates.length > 0) {
      templatesAutoRetryRef.current = false;
      return;
    }
    if (templatesAutoRetryRef.current) return;
    templatesAutoRetryRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        setBusyText('Cargando formularios...');
        const result = await fetchIntakeMeta({ mergeFormData: false, showErrorToast: false });
        if (!cancelled && result?.templates?.length) {
          toast.info('Formularios de especialidad cargados.');
        }
      } catch {
        /* silencioso; el usuario puede pulsar Reintentar */
      } finally {
        if (!cancelled) setBusyText('');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, loading, formTemplates.length]);
  const selectedTemplate = useMemo(() => {
    if (!Array.isArray(formTemplates) || formTemplates.length === 0) return null;
    return formTemplates.find((t) => t.id === selectedTemplateId) || formTemplates[0];
  }, [formTemplates, selectedTemplateId]);

  const templateFields = selectedTemplate?.fields || [];
  const specialtyValues = useMemo(() => {
    const nested = formData.health?.datosMedicosGenerales || {};
    const fromTop = {};
    if (Array.isArray(templateFields)) {
      templateFields.forEach((f) => {
        if (formData[f.id] !== undefined && formData[f.id] !== '') {
          fromTop[f.id] = formData[f.id];
        }
      });
    }
    return { ...fromTop, ...nested };
  }, [formData, templateFields]);

  const syncSpecialtyFormData = (prev, datosMedicos) => {
    const patch = {};
    templateFields.forEach((f) => {
      if (datosMedicos[f.id] !== undefined) patch[f.id] = datosMedicos[f.id];
    });
    return {
      ...prev,
      ...patch,
      health: {
        ...(prev.health || {}),
        datosMedicosGenerales: datosMedicos
      }
    };
  };

  const setSpecialtyValue = (fieldId, value) => {
    setFormData((prev) => {
      const current = {
        ...(prev.health?.datosMedicosGenerales || {}),
        [fieldId]: value
      };
      const computed = applySpecialtyFormComputations(current, templateFields);
      return syncSpecialtyFormData(prev, computed);
    });
  };

  // Recalcular IMC/PAM al cargar borrador o cambiar plantilla
  useEffect(() => {
    if (!templateFields.length || loading) return;
    setFormData((prev) => {
      const nested = prev.health?.datosMedicosGenerales || {};
      const fromTop = {};
      templateFields.forEach((f) => {
        if (prev[f.id] !== undefined && prev[f.id] !== '') fromTop[f.id] = prev[f.id];
      });
      const current = { ...fromTop, ...nested };
      if (!Object.keys(current).length) return prev;
      const computed = applySpecialtyFormComputations({ ...current }, templateFields);
      const same = JSON.stringify(computed) === JSON.stringify(nested);
      if (same) return prev;
      return syncSpecialtyFormData(prev, computed);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, loading]);

  const renderTemplateField = (field) => {
    const computed = getSpecialtyComputedFieldProps(specialtyValues, templateFields, field);
    const value = specialtyValues?.[field.id];
    const displayValue = computed.value !== undefined ? computed.value : value;
    const readOnly = computed.readOnly;
    const label = field.label || 'Campo';
    const fieldType = field.fieldType;
    const isAgeField = label && label.toLowerCase().includes('edad');
    const readOnlyClass = readOnly ? 'bg-gray-100 cursor-not-allowed' : '';

    const common = `mt-1 w-full border rounded px-3 py-2 text-sm ${readOnlyClass}`;

    // Igual que SmartForm / consulta: años + meses (valor guardado en meses totales)
    if (isAgeField && (fieldType === 'NUMBER' || fieldType === 'TEXT')) {
      const { years, months } = parseAgeFieldValue(value);
      const inputId = `pre-registro-age-${field.id}`;
      const handleYearsChange = (e) => {
        const y = e.target.value;
        const m = months === '' ? 0 : months;
        setSpecialtyValue(field.id, y === '' ? '' : ageToMonths(y, m));
      };
      const handleMonthsChange = (e) => {
        const m = e.target.value;
        const y = years === '' ? 0 : years;
        setSpecialtyValue(
          field.id,
          m === '' ? (years === '' ? '' : ageToMonths(years, 0)) : ageToMonths(y, m)
        );
      };
      return (
        <div key={field.id}>
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 flex items-center gap-1">
            {label}
            <Tooltip text={AGE_FIELD_TOOLTIP} placement="top">
              <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help shrink-0" />
            </Tooltip>
          </label>
          <div className="flex gap-2 mt-1">
            <div className="flex-1">
              <input
                type="number"
                id={inputId}
                className={common}
                value={years === '' ? '' : years}
                onChange={handleYearsChange}
                placeholder="Años"
                min={0}
                max={120}
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                id={`${inputId}-meses`}
                className={common}
                value={months === '' ? '' : months}
                onChange={handleMonthsChange}
                placeholder="Meses"
                min={0}
                max={11}
              />
            </div>
          </div>
        </div>
      );
    }

    if (fieldType === 'TEXTAREA') {
      return (
        <div key={field.id}>
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <textarea
            className={`${common} min-h-[90px]`}
            placeholder={field.placeholder || ''}
            value={value || ''}
            onChange={(e) => setSpecialtyValue(field.id, e.target.value)}
          />
        </div>
      );
    }

    if (fieldType === 'SELECT') {
      return (
        <div key={field.id}>
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <select
            className={common}
            value={value || ''}
            onChange={(e) => setSpecialtyValue(field.id, e.target.value)}
          >
            <option value="">{field.placeholder || 'Selecciona…'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (fieldType === 'CHECKBOX') {
      if (field.options && field.options.includes('%')) {
        const numVal = value !== undefined && value !== '' && !isNaN(Number(value)) ? String(value) : '';
        const isChecked = value !== undefined && value !== '';
        return (
          <div key={field.id} className="flex items-center gap-2 flex-wrap text-sm">
            <input
              type="checkbox"
              checked={!!isChecked}
              onChange={(e) => setSpecialtyValue(field.id, e.target.checked ? numVal || '0' : '')}
            />
            <span className="font-medium text-gray-700">{label}</span>
            {isChecked && (
              <>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={numVal}
                  onChange={(e) => setSpecialtyValue(field.id, e.target.value === '' ? '0' : e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-gray-500">%</span>
              </>
            )}
          </div>
        );
      }
      if (field.options && field.options.includes('cm')) {
        const numVal = value !== undefined && value !== '' && !isNaN(Number(value)) ? String(value) : '';
        const isChecked = value !== undefined && value !== '';
        return (
          <div key={field.id} className="flex items-center gap-2 flex-wrap text-sm">
            <input
              type="checkbox"
              checked={!!isChecked}
              onChange={(e) =>
                setSpecialtyValue(field.id, e.target.checked ? (numVal !== '' ? String(numVal) : '') : '')
              }
            />
            <span className="font-medium text-gray-700">{label}</span>
            {isChecked && (
              <>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={numVal}
                  onChange={(e) => setSpecialtyValue(field.id, e.target.value)}
                  className="w-20 border rounded px-2 py-1 text-sm text-center"
                />
                <span className="text-gray-500">cm</span>
              </>
            )}
          </div>
        );
      }
      return (
        <label key={field.id} className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setSpecialtyValue(field.id, e.target.checked)}
          />
          {label}
        </label>
      );
    }

    const inputType = fieldType === 'NUMBER' ? 'number' : fieldType === 'DATE' ? 'date' : 'text';
    return (
      <div key={field.id}>
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
          type={inputType}
          className={common}
          placeholder={field.placeholder || ''}
          value={displayValue ?? ''}
          readOnly={readOnly}
          onChange={readOnly ? undefined : (e) => setSpecialtyValue(field.id, e.target.value)}
        />
        {readOnly && (
          <p className="text-xs text-gray-500 mt-1">Calculado automáticamente</p>
        )}
      </div>
    );
  };

  const saveDraft = async (options = {}) => {
    const { silent = false, busyLabel = 'Guardando...' } = options;
    try {
      setBusyText(busyLabel);
      const tokenToUse = tokenParam || effectiveToken;
      if (!tokenToUse) {
        if (!silent) toast.error('Enlace no válido');
        return false;
      }
      await axios.put(`/api/clinical-intakes/public/${tokenToUse}`, {
        formData,
        consultationReason
      });
      if (!silent) toast.success('Guardado');
      return true;
    } catch (e) {
      if (!silent) toast.error(e.response?.data?.message || 'No se pudo guardar');
      return false;
    } finally {
      setBusyText('');
    }
  };

  const handleOpenAgenda = async () => {
    const url = agendaLinkForBooking || agendaLink;
    if (!url) return;
    const saved = await saveDraft({
      silent: true,
      busyLabel: 'Guardando tu información y abriendo agenda...'
    });
    if (!saved) {
      toast.error('No se pudo guardar el formulario. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.info('Agenda abierta con tus datos de la pre-consulta.');
  };

  const handleSubmit = async () => {
    if (!consentsComplete) {
      toast.error('Acepta todos los consentimientos y firma con tu nombre completo');
      return;
    }
    if (!String(formData.health?.motivoConsulta || '').trim()) {
      toast.error('Captura el motivo de consulta.');
      return;
    }
    if (!String(formData.health?.notasPaciente || '').trim()) {
      toast.error('Captura las notas (síntomas).');
      return;
    }
    const tokenToUse = tokenParam || effectiveToken;
    if (!tokenToUse) {
      toast.error('Enlace no válido');
      return;
    }

    const saved = await saveDraft({
      silent: true,
      busyLabel: 'Guardando y enviando tu pre-consulta...'
    });
    if (!saved) {
      toast.error('No se pudo guardar antes de enviar. Revisa tu conexión e inténtalo de nuevo.');
      return;
    }

    try {
      setBusyText('Enviando...');
      await axios.post(`/api/clinical-intakes/public/${tokenToUse}/submit`, {
        formData,
        consultationReason,
        consentPrivacy: consents.privacy,
        consentTreatment: consents.treatment,
        consentPlatform: consents.platform,
        consentSignerName: consents.signerName
      });
      toast.success('Listo. Tu pre-consulta fue enviada.');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Error al enviar');
    } finally {
      setBusyText('');
    }
  };

  const uploadFile = async (category, file) => {
    const tokenToUse = tokenParam || effectiveToken;
    if (!tokenToUse) {
      toast.error('Enlace no válido');
      return;
    }
    const fd = new FormData();
    fd.append('category', category);
    fd.append('file', file);
    try {
      setBusyText('Subiendo archivo...');
      const res = await axios.post(`/api/clinical-intakes/public/${tokenToUse}/upload`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploaded = res.data?.file;
      if (!uploaded?.url) throw new Error('Upload failed');
      setFormData((prev) => {
        const nextFiles = { ...((prev.attachments && prev.attachments.files) || {}) };
        nextFiles[category] = [...(nextFiles[category] || []), uploaded];
        return { ...prev, attachments: { ...(prev.attachments || {}), files: nextFiles } };
      });
      toast.success('Archivo subido');
    } catch (e) {
      const noServer =
        !e.response && (e.code === 'ERR_NETWORK' || e.message === 'Network Error');
      toast.error(
        noServer
          ? 'No se pudo conectar con el servidor. Espera a que el backend esté en marcha e inténtalo de nuevo.'
          : e.response?.data?.message || 'No se pudo subir el archivo'
      );
    } finally {
      setBusyText('');
    }
  };

  const progressPct = useMemo(() => {
    const total = steps.length;
    const current = Math.min(Math.max(step + 1, 1), total);
    return Math.round((current / total) * 100);
  }, [step, steps.length]);

  const consentsComplete = useMemo(
    () =>
      consents.privacy &&
      consents.treatment &&
      consents.platform &&
      String(consents.signerName || '').trim().length > 0,
    [consents]
  );

  // Auto-abrir el acordeón de datos médicos solo si el paciente ya capturó alguno (p. ej. borrador).
  useEffect(() => {
    const hasMedicalData = Object.values(formData.health?.datosMedicosGenerales || {}).some(
      (v) => v !== '' && v !== null && v !== undefined
    );
    if (hasMedicalData) setShowMedicalFields(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Escuchar (entre pestañas) cuando el paciente agenda su cita desde la pestaña de la agenda,
  // para marcar "cita agendada" y resaltar el último paso (aceptar avisos + enviar).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('qlinexa-preconsulta-agenda');
    channel.onmessage = (event) => {
      if (event?.data?.type !== 'appointment-booked') return;
      const sameIntake =
        !event.data.clinicalIntake ||
        !intakeTokenForAgenda ||
        event.data.clinicalIntake === intakeTokenForAgenda;
      if (!sameIntake) return;
      setAppointmentBooked(true);
      setStep(steps.length - 1);
      toast.success('Cita agendada. Solo falta aceptar los avisos y enviar tu pre-consulta.');
    };
    return () => channel.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeTokenForAgenda, steps.length]);

  if (loading) return <Loader text="Cargando formulario..." />;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {!!busyText && <Loader text={busyText} />}
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="text-center mb-6 pb-5 border-b border-blue-100">
          <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 tracking-tight">Pre-consulta</h1>
          {meta?.doctorName && (
            <p className="mt-2 text-base font-medium text-blue-700">
              Profesional: <span className="text-blue-900">{meta.doctorName}</span>
            </p>
          )}
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Paso {step + 1} de {steps.length}: {steps[step]?.title}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">{steps[step]?.subtitle}</div>
            </div>
            <div className="text-xs text-gray-500">{progressPct}%</div>
          </div>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-2 bg-blue-600 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {step === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={formData.patient.firstName || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, patient: { ...f.patient, firstName: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Apellido</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={formData.patient.lastName || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, patient: { ...f.patient, lastName: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Correo (opcional)</label>
                <input
                  type="email"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  placeholder="correo@ejemplo.com"
                  value={formData.patient.email || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, patient: { ...f.patient, email: e.target.value } }))}
                />
              </div>
              <div>
                <PhoneInput
                  name="public-phone"
                  label="Teléfono (opcional)"
                  value={formData.patient.phone || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, patient: { ...f.patient, phone: e.target.value } }))}
                  placeholder="Ej: 55 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fecha de nacimiento (opcional)</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={formData.patient.birthDate || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, patient: { ...f.patient, birthDate: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Género (opcional)</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={formData.additional.gender || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, additional: { ...f.additional, gender: e.target.value } }))}
                >
                  <option value="">Selecciona…</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de sangre (opcional)</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={formData.additional.bloodType || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, additional: { ...f.additional, bloodType: e.target.value } }))}
                >
                  <option value="">Selecciona…</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium text-gray-900">Contacto de emergencia (opcional)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={formData.additional.emergencyContactFirstName || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        additional: { ...f.additional, emergencyContactFirstName: e.target.value }
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Apellido</label>
                  <input
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={formData.additional.emergencyContactLastName || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        additional: { ...f.additional, emergencyContactLastName: e.target.value }
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Correo</label>
                  <input
                    type="email"
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    value={formData.additional.emergencyContactEmail || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        additional: { ...f.additional, emergencyContactEmail: e.target.value }
                      }))
                    }
                  />
                </div>
                <div>
                  <PhoneInput
                    name="public-emergency-phone"
                    label="Teléfono"
                    value={formData.additional.emergencyContactPhone || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        additional: { ...f.additional, emergencyContactPhone: e.target.value }
                      }))
                    }
                    placeholder="Ej: 55 1234 5678"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Relación</label>
                  <input
                    className="mt-1 w-full border rounded px-3 py-2 text-sm"
                    placeholder="Ej: Madre, padre, pareja…"
                    value={formData.additional.emergencyContactRelationship || ''}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        additional: { ...f.additional, emergencyContactRelationship: e.target.value }
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-700">Motivo de consulta</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
                placeholder="Ej: Revisión de resultados"
                value={formData.health.motivoConsulta || ''}
                onChange={(e) => setFormData((f) => ({ ...f, health: { ...f.health, motivoConsulta: e.target.value } }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Notas (lo que te pasa / síntomas)</label>
              <textarea
                className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-[140px]"
                placeholder="Describe tus síntomas, antecedentes relevantes, medicamentos actuales, etc."
                value={formData.health.notasPaciente || ''}
                onChange={(e) => setFormData((f) => ({ ...f, health: { ...f.health, notasPaciente: e.target.value } }))}
              />
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <div
                className="bg-teal-50 border-b border-teal-200 px-4 py-4 sm:px-5 sm:py-5"
                role="note"
                aria-label="Orientación sobre los formularios médicos"
              >
                <div className="flex gap-3 sm:gap-4">
                  <InformationCircleIcon
                    className="w-7 h-7 sm:w-8 sm:h-8 text-teal-600 shrink-0"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <span className="inline-flex items-center rounded-full bg-teal-600 px-3 py-1 text-xs sm:text-sm font-bold uppercase tracking-wide text-white">
                      Todo esto es opcional
                    </span>
                    <p className="mt-2 text-base sm:text-lg font-semibold text-teal-900 leading-snug">
                      Llena solo lo que conozcas. No tienes que completar todo para enviar tu pre-consulta.
                    </p>
                    <p className="mt-2 text-sm sm:text-base text-teal-800 leading-relaxed">
                      Cuanto más compartas, más contexto tendrá el doctor — pero{' '}
                      <span className="font-semibold text-teal-900">sin presión</span>: comparte lo que sepas y
                      el resto se completa en tu consulta.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white">
                <button
                  type="button"
                  onClick={() => setShowMedicalFields((v) => !v)}
                  aria-expanded={showMedicalFields}
                  className="w-full flex items-center justify-between gap-3 p-4 sm:p-5 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-900">
                      Agregar datos médicos <span className="text-gray-500 font-normal">(opcional)</span>
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      Signos vitales, antecedentes y otros datos que conozcas. Puedes omitir esta sección.
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-teal-700">
                      {showMedicalFields ? 'Ocultar' : 'Mostrar'}
                    </span>
                    <ChevronDownIcon
                      className={`w-5 h-5 text-gray-400 transition-transform ${showMedicalFields ? 'rotate-180' : ''}`}
                    />
                  </span>
                </button>

                {showMedicalFields && (
                  <div className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-4">
                    {Array.isArray(formTemplates) && formTemplates.length > 0 && (
                      <div className="min-w-[240px] sm:max-w-xs w-full">
                        <label className="block text-xs font-medium text-gray-600">Formulario</label>
                        <select
                          className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                          value={selectedTemplate?.id || ''}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                        >
                          {formTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {selectedTemplate?.fields?.length ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[...selectedTemplate.fields]
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                          .map(renderTemplateField)}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        <p className="font-medium">
                          {formTemplates.length === 0
                            ? 'No se cargaron los formularios de especialidad.'
                            : 'No hay campos disponibles para este formulario.'}
                        </p>
                        {formTemplates.length === 0 && (
                          <>
                            <p className="mt-1 text-amber-800">
                              Suele ocurrir si la página se abrió sin el servidor activo. Con el backend en
                              marcha, recarga o pulsa reintentar.
                            </p>
                            <button
                              type="button"
                              className="mt-3 text-sm font-medium text-amber-900 underline hover:text-amber-950"
                              onClick={async () => {
                                try {
                                  setBusyText('Cargando formularios...');
                                  const result = await fetchIntakeMeta({ mergeFormData: false });
                                  if (result?.templates?.length) {
                                    toast.success('Formularios cargados correctamente');
                                  } else {
                                    toast.error('No se encontraron formularios. Contacta al consultorio.');
                                  }
                                } catch (e) {
                                  toast.error(e.response?.data?.message || 'No se pudieron cargar los formularios');
                                } finally {
                                  setBusyText('');
                                }
                              }}
                            >
                              Reintentar carga de formularios
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Alergias (opcional)</label>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-[90px]"
                  value={formData.additional.allergies || ''}
                  onChange={(e) => setFormData((f) => ({ ...f, additional: { ...f.additional, allergies: e.target.value } }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Enfermedades crónicas (opcional)</label>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2 text-sm min-h-[90px]"
                  value={formData.additional.chronicDiseases || ''}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, additional: { ...f.additional, chronicDiseases: e.target.value } }))
                  }
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="text-sm text-gray-700">
              Los archivos son <span className="font-medium">opcionales</span>. Si tienes estudios, radiografías o fotos, puedes agregarlos para que el profesional los revise antes de la consulta.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border rounded p-3 flex flex-col">
                <p className="text-sm font-medium text-gray-800">Estudios <span className="text-gray-500 font-normal">(opcional)</span></p>
                <p className="text-xs text-gray-500 mt-1">PDF o imagen (laboratorio, radiografías, etc.).</p>
                <label className="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded hover:bg-gray-50 cursor-pointer w-full">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile('STUDY_RESULT', f).finally(() => (e.target.value = ''));
                    }}
                  />
                  Seleccionar archivo
                </label>
                <div className="mt-2 text-xs text-gray-600">
                  {(formData.attachments.files?.STUDY_RESULT || []).length} archivo(s)
                </div>
              </div>

              <div className="border rounded p-3 flex flex-col">
                <p className="text-sm font-medium text-gray-800">Fotos <span className="text-gray-500 font-normal">(opcional)</span></p>
                <p className="text-xs text-gray-500 mt-1">Fotos de lesiones, heridas o zonas relevantes.</p>
                <label className="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm border rounded hover:bg-gray-50 cursor-pointer w-full">
                  <input
                    type="file"
                    className="hidden"
                    accept=".png,.jpg,.jpeg,.webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile('PATIENT_PHOTO', f).finally(() => (e.target.value = ''));
                    }}
                  />
                  Seleccionar foto
                </label>
                <div className="mt-2 text-xs text-gray-600">
                  {(formData.attachments.files?.PATIENT_PHOTO || []).length} archivo(s)
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="text-sm font-medium text-gray-900 mb-2">Enlaces (opcional)</div>
              <LinkManager
                links={formData.attachments.links || []}
                onChange={(next) => setFormData((f) => ({ ...f, attachments: { ...f.attachments, links: next } }))}
                readOnly={false}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            {agendaLink ? (
              <div className={`border rounded-lg p-4 ${appointmentBooked ? 'border-green-300 bg-green-50' : ''}`}>
                <div className="text-sm font-medium text-gray-900">
                  Paso 1 de 2: Agenda tu cita
                </div>
                {appointmentBooked ? (
                  <div className="mt-2 flex items-start gap-2 text-sm text-green-800">
                    <svg className="w-5 h-5 text-green-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>
                      <span className="font-semibold">¡Cita agendada!</span> Ya casi terminas: abajo acepta los
                      avisos y pulsa <span className="font-semibold">Enviar pre-consulta</span>.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 mt-1">
                    Selecciona un horario disponible en la agenda del profesional. Se abrirá en otra pestaña;
                    al terminar, <span className="font-medium">regresa aquí</span> para enviar tu pre-consulta.
                  </p>
                )}
                {agendaMessage && !appointmentBooked && (
                  <div className="mt-3 text-sm text-gray-700 bg-gray-50 border rounded p-3">
                    {agendaMessage}
                  </div>
                )}
                {!appointmentBooked && (
                  <p className="mt-3 text-xs text-gray-500">
                    Al abrir la agenda guardamos automáticamente lo que llevas del formulario para que no
                    tengas que volver a capturar tus datos.
                  </p>
                )}
                <div className="mt-4 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAgenda}
                    className="inline-flex items-center justify-center px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    {appointmentBooked ? 'Volver a abrir la agenda' : 'Abrir agenda para agendar'}
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center px-4 py-2 text-sm border rounded hover:bg-gray-50"
                    onClick={async () => {
                      const url = agendaLinkForBooking || agendaLink;
                      if (!url) return;
                      const saved = await saveDraft({ silent: true, busyLabel: 'Guardando...' });
                      if (!saved) {
                        toast.error('No se pudo guardar antes de copiar el enlace');
                        return;
                      }
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success('Enlace de agenda copiado (con tus datos guardados)');
                      } catch {
                        toast.error('No se pudo copiar el enlace');
                      }
                    }}
                  >
                    Copiar enlace
                  </button>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm font-medium text-gray-900">Agendamiento en línea</div>
                <p className="text-sm text-gray-700 mt-1">
                  En este momento el profesional no tiene habilitada la agenda compartida. Puedes enviar tu pre-consulta y el consultorio te contactará para agendar.
                </p>
              </div>
            )}

            <div className={`border rounded-lg p-4 space-y-3 text-sm ${appointmentBooked ? 'border-blue-300 ring-1 ring-blue-200' : ''}`}>
              <div className="text-sm font-medium text-gray-900">
                {agendaLink ? 'Paso 2 de 2: Acepta los avisos y envía' : 'Antes de enviar'}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Lee los documentos legales antes de marcar cada casilla. Al enviar, firmas digitalmente con tu
                nombre completo.{' '}
                <span className="font-medium text-gray-800">
                  Este es el paso que concluye tu pre-consulta.
                </span>
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={consents.privacy}
                  onChange={(e) => setConsents((c) => ({ ...c, privacy: e.target.checked }))}
                />
                <span>
                  He leído y acepto el{' '}
                  <LegalDocLink href="/aviso-privacidad">aviso de privacidad</LegalDocLink>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={consents.treatment}
                  onChange={(e) => setConsents((c) => ({ ...c, treatment: e.target.checked }))}
                />
                <span>
                  Acepto el tratamiento de mis datos de salud conforme al{' '}
                  <LegalDocLink href="/aviso-privacidad">aviso de privacidad</LegalDocLink>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={consents.platform}
                  onChange={(e) => setConsents((c) => ({ ...c, platform: e.target.checked }))}
                />
                <span>
                  He leído y acepto el{' '}
                  <LegalDocLink href="/terminos#contrato-plataforma">
                    contrato de uso de la plataforma
                  </LegalDocLink>{' '}
                  y los <LegalDocLink href="/terminos">términos de uso</LegalDocLink>
                </span>
              </label>
              <label className="block text-xs font-medium text-gray-600">Firma (nombre completo) *</label>
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                placeholder="Ej: María García López"
                value={consents.signerName}
                onChange={(e) => setConsents((c) => ({ ...c, signerName: e.target.value }))}
              />
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <button
            type="button"
            disabled={step <= 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="px-4 py-2 text-sm border rounded disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={saveDraft} className="px-4 py-2 text-sm border rounded">
              Guardar
            </button>
            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!consentsComplete}
                title={
                  consentsComplete
                    ? undefined
                    : 'Acepta los tres avisos y escribe tu nombre completo para enviar'
                }
                className="px-4 py-2 text-sm bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600"
              >
                Enviar pre-consulta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreRegistroPublic;
