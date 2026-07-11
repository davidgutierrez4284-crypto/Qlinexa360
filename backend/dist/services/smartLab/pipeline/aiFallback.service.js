"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryAiFallbackExtraction = tryAiFallbackExtraction;
const axios_1 = __importDefault(require("axios"));
const labUnitConversion_utils_1 = require("../../../utils/labUnitConversion.utils");
const smartLab_config_1 = require("../../../config/smartLab.config");
const labParser_interface_1 = require("./labParser.interface");
function parseAiPayload(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const obj = raw;
    if (!Array.isArray(obj.parameters))
        return null;
    return {
        laboratory: typeof obj.laboratory === 'string' ? obj.laboratory : undefined,
        study: typeof obj.study === 'string' ? obj.study : undefined,
        parameters: obj.parameters,
    };
}
function extractJsonFromResponse(content) {
    const trimmed = content.trim();
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed;
    return JSON.parse(jsonText);
}
function rowToCandidate(row) {
    var _a, _b, _c, _d;
    const rawName = String(row.raw_name || row.canonical_name || '').trim();
    if (!rawName || rawName.length < 2)
        return null;
    const valueText = row.value != null ? String(row.value).replace(/\s+/g, '') : null;
    const value = valueText ? (0, labUnitConversion_utils_1.parseNumericValue)(valueText) : null;
    return (0, labParser_interface_1.candidateFromParsedLine)({
        rawName,
        value,
        valueText,
        unit: ((_a = row.unit) === null || _a === void 0 ? void 0 : _a.trim()) || null,
        referenceLow: (_b = row.reference_low) !== null && _b !== void 0 ? _b : null,
        referenceHigh: (_c = row.reference_high) !== null && _c !== void 0 ? _c : null,
        referenceText: row.reference_low != null && row.reference_high != null
            ? `${row.reference_low}-${row.reference_high}`
            : null,
        sourceLines: [`AI: ${rawName} ${valueText !== null && valueText !== void 0 ? valueText : ''} ${(_d = row.unit) !== null && _d !== void 0 ? _d : ''}`.trim()],
        confidence: typeof row.confidence === 'number' ? Math.min(0.92, row.confidence) : 0.72,
    });
}
async function tryAiFallbackExtraction(text, classification) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!(0, smartLab_config_1.isSmartLabAiFallbackEnabled)())
        return [];
    const apiKey = process.env.OPENAI_API_KEY || process.env.SMART_LAB_OPENAI_API_KEY;
    if (!apiKey)
        return [];
    const model = (0, smartLab_config_1.getSmartLabOpenAiModel)();
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

Laboratorio detectado: ${(_a = classification.laboratoryName) !== null && _a !== void 0 ? _a : 'desconocido'}
Tipo estudio: ${(_b = classification.studyType) !== null && _b !== void 0 ? _b : 'desconocido'}

Texto:
${text.slice(0, 12000)}`;
    try {
        const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
            model,
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: 'Eres un extractor estructurado de resultados de laboratorio clínico.' },
                { role: 'user', content: prompt },
            ],
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 45000,
        });
        const content = (_f = (_e = (_d = (_c = response.data) === null || _c === void 0 ? void 0 : _c.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content;
        if (!content || typeof content !== 'string')
            return [];
        const parsed = parseAiPayload(extractJsonFromResponse(content));
        if (!((_g = parsed === null || parsed === void 0 ? void 0 : parsed.parameters) === null || _g === void 0 ? void 0 : _g.length))
            return [];
        return parsed.parameters
            .map(rowToCandidate)
            .filter((r) => r != null);
    }
    catch (_h) {
        return [];
    }
}
