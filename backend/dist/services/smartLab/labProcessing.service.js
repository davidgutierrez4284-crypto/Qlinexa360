"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAndParseLabPdf = extractAndParseLabPdf;
const labExtraction_service_1 = require("./labExtraction.service");
const labPipeline_service_1 = require("./pipeline/labPipeline.service");
const parameterMapper_1 = require("./pipeline/parameterMapper");
const clinicalValidator_service_1 = require("./pipeline/clinicalValidator.service");
async function extractAndParseLabPdf(buffer) {
    const { text, engine } = await (0, labExtraction_service_1.extractTextFromPdfBuffer)(buffer);
    const pipeline = await (0, labPipeline_service_1.runLabExtractionPipeline)(text, engine);
    const parsedLines = pipeline.candidates.map(parameterMapper_1.parameterCandidateToParsedLine);
    const reportConfidence = (0, labPipeline_service_1.computePipelineReportConfidence)(pipeline.candidates, {
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
        hasBlockingValidationErrors: (0, clinicalValidator_service_1.reportHasBlockingValidationErrors)(pipeline.candidates),
    };
}
