"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStudyMetadataFromText = void 0;
exports.extractTextFromPdfBuffer = extractTextFromPdfBuffer;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const smartLab_config_1 = require("../../config/smartLab.config");
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
var labMetadata_service_1 = require("./labMetadata.service");
Object.defineProperty(exports, "parseStudyMetadataFromText", { enumerable: true, get: function () { return labMetadata_service_1.parseStudyMetadataFromText; } });
function detectScannedOrPoorText(text) {
    var _a, _b;
    const trimmed = text.trim();
    if (trimmed.length < 80)
        return 'scanned';
    const alphaRatio = ((_b = (_a = trimmed.match(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) / trimmed.length;
    if (alphaRatio < 0.15)
        return 'scanned';
    if (trimmed.length < 200 || alphaRatio < 0.25)
        return 'poor';
    return 'good';
}
async function extractTextFromPdfBuffer(buffer) {
    if ((0, smartLab_config_1.isSmartLabExternalOcrEnabled)()) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.EXTERNAL_OCR_DISABLED, 501);
    }
    const parsed = await (0, pdf_parse_1.default)(buffer);
    const text = (parsed.text || '').trim();
    const quality = detectScannedOrPoorText(text);
    const engine = quality === 'scanned' ? 'pdf-parse:scanned' : quality === 'poor' ? 'pdf-parse:poor' : 'pdf-parse';
    return { text, engine };
}
