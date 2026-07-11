import { parseStudyMetadataFromText, computeReportExtractionConfidence } from '../labMetadata.service';
import {
  isSmartLabAiFallbackEnabled,
  getSmartLabReviewThreshold,
} from '../../../config/smartLab.config';
import { classifyLabDocument } from './documentClassifier.service';
import {
  countLowConfidenceRows,
  validateParameterCandidates,
} from './clinicalValidator.service';
import { inferAnalyteFromUnitRange } from './analyteInference.service';
import { REGISTERED_LAB_PARSERS, parseWithRegisteredParsers } from './parserRegistry.service';
import { tryAiFallbackExtraction } from './aiFallback.service';
import type { PipelineResult, ParameterCandidate } from './types';

function shouldUseAiFallback(
  candidates: ParameterCandidate[],
  textQuality: PipelineResult['classification']['textQuality']
): boolean {
  if (!isSmartLabAiFallbackEnabled()) return false;
  if (candidates.length === 0) return true;
  if (textQuality === 'scanned' || textQuality === 'poor') return true;
  const lowRatio = countLowConfidenceRows(candidates) / candidates.length;
  return lowRatio > 0.3;
}

function filterCriticalInvalidRows(candidates: ParameterCandidate[]): ParameterCandidate[] {
  return candidates.filter((c) => {
    if (c.confidence < 0.15) return false;
    return !c.validationErrors.some(
      (e) =>
        e.includes('fragmento') ||
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
        e.includes('firma o pie de página')
    );
  });
}

export async function runLabExtractionPipeline(text: string, engine: string): Promise<PipelineResult> {
  const started = Date.now();
  const classification = classifyLabDocument(text);
  let { candidates, parserUsed } = parseWithRegisteredParsers(text, classification, REGISTERED_LAB_PARSERS);

  let aiFallbackUsed = false;
  if (shouldUseAiFallback(candidates, classification.textQuality)) {
    const aiCandidates = await tryAiFallbackExtraction(text, classification);
    if (aiCandidates.length > 0) {
      candidates = aiCandidates;
      parserUsed = 'AiJsonFallback';
      aiFallbackUsed = true;
      engine = `${engine}+ai-fallback`;
    }
  }

  candidates = validateParameterCandidates(candidates.map(inferAnalyteFromUnitRange));
  candidates = filterCriticalInvalidRows(candidates);

  const meta = parseStudyMetadataFromText(text);
  const processingMs = Date.now() - started;
  const rowsWithValidationErrors = candidates.filter((c) => c.validationErrors.length > 0).length;
  const lowConfidenceRowCount = countLowConfidenceRows(candidates);

  return {
    candidates,
    classification,
    engine,
    metadata: {
      laboratoryName: classification.laboratoryName ?? meta.laboratoryName,
      studyType: classification.studyType ?? meta.studyType,
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

export function computePipelineReportConfidence(
  candidates: ParameterCandidate[],
  meta: ReturnType<typeof parseStudyMetadataFromText>
): number {
  const rowConfidences = candidates.map((c) => c.confidence);
  let score = computeReportExtractionConfidence(rowConfidences, meta);
  const threshold = getSmartLabReviewThreshold();
  if (candidates.some((c) => c.validationErrors.length > 0)) {
    score = Math.min(score, threshold + 0.02);
  }
  return score;
}
