import axios from 'axios';
import { parseNumericValue } from '../../../utils/labUnitConversion.utils';
import {
  isSmartLabAiFallbackEnabled,
  getSmartLabOpenAiModel,
} from '../../../config/smartLab.config';
import type { ClassifiedDocument, ParameterCandidate } from './types';
import { candidateFromParsedLine } from './labParser.interface';

type AiParameterRow = {
  canonical_name?: string;
  raw_name?: string;
  value?: number | string;
  unit?: string | null;
  reference_low?: number | null;
  reference_high?: number | null;
  confidence?: number;
};

type AiExtractionPayload = {
  laboratory?: string;
  study?: string;
  parameters?: AiParameterRow[];
};

function parseAiPayload(raw: unknown): AiExtractionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.parameters)) return null;
  return {
    laboratory: typeof obj.laboratory === 'string' ? obj.laboratory : undefined,
    study: typeof obj.study === 'string' ? obj.study : undefined,
    parameters: obj.parameters as AiParameterRow[],
  };
}

function extractJsonFromResponse(content: string): unknown {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(jsonText);
}

function rowToCandidate(row: AiParameterRow): ParameterCandidate | null {
  const rawName = String(row.raw_name || row.canonical_name || '').trim();
  if (!rawName || rawName.length < 2) return null;

  const valueText = row.value != null ? String(row.value).replace(/\s+/g, '') : null;
  const value = valueText ? parseNumericValue(valueText) : null;

  return candidateFromParsedLine({
    rawName,
    value,
    valueText,
    unit: row.unit?.trim() || null,
    referenceLow: row.reference_low ?? null,
    referenceHigh: row.reference_high ?? null,
    referenceText:
      row.reference_low != null && row.reference_high != null
        ? `${row.reference_low}-${row.reference_high}`
        : null,
    sourceLines: [`AI: ${rawName} ${valueText ?? ''} ${row.unit ?? ''}`.trim()],
    confidence: typeof row.confidence === 'number' ? Math.min(0.92, row.confidence) : 0.72,
  });
}

export async function tryAiFallbackExtraction(
  text: string,
  classification: ClassifiedDocument
): Promise<ParameterCandidate[]> {
  if (!isSmartLabAiFallbackEnabled()) return [];

  const apiKey = process.env.OPENAI_API_KEY || process.env.SMART_LAB_OPENAI_API_KEY;
  if (!apiKey) return [];

  const model = getSmartLabOpenAiModel();
  const prompt = `Extrae resultados de laboratorio clínico del siguiente texto OCR/PDF.
Devuelve SOLO JSON válido (sin markdown) con esta estructura:
{
  "laboratory": "string",
  "study": "string",
  "parameters": [
    {
      "canonical_name": "string",
      "raw_name": "string",
      "value": number,
      "unit": "string",
      "reference_low": number|null,
      "reference_high": number|null,
      "confidence": number
    }
  ]
}
Reglas: cada parámetro debe tener nombre, valor y unidad asociados correctamente. No inventes valores. Omite disclaimers y cupones.

Laboratorio detectado: ${classification.laboratoryName ?? 'desconocido'}
Tipo estudio: ${classification.studyType ?? 'desconocido'}

Texto:
${text.slice(0, 12000)}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Eres un extractor estructurado de resultados de laboratorio clínico.' },
          { role: 'user', content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return [];

    const parsed = parseAiPayload(extractJsonFromResponse(content));
    if (!parsed?.parameters?.length) return [];

    return parsed.parameters
      .map(rowToCandidate)
      .filter((r): r is ParameterCandidate => r != null);
  } catch {
    return [];
  }
}
