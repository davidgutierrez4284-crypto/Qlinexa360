import { parseStudyMetadataFromText } from '../labMetadata.service';
import type { ClassifiedDocument, DocumentLayout, LabVendor, TextQuality } from './types';

type VendorSignal = {
  vendor: LabVendor;
  patterns: RegExp[];
  laboratoryName: string;
  weight: number;
};

const VENDOR_SIGNALS: VendorSignal[] = [
  {
    vendor: 'chopo',
    laboratoryName: 'CHOPO',
    weight: 1,
    patterns: [/chopo\.com\.mx/i, /grupo\s+diagn[oó]stico\s+m[eé]dico\s+proa/i, /\bchopo\b/i],
  },
  {
    vendor: 'salud_digna',
    laboratoryName: 'Salud Digna',
    weight: 1,
    patterns: [
      /salud\s*digna/i,
      /salud-digna\.(?:com|org)/i,
      /saluddigna\.com/i,
      /centro\s+anal[ií]tico\s+de\s+coyoac[aá]n/i,
      /\bRSV\d{8,}\b/,
      /reimpresi[oó]n\s+de\s+resultados/i,
      /sysmex\s+xn-9000/i,
    ],
  },
  {
    vendor: 'lapi',
    laboratoryName: 'LAPI',
    weight: 1,
    patterns: [/\blapi\b/i, /laboratorio\s+de\s+an[aá]lisis\s+patol[oó]gicos\s+e\s+inmunol[oó]gicos/i, /lapi\.com/i],
  },
  {
    vendor: 'olab',
    laboratoryName: 'OLAB',
    weight: 1,
    patterns: [/\bolab\b/i, /olab\.com/i, /laboratorio\s+olab/i],
  },
  {
    vendor: 'laboratorios_ruiz',
    laboratoryName: 'Laboratorios Ruiz',
    weight: 1,
    patterns: [/laboratorios?\s+ruiz/i, /labruiz\.com/i, /laboratoriosruiz/i],
  },
  {
    vendor: 'carpermor',
    laboratoryName: 'Carpermor',
    weight: 1,
    patterns: [/carpermor/i, /carpermor\.com/i],
  },
  {
    vendor: 'biomedica',
    laboratoryName: 'Biomédica Análisis Clínicos e Imagenología',
    weight: 1,
    patterns: [
      /\bbiom[eé]dica\b/i,
      /biom[eé]dica\s+an[aá]lisis\s+cl[ií]nicos/i,
      /biom[eé]dica\s+de\s+referencia/i,
      /bioderef\.com/i,
    ],
  },
  {
    vendor: 'laboratorio_polanco',
    laboratoryName: 'Laboratorio Médico Polanco',
    weight: 1,
    patterns: [
      /laboratorio\s+m[eé]dico\s+polanco/i,
      /plaza\s+miramontes\s*\(lmp\)/i,
      /factura\s*:\s*pl-?\d{4,}/i,
      /acreditaci[oó]n\s+no\s*\.?\s*cl-088/i,
    ],
  },
];

const STACKED_MARKERS =
  /\b(CURVA\s+DE\s+TOLERANCIA|CURVA\s+DE\s+INSULINA|QU[IÍ]MICA DE \d+ ELEMENTOS|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|INSULINA EN SUERO)\b/i;

function detectTextQuality(text: string): TextQuality {
  const trimmed = text.trim();
  if (trimmed.length < 80) return 'scanned';
  const alphaRatio = (trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g)?.length ?? 0) / trimmed.length;
  if (alphaRatio < 0.15) return 'scanned';
  if (trimmed.length < 200 || alphaRatio < 0.25) return 'poor';
  return 'good';
}

function detectLayout(text: string): DocumentLayout {
  if (STACKED_MARKERS.test(text)) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let stackedBlocks = 0;
    for (let i = 0; i < lines.length - 2; i++) {
      if (/^[a-zA-ZáéíóúÁÉÍÓÚ].{2,60}$/.test(lines[i]) && /^[<>]?\s*[\d.,]+$/.test(lines[i + 1])) {
        stackedBlocks++;
      }
    }
    if (stackedBlocks >= 3) return 'stacked';
    return 'mixed';
  }
  if (/\s{2,}[\d.,]+\s{2,}/.test(text)) return 'tabular';
  return 'mixed';
}

export function classifyLabDocument(text: string): ClassifiedDocument {
  const meta = parseStudyMetadataFromText(text);
  let bestVendor: LabVendor = 'unknown';
  let bestScore = 0;
  let laboratoryName = meta.laboratoryName ?? null;

  for (const signal of VENDOR_SIGNALS) {
    const hits = signal.patterns.filter((p) => p.test(text)).length;
    const score = hits * signal.weight;
    if (score > bestScore) {
      bestScore = score;
      bestVendor = signal.vendor;
      laboratoryName = signal.laboratoryName;
    }
  }

  const textQuality = detectTextQuality(text);
  const layout = detectLayout(text);
  const confidence = bestScore > 0 ? Math.min(0.98, 0.6 + bestScore * 0.15) : 0.35;

  return {
    vendor: bestVendor,
    studyType: meta.studyType ?? null,
    layout,
    textQuality,
    confidence,
    laboratoryName,
  };
}
