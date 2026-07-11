"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMxDateString = parseMxDateString;
exports.parseStudyMetadataFromText = parseStudyMetadataFromText;
exports.metadataConfidenceBoost = metadataConfidenceBoost;
exports.metadataOnlyConfidence = metadataOnlyConfidence;
exports.computeReportExtractionConfidence = computeReportExtractionConfidence;
const STUDY_TYPE_PATTERNS = [
    /(?:estudio|perfil|reporte\s+de)\s*:\s*([^\n\r]{3,80})/i,
    /\b(CURVA\s+DE\s+TOLERANCIA\s+A\s+LA\s+GLUCOSA[^\n\r]{0,40}|CURVA\s+DE\s+INSULINA[^\n\r]{0,40})\b/i,
    /\b(QU[IÍ]MICA DE \d+ ELEMENTOS[^\n\r]{0,30}|INSULINA EN SUERO|BIOMETR[IÍ]A[^\n\r]{0,50})\b/i,
    /\b(PERFIL\s+DE\s+LIP[IÍ]D(?:OS|ICO)(?:\s+EN\s+SUERO)?)\b/i,
    /\b(biometr[i\u00ed]a\s+hem[a\u00e1]tica|qu[i\u00ed]mica\s+sangu[i\u00ed]nea|hemograma\s+completo|perfil\s+lip[i\u00ed]dico|perfil\s+hep[a\u00e1]tico|perfil\s+renal|funci[o\u00f3]n\s+hep[a\u00e1]tica|funci[o\u00f3]n\s+renal|tiroides|electrolitos|uroan[a\u00e1]lisis|coprolog[i\u00ed]a)\b/i,
];
const STUDY_TYPE_DISCLAIMER = /se realiza en la misma muestra|posterior a esta fecha|aviso importante|prestador|privacidad|reproceso del estudio|muestras sangu|\d{1,2}\/\d{1,2}\/\d{2,4}\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4}/i;
const CHOPO_CURVE_GLUCOSE = /\b(CURVA\s+DE\s+TOLERANCIA\s+A\s+LA\s+GLUCOSA[^\n\r]{0,40})/i;
const CHOPO_CURVE_INSULIN = /\b(CURVA\s+DE\s+INSULINA[^\n\r]{0,40})/i;
const LAB_NAME_PATTERNS = [
    /(?:^|\n)\s*(LABORATORIO(?:\s+DE)?\s+[^\n\r]{2,70})/i,
    /(?:laboratorio|lab\.?)\s*[:\-]\s*([^\n\r]{3,80})/i,
    /(?:^|\n)\s*((?:LAB|Lab)\s+[A-Z\u00c1\u00c9\u00cd\u00d3\u00da][^\n\r]{2,60})/,
    /\b(Chopo|Labcorp|Salud\s+Digna|Quest\s+Diagnostics|An[a\u00e1]lisis\s+Cl[i\u00ed]nicos[^\n\r]{0,40})\b/i,
];
const STUDY_DATE_LABELS = /(?:fecha\s+de\s+(?:toma|muestra|estudio|ingreso|atenci[oó]n)|fecha\s+del\s+estudio|fecha\s*:)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const TOMA_MUESTRA_DATE = /(?:fecha\s+(?:de\s+)?toma\s+(?:de\s+)?muestra|fecha\s+toma\s+de\s+muestra)[^\d\n]{0,25}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const REPORT_DATE_LABELS = /(?:fecha\s+de\s+(?:resultado|reporte|impresi[o\u00f3]n|emisi[o\u00f3]n)|fecha\s+reporte|emisi[o\u00f3]n)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const LAPI_FECHAS_HEADER = /fechas?\s*:\s*(?:atenci[o\u00f3]n\s*\/\s*toma\s*muestra\s*\/\s*emisi[o\u00f3]n)?/i;
const LAPI_TOMA_MUESTRA_DATE = /toma\s*muestra[^\d\n]{0,40}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const LAPI_ATENCION_DATE = /atenci[o\u00f3]n[^\d\n]{0,40}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const LAPI_EMISION_DATE = /emisi[o\u00f3]n[^\d\n]{0,40}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const BIRTH_OR_AGE_LINE = /\b(?:f\/?n\.?|f\.?\s*n\.?\s*:?|fecha\s+de\s+nacimiento|f\.?\s*nac\.?|fecha\s+nacimiento|nacimiento|edad\s*:)\b/i;
const DATE_TOKEN = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
const HEADER_SKIP = /^(nombre|paciente|edad|sexo|m[e\u00e9]dico|doctor|cliente|folio|no\.?\s*de\s*orden|resultado|unidad|referencia|valores?\s+de\s+referencia|par[a\u00e1]metro|analito|comentarios?)$/i;
function parseMxDateString(raw) {
    const m = raw.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!m)
        return undefined;
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100)
        year += 2000;
    const d = new Date(year, month, day);
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day)
        return undefined;
    return d;
}
function firstLines(text, n = 12) {
    return text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 3 && !HEADER_SKIP.test(l))
        .slice(0, n);
}
function pickLaboratoryName(text) {
    var _a;
    if (/chopo\.com\.mx/i.test(text))
        return 'CHOPO';
    for (const re of LAB_NAME_PATTERNS) {
        const m = text.match(re);
        const candidate = (_a = m === null || m === void 0 ? void 0 : m[1]) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, ' ').trim();
        if (candidate && candidate.length >= 3 && candidate.length <= 120) {
            if (/^an[aá]lisis cl[ií]nicos$/i.test(candidate))
                continue;
            return candidate;
        }
    }
    const line = firstLines(text).find((l) => /laboratorio|an[a\u00e1]lisis\s+cl[i\u00ed]nicos/i.test(l));
    if (line && line.length <= 120)
        return line.replace(/\s+/g, ' ').trim();
    return undefined;
}
function sanitizeStudyType(raw) {
    let s = raw.replace(/\s+/g, ' ').trim();
    s = s.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}(?:\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4})?.*$/i, '').trim();
    return s;
}
function pickStudyType(text) {
    var _a, _b, _c, _d;
    const glucoseCurve = (_a = text.match(CHOPO_CURVE_GLUCOSE)) === null || _a === void 0 ? void 0 : _a[1];
    const insulinCurve = (_b = text.match(CHOPO_CURVE_INSULIN)) === null || _b === void 0 ? void 0 : _b[1];
    if (glucoseCurve || insulinCurve) {
        const parts = [glucoseCurve, insulinCurve]
            .filter(Boolean)
            .map((part) => sanitizeStudyType(part))
            .filter((part) => part.length >= 4 && !STUDY_TYPE_DISCLAIMER.test(part));
        if (parts.length > 0)
            return parts.join(' + ');
    }
    const sectionMatch = text.match(/\b(QU[IÍ]MICA DE \d+ ELEMENTOS[^\n\r]{0,30}|INSULINA EN SUERO|BIOMETR[IÍ]A[^\n\r]{0,50}|PERFIL\s+DE\s+LIP[IÍ]D(?:OS|ICO)(?:\s+EN\s+SUERO)?)\b/i);
    if (sectionMatch === null || sectionMatch === void 0 ? void 0 : sectionMatch[1]) {
        const cleaned = sanitizeStudyType(sectionMatch[1]);
        if (cleaned.length >= 4 && !STUDY_TYPE_DISCLAIMER.test(cleaned))
            return cleaned;
    }
    const typedLine = firstLines(text).find((l) => /biometr|qu[i\u00ed]mica|hemograma|perfil|lip[i\u00ed]dico|hep[a\u00e1]tico|renal|tiroides/i.test(l) &&
        !/laboratorio|an[a\u00e1]lisis\s+cl[i\u00ed]nicos/i.test(l));
    if (typedLine)
        return typedLine.replace(/\s+/g, ' ').trim();
    for (const re of STUDY_TYPE_PATTERNS) {
        const m = text.match(re);
        const candidate = (_d = ((_c = m === null || m === void 0 ? void 0 : m[1]) !== null && _c !== void 0 ? _c : m === null || m === void 0 ? void 0 : m[0])) === null || _d === void 0 ? void 0 : _d.replace(/\s+/g, ' ').trim();
        if (candidate &&
            candidate.length >= 4 &&
            candidate.length <= 100 &&
            !STUDY_TYPE_DISCLAIMER.test(candidate)) {
            return candidate;
        }
    }
    return undefined;
}
function pickLabeledDate(text, labelRe) {
    const m = text.match(labelRe);
    if (!(m === null || m === void 0 ? void 0 : m[1]))
        return undefined;
    return parseMxDateString(m[1]);
}
function pickTomaMuestraStudyDate(text) {
    const toma = text.match(TOMA_MUESTRA_DATE);
    if (toma === null || toma === void 0 ? void 0 : toma[1])
        return parseMxDateString(toma[1]);
    return undefined;
}
function pickLapiStudyDate(text) {
    const toma = text.match(LAPI_TOMA_MUESTRA_DATE);
    if (toma === null || toma === void 0 ? void 0 : toma[1])
        return parseMxDateString(toma[1]);
    const atencion = text.match(LAPI_ATENCION_DATE);
    if (atencion === null || atencion === void 0 ? void 0 : atencion[1])
        return parseMxDateString(atencion[1]);
    if (LAPI_FECHAS_HEADER.test(text)) {
        const afterHeader = text.split(LAPI_FECHAS_HEADER)[1];
        const m = afterHeader === null || afterHeader === void 0 ? void 0 : afterHeader.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (m === null || m === void 0 ? void 0 : m[1])
            return parseMxDateString(m[1]);
    }
    return undefined;
}
function pickFirstDateExcludingBirth(text) {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (BIRTH_OR_AGE_LINE.test(line))
            continue;
        const matches = [...line.matchAll(DATE_TOKEN)];
        for (const m of matches) {
            const d = parseMxDateString(m[1]);
            if (d)
                return d;
        }
    }
    return undefined;
}
function parseStudyMetadataFromText(text) {
    var _a, _b, _c, _d;
    const normalized = text.replace(/\r/g, '');
    const studyDate = (_c = (_b = (_a = pickTomaMuestraStudyDate(normalized)) !== null && _a !== void 0 ? _a : pickLabeledDate(normalized, STUDY_DATE_LABELS)) !== null && _b !== void 0 ? _b : pickLapiStudyDate(normalized)) !== null && _c !== void 0 ? _c : pickFirstDateExcludingBirth(normalized);
    const reportDate = (_d = pickLabeledDate(normalized, REPORT_DATE_LABELS)) !== null && _d !== void 0 ? _d : pickLabeledDate(normalized, LAPI_EMISION_DATE);
    return {
        laboratoryName: pickLaboratoryName(normalized),
        studyType: pickStudyType(normalized),
        studyDate,
        reportDate: reportDate !== null && reportDate !== void 0 ? reportDate : undefined,
    };
}
function metadataConfidenceBoost(meta) {
    let boost = 0;
    if (meta.laboratoryName)
        boost += 0.08;
    if (meta.studyType)
        boost += 0.08;
    if (meta.studyDate)
        boost += 0.07;
    if (meta.reportDate)
        boost += 0.05;
    return Math.min(0.28, boost);
}
function metadataOnlyConfidence(meta) {
    let score = 0.32;
    if (meta.laboratoryName)
        score += 0.12;
    if (meta.studyType)
        score += 0.12;
    if (meta.studyDate)
        score += 0.1;
    if (meta.reportDate)
        score += 0.06;
    return Math.min(0.72, score);
}
function computeReportExtractionConfidence(rowConfidences, meta) {
    const boost = metadataConfidenceBoost(meta);
    if (rowConfidences.length === 0)
        return metadataOnlyConfidence(meta);
    const avg = rowConfidences.reduce((s, c) => s + c, 0) / rowConfidences.length;
    return Math.min(0.98, avg + boost);
}
