"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLabExtractionPipeline = runLabExtractionPipeline;
exports.computePipelineReportConfidence = computePipelineReportConfidence;
const labMetadata_service_1 = require("../labMetadata.service");
const smartLab_config_1 = require("../../../config/smartLab.config");
const documentClassifier_service_1 = require("./documentClassifier.service");
const clinicalValidator_service_1 = require("./clinicalValidator.service");
const analyteInference_service_1 = require("./analyteInference.service");
const parserRegistry_service_1 = require("./parserRegistry.service");
const aiFallback_service_1 = require("./aiFallback.service");
function shouldUseAiFallback(candidates, textQuality) {
    if (!(0, smartLab_config_1.isSmartLabAiFallbackEnabled)())
        return false;
    if (candidates.length === 0)
        return true;
    if (textQuality === 'scanned' || textQuality === 'poor')
        return true;
    const lowRatio = (0, clinicalValidator_service_1.countLowConfidenceRows)(candidates) / candidates.length;
    return lowRatio > 0.3;
}
function filterCriticalInvalidRows(candidates) {
    return candidates.filter((c) => {
        if (c.confidence < 0.15)
            return false;
        return !c.validationErrors.some((e) => e.includes('fragmento') ||
            e.includes('código numérico') ||
            e.includes('inválido') ||
            e.includes('no válida') ||
            e.includes('debe expresarse') ||
            e.includes('Unidad inusual') ||
            e.includes('no usan') ||
            e.includes('descartado') ||
            e.includes('fragmento del PDF') ||
            e.includes('incompatible') ||
            e.includes('cédula profesional') ||
            e.includes('firma o pie de página'));
    });
}
async function runLabExtractionPipeline(text, engine) {
    var _a, _b;
    const started = Date.now();
    const classification = (0, documentClassifier_service_1.classifyLabDocument)(text);
    let { candidates, parserUsed } = (0, parserRegistry_service_1.parseWithRegisteredParsers)(text, classification, parserRegistry_service_1.REGISTERED_LAB_PARSERS);
    let aiFallbackUsed = false;
    if (shouldUseAiFallback(candidates, classification.textQuality)) {
        const aiCandidates = await (0, aiFallback_service_1.tryAiFallbackExtraction)(text, classification);
        if (aiCandidates.length > 0) {
            candidates = aiCandidates;
            parserUsed = 'AiJsonFallback';
            aiFallbackUsed = true;
            engine = `${engine}+ai-fallback`;
        }
    }
    candidates = (0, clinicalValidator_service_1.validateParameterCandidates)(candidates.map(analyteInference_service_1.inferAnalyteFromUnitRange));
    candidates = filterCriticalInvalidRows(candidates);
    const meta = (0, labMetadata_service_1.parseStudyMetadataFromText)(text);
    const processingMs = Date.now() - started;
    const rowsWithValidationErrors = candidates.filter((c) => c.validationErrors.length > 0).length;
    const lowConfidenceRowCount = (0, clinicalValidator_service_1.countLowConfidenceRows)(candidates);
    return {
        candidates,
        classification,
        engine,
        metadata: {
            laboratoryName: (_a = classification.laboratoryName) !== null && _a !== void 0 ? _a : meta.laboratoryName,
            studyType: (_b = classification.studyType) !== null && _b !== void 0 ? _b : meta.studyType,
            studyDate: meta.studyDate,
            reportDate: meta.reportDate,
        },
        trace: {
            classifiedVendor: classification.vendor,
            parserUsed,
            processingMs,
            rowCount: candidates.length,
            rowsWithValidationErrors,
            lowConfidenceRowCount,
            aiFallbackUsed,
            textLength: text.length,
            textQuality: classification.textQuality,
        },
    };
}
function computePipelineReportConfidence(candidates, meta) {
    const rowConfidences = candidates.map((c) => c.confidence);
    let score = (0, labMetadata_service_1.computeReportExtractionConfidence)(rowConfidences, meta);
    const threshold = (0, smartLab_config_1.getSmartLabReviewThreshold)();
    if (candidates.some((c) => c.validationErrors.length > 0)) {
        score = Math.min(score, threshold + 0.02);
    }
    return score;
}
