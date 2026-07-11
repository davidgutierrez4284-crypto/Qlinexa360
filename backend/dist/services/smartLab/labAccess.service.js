"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertLabRole = assertLabRole;
exports.resolveDoctorId = resolveDoctorId;
exports.resolvePatientIdForUser = resolvePatientIdForUser;
exports.assertPatientAccess = assertPatientAccess;
exports.assertReportAccess = assertReportAccess;
const database_1 = __importDefault(require("../../config/database"));
const error_utils_1 = require("../../utils/error.utils");
const lab_constants_1 = require("../../constants/lab.constants");
const LAB_ROLES = ['DOCTOR', 'PATIENT', 'ASISTENTE', 'ADMIN'];
function assertLabRole(role) {
    if (!LAB_ROLES.includes(role)) {
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.FORBIDDEN, 403);
    }
}
async function resolveDoctorId(req) {
    if (!req.user)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.UNAUTHORIZED, 401);
    assertLabRole(req.user.role);
    if (req.user.role === 'DOCTOR') {
        const doctor = await database_1.default.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true },
        });
        if (!doctor)
            throw new error_utils_1.AppError('Usuario no encontrado en tabla Doctor', 404);
        return doctor.id;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
            throw new error_utils_1.AppError('Doctor seleccionado requerido', 400);
        }
        const link = await database_1.default.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true,
            },
            select: { permisosEstudios: true },
        });
        if (!link)
            throw new error_utils_1.AppError('Asistente no vinculado a este doctor', 403);
        if (!link.permisosEstudios) {
            throw new error_utils_1.AppError('No tienes permisos para estudios de laboratorio', 403);
        }
        return selectedDoctorId;
    }
    if (req.user.role === 'ADMIN') {
        return null;
    }
    return null;
}
async function resolvePatientIdForUser(userId, role) {
    var _a;
    if (role !== 'PATIENT')
        return null;
    const patient = await database_1.default.patient.findUnique({
        where: { userId },
        select: { id: true },
    });
    return (_a = patient === null || patient === void 0 ? void 0 : patient.id) !== null && _a !== void 0 ? _a : null;
}
async function assertPatientAccess(req, patientId) {
    if (!req.user)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.UNAUTHORIZED, 401);
    const { userId, role } = req.user;
    assertLabRole(role);
    const patient = await database_1.default.patient.findUnique({ where: { id: patientId }, select: { id: true, userId: true } });
    if (!patient)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.PATIENT_NOT_FOUND, 404);
    if (role === 'PATIENT') {
        if (patient.userId !== userId)
            throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.FORBIDDEN, 403);
        return { role, userId, patientId };
    }
    if (role === 'ADMIN') {
        const admin = await database_1.default.admin.findUnique({ where: { userId }, select: { id: true } });
        if (!admin)
            throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.FORBIDDEN, 403);
        return { role, userId, patientId };
    }
    const doctorId = await resolveDoctorId(req);
    if (!doctorId)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.FORBIDDEN, 403);
    const link = await database_1.default.doctorPatient.findFirst({
        where: { doctorId, patientId },
        select: { id: true },
    });
    if (!link)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.FORBIDDEN, 403);
    return { role, userId, doctorId, patientId };
}
async function assertReportAccess(req, reportId) {
    const report = await database_1.default.labReport.findUnique({
        where: { id: reportId },
        include: { results: true },
    });
    if (!report)
        throw new error_utils_1.AppError(lab_constants_1.LAB_ERRORS.REPORT_NOT_FOUND, 404);
    await assertPatientAccess(req, report.patientId);
    return report;
}
