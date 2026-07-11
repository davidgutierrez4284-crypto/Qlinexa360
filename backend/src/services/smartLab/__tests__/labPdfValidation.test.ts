import { AppError } from '../../../utils/error.utils';
import {
  assertPdfMagicBytes,
  assertPdfMime,
  assertPdfSize,
  validateLabPdfBuffer,
} from '../labPdfValidation.service';

jest.mock('../../../config/smartLab.config', () => ({
  getSmartLabMaxPdfMb: () => 1,
}));

jest.mock('pdf-parse', () =>
  jest.fn(async () => ({
    text: 'Laboratorio demo ' + 'x'.repeat(90),
  }))
);

describe('labPdfValidation', () => {
  const pdfHeader = Buffer.from('%PDF-1.4 fake content');

  it('accepts PDF magic bytes', () => {
    expect(() => assertPdfMagicBytes(pdfHeader)).not.toThrow();
  });

  it('rejects non-PDF magic bytes', () => {
    expect(() => assertPdfMagicBytes(Buffer.from('NOTPDF'))).toThrow(AppError);
  });

  it('accepts application/pdf mime', () => {
    expect(() => assertPdfMime('application/pdf')).not.toThrow();
  });

  it('rejects invalid mime', () => {
    expect(() => assertPdfMime('image/png')).toThrow(AppError);
  });

  it('rejects oversized buffer', () => {
    const big = Buffer.alloc(2 * 1024 * 1024);
    big.write('%PDF', 0);
    expect(() => assertPdfSize(big)).toThrow(AppError);
  });

  it('validateLabPdfBuffer returns trimmed text', async () => {
    const { text } = await validateLabPdfBuffer(pdfHeader, 'application/pdf');
    expect(text.length).toBeGreaterThanOrEqual(80);
  });
});
