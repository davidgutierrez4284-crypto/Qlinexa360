"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smartLabPdfUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const smartLab_config_1 = require("../config/smartLab.config");
const storage = multer_1.default.memoryStorage();
const MAX_BYTES = () => (0, smartLab_config_1.getSmartLabMaxPdfMb)() * 1024 * 1024;
const pdfFilter = (_req, file, cb) => {
    var _a;
    const mt = (file.mimetype || '').toLowerCase();
    if (mt !== 'application/pdf' && mt !== 'application/x-pdf') {
        return cb(new Error('Solo se permiten archivos PDF.'));
    }
    const ext = (_a = file.originalname.split('.').pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (ext !== 'pdf') {
        return cb(new Error('La extension del archivo debe ser .pdf'));
    }
    cb(null, true);
};
exports.smartLabPdfUpload = (0, multer_1.default)({
    storage,
    fileFilter: pdfFilter,
    limits: {
        fileSize: MAX_BYTES(),
        files: 1,
    },
});
