"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLabReportPdf = uploadLabReportPdf;
const crypto_1 = __importDefault(require("crypto"));
const file_utils_1 = require("../../utils/file.utils");
const database_1 = __importDefault(require("../../config/database"));
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
const labPdfValidation_service_1 = require("./labPdfValidation.service");
const labAudit_service_1 = require("./labAudit.service");
const smartLab_config_1 = require("../../config/smartLab.config");
const labAccess_service_1 = require("./labAccess.service");
async function uploadLabReportPdf(req, patientId, file) {
    var _a;
    const access = await (0, labAccess_service_1.assertPatientAccess)(req, patientId);
    if (access.role === 'PATIENT' && !(0, smartLab_config_1.isSmartLabPatientUploadEnabled)()) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.PATIENT_UPLOAD_DISABLED, 403);
    }
    await (0, labPdfValidation_service_1.validateLabPdfBuffer)(file.buffer, file.mimetype);
    const fileHash = crypto_1.default.createHash('sha256').update(file.buffer).digest('hex');
    const duplicate = await database_1.default.labReport.findFirst({
        where: { patientId, fileHash },
        select: { id: true },
    });
    if (duplicate)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.DUPLICATE_FILE, 409);
    const doctorId = access.role === 'DOCTOR' || access.role === 'ASISTENTE'
        ? (_a = access.doctorId) !== null && _a !== void 0 ? _a : (await (0, labAccess_service_1.resolveDoctorId)(req))
        : null;
    const category = `smart-lab/${patientId}`;
    const uploaded = await (0, file_utils_1.uploadToS3)(file, category, patientId);
    const report = await database_1.default.labReport.create({
        data: {
            patientId,
            doctorId: doctorId !== null && doctorId !== void 0 ? doctorId : undefined,
            sourcePdfUrl: uploaded.url,
            fileHash,
            extractionStatus: 'uploaded',
        },
    });
    (0, labAudit_service_1.recordLabAuditFireAndForget)({
        actorUserId: access.userId,
        patientId,
        labReportId: report.id,
        action: 'upload',
        metadata: { fileHash, key: uploaded.key },
    });
    return report;
}
