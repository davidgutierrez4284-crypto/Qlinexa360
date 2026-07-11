"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPdfMagicBytes = assertPdfMagicBytes;
exports.assertPdfMime = assertPdfMime;
exports.assertPdfSize = assertPdfSize;
exports.validateLabPdfBuffer = validateLabPdfBuffer;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
const smartLab_config_1 = require("../../config/smartLab.config");
const PDF_MAGIC = Buffer.from('%PDF');
function assertPdfMagicBytes(buffer) {
    if (buffer.length < 4 || !buffer.subarray(0, 4).equals(PDF_MAGIC)) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_PDF, 400);
    }
}
function assertPdfMime(mimetype) {
    const mt = (mimetype || '').toLowerCase();
    if (mt !== 'application/pdf' && mt !== 'application/x-pdf') {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_PDF, 400);
    }
}
function assertPdfSize(buffer) {
    const maxBytes = (0, smartLab_config_1.getSmartLabMaxPdfMb)() * 1024 * 1024;
    if (buffer.length > maxBytes) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.PDF_TOO_LARGE, 400);
    }
}
async function validateLabPdfBuffer(buffer, mimetype) {
    assertPdfSize(buffer);
    assertPdfMagicBytes(buffer);
    assertPdfMime(mimetype);
    let parsed;
    try {
        parsed = await (0, pdf_parse_1.default)(buffer);
    }
    catch (_a) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_PDF, 400);
    }
    const text = (parsed.text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 80) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.INVALID_PDF, 400);
    }
    return { text };
}
