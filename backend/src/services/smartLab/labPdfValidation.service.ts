import pdfParse from 'pdf-parse';
import { AppError } from '../../utils/error.utils';
import { LAB_ERRORS } from '../../constants/lab.constants';
import { getSmartLabMaxPdfMb } from '../../config/smartLab.config';

const PDF_MAGIC = Buffer.from('%PDF');

export function assertPdfMagicBytes(buffer: Buffer): void {
  if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    throw new AppError(LAB_ERRORS.INVALID_PDF, 400);
  }
}

export function assertPdfMime(mimetype: string | undefined): void {
  const mt = (mimetype || '').toLowerCase();
  if (mt !== 'application/pdf' && mt !== 'application/x-pdf') {
    throw new AppError(LAB_ERRORS.INVALID_PDF, 400);
  }
}

export function assertPdfSize(buffer: Buffer): void {
  const maxBytes = getSmartLabMaxPdfMb() * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new AppError(LAB_ERRORS.PDF_TOO_LARGE, 400);
  }
}

export async function validateLabPdfBuffer(buffer: Buffer, mimetype?: string): Promise<{ text: string }> {
  assertPdfSize(buffer);
  assertPdfMagicBytes(buffer);
  assertPdfMime(mimetype);

  let parsed: { text?: string };
  try {
    parsed = await pdfParse(buffer);
  } catch {
    throw new AppError(LAB_ERRORS.INVALID_PDF, 400);
  }

  const text = (parsed.text || '').replace(/\s+/g, ' ').trim();
  if (text.length < 80) {
    throw new AppError(LAB_ERRORS.INVALID_PDF, 400);
  }

  return { text };
}
