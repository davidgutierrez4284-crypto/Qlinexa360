"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichDoctorId = void 0;
const database_1 = __importDefault(require("../config/database"));
const enrichDoctorId = async (req, res, next) => {
    if (!req.user)
        return next();
    if (req.user.doctorId)
        return next();
    if (req.user.role !== 'DOCTOR')
        return next();
    try {
        const doctor = await database_1.default.doctor.findUnique({
            where: { userId: req.user.userId },
            select: { id: true }
        });
        if (doctor) {
            req.user.doctorId = doctor.id;
        }
    }
    catch (err) {
        console.error('[enrichDoctorId] Error:', err);
    }
    next();
};
exports.enrichDoctorId = enrichDoctorId;
