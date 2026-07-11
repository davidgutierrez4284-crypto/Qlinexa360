import { extractTextFromPdfBuffer as extractPdfText } from './labExtraction.service';
import {
  computePipelineReportConfidence,
  runLabExtractionPipeline,
} from './pipeline/labPipeline.service';
import { parameterCandidateToParsedLine } from './pipeline/parameterMapper';
import { reportHasBlockingValidationErrors } from './pipeline/clinicalValidator.service';
import type { ParsedLabLine } from './labParser.service';

export type ProcessedLabExtraction = {
  text: string;
  engine: string;
  parsedLines: ParsedLabLine[];
  pipeline: Awaited<ReturnType<typeof runLabExtractionPipeline>>;
  reportConfidence: number;
  hasBlockingValidationErrors: boolean;
};

export async function extractAndParseLabPdf(buffer: Buffer): Promise<ProcessedLabExtraction> {
  const { text, engine } = await extractPdfText(buffer);
  const pipeline = await runLabExtractionPipeline(text, engine);
  const parsedLines = pipeline.candidates.map(parameterCandidateToParsedLine);
  const reportConfidence = computePipelineReportConfidence(pipeline.candidates, {
    laboratoryName: pipeline.metadata.laboratoryName,
    studyType: pipeline.metadata.studyType,
    studyDate: pipeline.metadata.studyDate,
    reportDate: pipeline.metadata.reportDate,
  });

  return {
    text,
    engine: pipeline.engine,
    parsedLines,
    pipeline,
    reportConfidence,
    hasBlockingValidationErrors: reportHasBlockingValidationErrors(pipeline.candidates),
  };
}
