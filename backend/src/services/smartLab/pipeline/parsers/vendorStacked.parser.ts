import { parseStackedLayout } from '../stackedParser.utils';
import type { LabParser } from '../labParser.interface';
import type { ClassifiedDocument, ParameterCandidate } from '../types';

const COMMON_SKIP =
  /^(hoja:|p[aá]gina|paciente:|sexo:|fecha:|edad:|orden:|resultados$|www\.|gracias|aviso|privacidad|cup[oó]n|descuento|vigencia|producto|c[oó]digo|m[eé]todo:|informe|responsable|acreditaci[oó]n)/i;

const SECTION_START =
  /\b(QU[IÍ]MICA|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|UROAN[AÁ]LISIS|COPROLOG[IÍ]A|ORINA|TIROIDES|LIPIDOS|HEP[AÁ]TICO|RENAL)\b/i;

export const saludDignaParser: LabParser = {
  vendor: 'salud_digna',
  name: 'SaludDignaParser',

  canParse(classification: ClassifiedDocument): boolean {
    return classification.vendor === 'salud_digna';
  },

  parse(text: string): ParameterCandidate[] {
    return parseStackedLayout(text, {
      sectionStart: SECTION_START,
      skipLine: COMMON_SKIP,
    });
  },
};

export const olabParser: LabParser = {
  vendor: 'olab',
  name: 'OlabParser',

  canParse(classification: ClassifiedDocument): boolean {
    return classification.vendor === 'olab';
  },

  parse(text: string): ParameterCandidate[] {
    return parseStackedLayout(text, {
      sectionStart: SECTION_START,
      skipLine: COMMON_SKIP,
    });
  },
};

export const laboratoriosRuizParser: LabParser = {
  vendor: 'laboratorios_ruiz',
  name: 'LaboratoriosRuizParser',

  canParse(classification: ClassifiedDocument): boolean {
    return classification.vendor === 'laboratorios_ruiz';
  },

  parse(text: string): ParameterCandidate[] {
    return parseStackedLayout(text, {
      sectionStart: SECTION_START,
      skipLine: COMMON_SKIP,
    });
  },
};

export const carpermorParser: LabParser = {
  vendor: 'carpermor',
  name: 'CarpermorParser',

  canParse(classification: ClassifiedDocument): boolean {
    return classification.vendor === 'carpermor';
  },

  parse(text: string): ParameterCandidate[] {
    return parseStackedLayout(text, {
      sectionStart: SECTION_START,
      skipLine: COMMON_SKIP,
    });
  },
};

export function getVendorStackedParser(vendor: ClassifiedDocument['vendor']): LabParser | null {
  const parsers = [saludDignaParser, olabParser, laboratoriosRuizParser, carpermorParser];
  return parsers.find((p) => p.vendor === vendor) ?? null;
}
