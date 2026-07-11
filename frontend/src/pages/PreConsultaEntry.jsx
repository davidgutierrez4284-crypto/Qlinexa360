import React from 'react';
import { useParams } from 'react-router-dom';
import PreConsultation from './PreConsultation';
import PreRegistroPublic from './PreRegistroPublic';

/** Token de pre-consulta por cita (64 hex). Slugs amigables usan otro formato. */
const LEGACY_PRECONSULTATION_TOKEN_RE = /^[a-f0-9]{64}$/i;

/**
 * /pre-consulta/:segment
 * - Token hex (64) → formulario legacy ligado a una cita (PreConsultation)
 * - Slug (ej. carlos-mendoza) → portal de pre-registro clínico (PreRegistroPublic)
 */
const PreConsultaEntry = () => {
  const { segment } = useParams();
  if (LEGACY_PRECONSULTATION_TOKEN_RE.test(segment || '')) {
    return <PreConsultation />;
  }
  return <PreRegistroPublic />;
};

export default PreConsultaEntry;
