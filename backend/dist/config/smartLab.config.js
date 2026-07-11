"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSmartLabEnabled = isSmartLabEnabled;
exports.getSmartLabMaxPdfMb = getSmartLabMaxPdfMb;
exports.isSmartLabPatientUploadEnabled = isSmartLabPatientUploadEnabled;
exports.isSmartLabExternalOcrEnabled = isSmartLabExternalOcrEnabled;
exports.getSmartLabMissingFollowupMonths = getSmartLabMissingFollowupMonths;
exports.getSmartLabReviewThreshold = getSmartLabReviewThreshold;
exports.isSmartLabAiFallbackEnabled = isSmartLabAiFallbackEnabled;
exports.getSmartLabOpenAiModel = getSmartLabOpenAiModel;
exports.isSmartLabOcrEnabled = isSmartLabOcrEnabled;
/**
 * Laboratorio Inteligente - feature flag y configuracion.
 */
function envBool(key, defaultValue = false) {
    var _a;
    const raw = String((_a = process.env[key]) !== null && _a !== void 0 ? _a : '').trim().toLowerCase();
    if (!raw)
        return defaultValue;
    return raw === 'true' || raw === '1' || raw === 'yes';
}
function envInt(key, defaultValue) {
    var _a;
    const raw = String((_a = process.env[key]) !== null && _a !== void 0 ? _a : '').trim();
    if (!raw)
        return defaultValue;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : defaultValue;
}
function isSmartLabEnabled() {
    return envBool('SMART_LAB_ENABLED', false);
}
function getSmartLabMaxPdfMb() {
    return envInt('SMART_LAB_MAX_PDF_MB', 15);
}
function isSmartLabPatientUploadEnabled() {
    return envBool('SMART_LAB_PATIENT_UPLOAD_ENABLED', false);
}
function isSmartLabExternalOcrEnabled() {
    return envBool('SMART_LAB_EXTERNAL_OCR_ENABLED', false);
}
function getSmartLabMissingFollowupMonths() {
    return envInt('SMART_LAB_MISSING_FOLLOWUP_MONTHS', 6);
}
function getSmartLabReviewThreshold() {
    var _a;
    const raw = String((_a = process.env.SMART_LAB_REVIEW_THRESHOLD) !== null && _a !== void 0 ? _a : '').trim();
    if (!raw)
        return 0.9;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.9;
}
function isSmartLabAiFallbackEnabled() {
    return envBool('SMART_LAB_AI_FALLBACK_ENABLED', false);
}
function getSmartLabOpenAiModel() {
    var _a;
    return String((_a = process.env.SMART_LAB_OPENAI_MODEL) !== null && _a !== void 0 ? _a : 'gpt-4o-mini').trim() || 'gpt-4o-mini';
}
function isSmartLabOcrEnabled() {
    return isSmartLabExternalOcrEnabled();
}
