import pdfParse from 'pdf-parse';
import { isSmartLabExternalOcrEnabled } from '../../config/smartLab.config';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS } from '../../constants/lab.constants';

export { parseStudyMetadataFromText } from './labMetadata.service';

function detectScannedOrPoorText(text: string): 'good' | 'poor' | 'scanned' {
  const trimmed = text.trim();
  if (trimmed.length < 80) return 'scanned';
  const alphaRatio = (trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g)?.length ?? 0) / trimmed.length;
  if (alphaRatio < 0.15) return 'scanned';
  if (trimmed.length < 200 || alphaRatio < 0.25) return 'poor';
  return 'good';
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{ text: string; engine: string }> {
  if (isSmartLabExternalOcrEnabled()) {
    throw new AppError(LAB_ERRORS.EXTERNAL_OCR_DISABLED, 501);
  }

  const parsed = await pdfParse(buffer);
  const text = (parsed.text || '').trim();
  const quality = detectScannedOrPoorText(text);
  const engine = quality === 'scanned' ? 'pdf-parse:scanned' : quality === 'poor' ? 'pdf-parse:poor' : 'pdf-parse';
  return { text, engine };
}
