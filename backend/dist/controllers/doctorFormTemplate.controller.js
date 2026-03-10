"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorFormDataForCharts = exports.saveDoctorFormData = exports.deleteDoctorTemplate = exports.updateDoctorTemplate = exports.createDoctorTemplate = exports.getDoctorTemplates = void 0;
const database_1 = __importDefault(require("../config/database"));
const error_utils_1 = require("../utils/error.utils");
/**
 * Obtener plantillas personalizadas del doctor autenticado
 */
const getDoctorTemplates = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        const doctor = await database_1.default.doctor.findUnique({ where: { userId: user.userId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const templates = await database_1.default.doctorFormTemplate.findMany({
            where: { doctorId: doctor.id },
            include: {
                fields: { orderBy: { position: 'asc' } },
            },
        });
        res.status(200).json(templates);
    }
    catch (error) {
        console.error('Error al obtener plantillas del doctor:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener plantillas.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getDoctorTemplates = getDoctorTemplates;
/**
 * Crear plantilla personalizada
 */
const createDoctorTemplate = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        const doctor = await database_1.default.doctor.findUnique({ where: { userId: user.userId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { name, fields } = req.body;
        if (!name || !name.trim())
            throw new error_utils_1.AppError('El nombre es requerido.', 400);
        const maxNumeric = 10;
        const maxText = 10;
        const numericFields = (fields || []).filter((f) => f.fieldType === 'numeric').slice(0, maxNumeric);
        const textFields = (fields || []).filter((f) => f.fieldType === 'text').slice(0, maxText);
        const allFields = [...numericFields, ...textFields];
        if (allFields.length === 0)
            throw new error_utils_1.AppError('Debe al menos un campo.', 400);
        const template = await database_1.default.doctorFormTemplate.create({
            data: {
                doctorId: doctor.id,
                name: name.trim(),
                fields: {
                    create: allFields.map((f, idx) => ({
                        fieldType: f.fieldType,
                        label: (f.label || `Campo ${idx + 1}`).trim(),
                        position: idx + 1,
                    })),
                },
            },
            include: { fields: { orderBy: { position: 'asc' } } },
        });
        res.status(201).json(template);
    }
    catch (error) {
        console.error('Error al crear plantilla:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al crear plantilla.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.createDoctorTemplate = createDoctorTemplate;
/**
 * Actualizar plantilla personalizada
 */
const updateDoctorTemplate = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        const doctor = await database_1.default.doctor.findUnique({ where: { userId: user.userId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { id } = req.params;
        const { name, fields } = req.body;
        const existing = await database_1.default.doctorFormTemplate.findFirst({
            where: { id, doctorId: doctor.id },
            include: { fields: true },
        });
        if (!existing)
            throw new error_utils_1.AppError('Plantilla no encontrada.', 404);
        if (fields) {
            await database_1.default.doctorFormTemplateField.deleteMany({ where: { templateId: id } });
            const maxNumeric = 10;
            const maxText = 10;
            const numericFields = fields.filter((f) => f.fieldType === 'numeric').slice(0, maxNumeric);
            const textFields = fields.filter((f) => f.fieldType === 'text').slice(0, maxText);
            const allFields = [...numericFields, ...textFields];
            await database_1.default.doctorFormTemplateField.createMany({
                data: allFields.map((f, idx) => ({
                    templateId: id,
                    fieldType: f.fieldType,
                    label: (f.label || `Campo ${idx + 1}`).trim(),
                    position: idx + 1,
                })),
            });
        }
        const template = await database_1.default.doctorFormTemplate.update({
            where: { id },
            data: name !== undefined ? { name: name.trim() } : {},
            include: { fields: { orderBy: { position: 'asc' } } },
        });
        res.status(200).json(template);
    }
    catch (error) {
        console.error('Error al actualizar plantilla:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al actualizar plantilla.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.updateDoctorTemplate = updateDoctorTemplate;
/**
 * Eliminar plantilla personalizada
 */
const deleteDoctorTemplate = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        const doctor = await database_1.default.doctor.findUnique({ where: { userId: user.userId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { id } = req.params;
        const existing = await database_1.default.doctorFormTemplate.findFirst({
            where: { id, doctorId: doctor.id },
        });
        if (!existing)
            throw new error_utils_1.AppError('Plantilla no encontrada.', 404);
        await database_1.default.doctorFormTemplate.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        console.error('Error al eliminar plantilla:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al eliminar plantilla.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.deleteDoctorTemplate = deleteDoctorTemplate;
/**
 * Guardar datos de formulario personalizado
 */
const saveDoctorFormData = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        const doctor = await database_1.default.doctor.findUnique({ where: { userId: user.userId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { medicalRecordId, templateId, patientId, data } = req.body;
        if (!medicalRecordId || !templateId || !patientId || !data) {
            throw new error_utils_1.AppError('Faltan campos requeridos.', 400);
        }
        const template = await database_1.default.doctorFormTemplate.findFirst({
            where: { id: templateId, doctorId: doctor.id },
        });
        if (!template)
            throw new error_utils_1.AppError('Plantilla no encontrada.', 404);
        const existing = await database_1.default.doctorFormData.findFirst({
            where: { medicalRecordId, templateId },
        });
        const payload = {
            medicalRecordId,
            templateId,
            patientId,
            doctorId: doctor.id,
            data: data,
        };
        // Upsert: crear o actualizar
        const result = existing
            ? await database_1.default.doctorFormData.update({
                where: { id: existing.id },
                data: payload,
            })
            : await database_1.default.doctorFormData.create({
                data: payload,
            });
        res.status(200).json(result);
    }
    catch (error) {
        console.error('Error al guardar datos:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al guardar datos.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.saveDoctorFormData = saveDoctorFormData;
/**
 * Obtener datos de formulario para gráficas (por paciente y template)
 */
const getDoctorFormDataForCharts = async (req, res) => {
    try {
        const user = req.user;
        if (!user)
            throw new error_utils_1.AppError('Autenticación requerida.', 401);
        const doctor = await database_1.default.doctor.findUnique({ where: { userId: user.userId } });
        if (!doctor)
            throw new error_utils_1.AppError('Perfil de doctor no encontrado.', 404);
        const { patientId, templateId } = req.query;
        if (!patientId || !templateId) {
            throw new error_utils_1.AppError('patientId y templateId son requeridos.', 400);
        }
        const template = await database_1.default.doctorFormTemplate.findFirst({
            where: { id: templateId, doctorId: doctor.id },
            include: { fields: true },
        });
        if (!template)
            throw new error_utils_1.AppError('Plantilla no encontrada.', 404);
        const records = await database_1.default.doctorFormData.findMany({
            where: { patientId, templateId, doctorId: doctor.id },
            orderBy: { createdAt: 'asc' },
        });
        res.status(200).json(records);
    }
    catch (error) {
        console.error('Error al obtener datos para gráficas:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener datos.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getDoctorFormDataForCharts = getDoctorFormDataForCharts;
