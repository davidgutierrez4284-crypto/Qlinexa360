"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVisibleDoctorPatientIdsForPatient = getVisibleDoctorPatientIdsForPatient;
exports.patientHasClinicalHistoryPortalAccess = patientHasClinicalHistoryPortalAccess;
exports.parseClinicalHistoryVisibleFlag = parseClinicalHistoryVisibleFlag;
const database_1 = __importDefault(require("../config/database"));
async function getVisibleDoctorPatientIdsForPatient(patientId) {
    const links = await database_1.default.doctorPatient.findMany({
        where: { patientId, clinicalHistoryVisibleToPatient: true },
        select: { id: true },
    });
    return links.map((l) => l.id);
}
async function patientHasClinicalHistoryPortalAccess(patientId) {
    const count = await database_1.default.doctorPatient.count({
        where: { patientId, clinicalHistoryVisibleToPatient: true },
    });
    return count > 0;
}
function parseClinicalHistoryVisibleFlag(raw) {
    if (raw === undefined || raw === null || raw === '')
        return undefined;
    if (typeof raw === 'boolean')
        return raw;
    if (raw === 'true' || raw === '1')
        return true;
    if (raw === 'false' || raw === '0')
        return false;
    return undefined;
}
