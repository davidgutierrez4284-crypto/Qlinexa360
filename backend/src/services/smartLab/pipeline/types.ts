export type LabVendor =
  | 'chopo'
  | 'salud_digna'
  | 'lapi'
  | 'olab'
  | 'laboratorios_ruiz'
  | 'carpermor'
  | 'biomedica'
  | 'laboratorio_polanco'
  | 'unknown';

export type DocumentLayout = 'stacked' | 'tabular' | 'mixed';
export type TextQuality = 'good' | 'poor' | 'scanned';

export interface ClassifiedDocument {
  vendor: LabVendor;
  studyType: string | null;
  layout: DocumentLayout;
  textQuality: TextQuality;
  confidence: number;
  laboratoryName: string | null;
}

export interface ParameterCandidate {
  rawName: string;
  canonicalName: string | null;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  referenceLow: number | null;
  referenceHigh: number | null;
  referenceText: string | null;
  confidence: number;
  sourceLines: string[];
  validationErrors: string[];
}

export interface ExtractionTrace {
  classifiedVendor: LabVendor;
  parserUsed: string;
  processingMs: number;
  rowCount: number;
  rowsWithValidationErrors: number;
  lowConfidenceRowCount: number;
  aiFallbackUsed: boolean;
  textLength: number;
  textQuality: TextQuality;
}

export interface PipelineResult {
  candidates: ParameterCandidate[];
  classification: ClassifiedDocument;
  trace: ExtractionTrace;
  engine: string;
  metadata: {
    laboratoryName?: string;
    studyType?: string;
    studyDate?: Date;
    reportDate?: Date;
  };
}
