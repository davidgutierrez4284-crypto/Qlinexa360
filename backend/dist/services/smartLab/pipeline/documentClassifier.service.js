"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyLabDocument = classifyLabDocument;
const labMetadata_service_1 = require("../labMetadata.service");
const VENDOR_SIGNALS = [
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
        patterns: [/salud\s*digna/i, /salud-digna\.com/i, /saluddigna\.com/i],
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
];
const STACKED_MARKERS = /\b(CURVA\s+DE\s+TOLERANCIA|CURVA\s+DE\s+INSULINA|QU[IÍ]MICA DE \d+ ELEMENTOS|BIOMETR[IÍ]A|HEMOGRAMA|PERFIL\s+[A-ZÁÉÍÓÚ]+|INSULINA EN SUERO)\b/i;
function detectTextQuality(text) {
    var _a, _b;
    const trimmed = text.trim();
    if (trimmed.length < 80)
        return 'scanned';
    const alphaRatio = ((_b = (_a = trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) / trimmed.length;
    if (alphaRatio < 0.15)
        return 'scanned';
    if (trimmed.length < 200 || alphaRatio < 0.25)
        return 'poor';
    return 'good';
}
function detectLayout(text) {
    if (STACKED_MARKERS.test(text)) {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        let stackedBlocks = 0;
        for (let i = 0; i < lines.length - 2; i++) {
            if (/^[a-zA-ZáéíóúÁÉÍÓÚ].{2,60}$/.test(lines[i]) && /^[<>]?\s*[\d.,]+$/.test(lines[i + 1])) {
                stackedBlocks++;
            }
        }
        if (stackedBlocks >= 3)
            return 'stacked';
        return 'mixed';
    }
    if (/\s{2,}[\d.,]+\s{2,}/.test(text))
        return 'tabular';
    return 'mixed';
}
function classifyLabDocument(text) {
    var _a, _b;
    const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
    let bestVendor = 'unknown';
    let bestScore = 0;
    let laboratoryName = (_a = meta.laboratoryName) !== null && _a !== void 0 ? _a : null;
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
        studyType: (_b = meta.studyType) !== null && _b !== void 0 ? _b : null,
        layout,
        textQuality,
        confidence,
        laboratoryName,
    };
}
