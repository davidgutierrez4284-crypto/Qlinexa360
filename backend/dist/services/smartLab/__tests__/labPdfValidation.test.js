"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const error_utils_1 = require("../../../utils/error.utils");
const labPdfValidation_service_1 = require("../labPdfValidation.service");
jest.mock('../../../config/smartLab.config', () => ({
    getSmartLabMaxPdfMb: () => 1,
}));
jest.mock('pdf-parse', () => jest.fn(async () => ({
    text: 'Laboratorio demo ' + 'x'.repeat(90),
})));
describe('labPdfValidation', () => {
    const pdfHeader = Buffer.from('%PDF-1.4 fake content');
    it('accepts PDF magic bytes', () => {
        expect(() => (0, labPdfValidation_service_1.assertPdfMagicBytes)(pdfHeader)).not.toThrow();
    });
    it('rejects non-PDF magic bytes', () => {
        expect(() => (0, labPdfValidation_service_1.assertPdfMagicBytes)(Buffer.from('NOTPDF'))).toThrow(error_utils_1.AppError);
    });
    it('accepts application/pdf mime', () => {
        expect(() => (0, labPdfValidation_service_1.assertPdfMime)('application/pdf')).not.toThrow();
    });
    it('rejects invalid mime', () => {
        expect(() => (0, labPdfValidation_service_1.assertPdfMime)('image/png')).toThrow(error_utils_1.AppError);
    });
    it('rejects oversized buffer', () => {
        const big = Buffer.alloc(2 * 1024 * 1024);
        big.write('%PDF', 0);
        expect(() => (0, labPdfValidation_service_1.assertPdfSize)(big)).toThrow(error_utils_1.AppError);
    });
    it('validateLabPdfBuffer returns trimmed text', async () => {
        const { text } = await (0, labPdfValidation_service_1.validateLabPdfBuffer)(pdfHeader, 'application/pdf');
        expect(text.length).toBeGreaterThanOrEqual(80);
    });
});
