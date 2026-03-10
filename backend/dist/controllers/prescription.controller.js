"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePdfFromTemplate = exports.getPrescriptionsByMedicalRecord = exports.createPrescription = exports.deletePrescriptionTemplate = exports.updatePrescriptionTemplate = exports.createPrescriptionTemplate = exports.getPrescriptionTemplates = void 0;
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
// CRUD para PrescriptionTemplate
const getPrescriptionTemplates = async (req, res) => {
    var _a;
    console.log('getPrescriptionTemplates called');
    console.log('User from token:', req.user);
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    console.log('userId:', userId);
    const doctor = await database_1.default.doctor.findUnique({
        where: { userId },
        include: { user: true }
    });
    console.log('Doctor found:', doctor ? `${doctor.user.firstName} ${doctor.user.lastName}` : 'Not found');
    if (!doctor)
        return res.status(404).json({ message: 'Doctor no encontrado' });
    const templates = await database_1.default.prescriptionTemplate.findMany({ where: { doctorId: doctor.id } });
    console.log('Templates found:', templates.length);
    console.log('Templates:', templates);
    res.json(templates);
};
exports.getPrescriptionTemplates = getPrescriptionTemplates;
const createPrescriptionTemplate = async (req, res) => {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const doctor = await database_1.default.doctor.findUnique({ where: { userId } });
    if (!doctor)
        return res.status(404).json({ message: 'Doctor no encontrado' });
    const { name, content } = req.body;
    const template = await database_1.default.prescriptionTemplate.create({
        data: { doctorId: doctor.id, name, content }
    });
    res.status(201).json(template);
};
exports.createPrescriptionTemplate = createPrescriptionTemplate;
const updatePrescriptionTemplate = async (req, res) => {
    const { id } = req.params;
    const { name, content } = req.body;
    const template = await database_1.default.prescriptionTemplate.update({
        where: { id },
        data: { name, content }
    });
    res.json(template);
};
exports.updatePrescriptionTemplate = updatePrescriptionTemplate;
const deletePrescriptionTemplate = async (req, res) => {
    const { id } = req.params;
    await database_1.default.prescriptionTemplate.delete({ where: { id } });
    res.json({ message: 'Plantilla eliminada' });
};
exports.deletePrescriptionTemplate = deletePrescriptionTemplate;
// Asociar receta a consulta (crear Prescription)
const createPrescription = async (req, res) => {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
    const doctor = await database_1.default.doctor.findUnique({ where: { userId } });
    if (!doctor)
        return res.status(404).json({ message: 'Doctor no encontrado' });
    const { medicalRecordId } = req.params;
    const { patientId, fileId } = req.body;
    // fileId es el archivo PDF generado y subido previamente
    const prescription = await database_1.default.prescription.create({
        data: {
            medicalRecordId,
            doctorId: doctor.id,
            patientId,
            fileId
        }
    });
    res.status(201).json(prescription);
};
exports.createPrescription = createPrescription;
// Listar recetas asociadas a una consulta
const getPrescriptionsByMedicalRecord = async (req, res) => {
    const { medicalRecordId } = req.params;
    const prescriptions = await database_1.default.prescription.findMany({
        where: { medicalRecordId },
        include: { file: true }
    });
    res.json(prescriptions);
};
exports.getPrescriptionsByMedicalRecord = getPrescriptionsByMedicalRecord;
// Generar PDF desde plantilla (simple, texto plano) y registrar receta
const generatePdfFromTemplate = async (req, res) => {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const doctor = await database_1.default.doctor.findUnique({
            where: { userId },
            include: { user: true }
        });
        if (!doctor)
            return res.status(404).json({ message: 'Doctor no encontrado' });
        const { medicalRecordId } = req.params;
        const { patientId, templateId, variables } = req.body;
        const template = await database_1.default.prescriptionTemplate.findUnique({ where: { id: templateId } });
        if (!template)
            return res.status(404).json({ message: 'Plantilla no encontrada' });
        // Render muy simple: reemplazo de {{clave}} en el contenido
        const render = (content, vars) => content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => { var _a; return ((_a = vars[k]) !== null && _a !== void 0 ? _a : ''); });
        const rendered = render(template.content, variables || {});
        // Generación de PDF minimalista: envolver texto en HTML sencillo y usar Buffer
        const html = `<html><head><meta charset="utf-8" /></head><body>
      <h1 style="text-align:center;">Receta médica</h1>
      <p><strong>Médico:</strong> ${doctor.user.firstName} ${doctor.user.lastName}</p>
      <p><strong>Paciente:</strong> ${(variables === null || variables === void 0 ? void 0 : variables.patientName) || ''}</p>
      <hr/>
      <pre style="white-space:pre-wrap;font-family:ui-monospace;">${rendered}</pre>
    </body></html>`;
        // Por simplicidad, almacenamos como HTML en la tabla File con mimeType text/html.
        // En producción, se recomienda usar un servicio para render a PDF (puppeteer) y subir a S3.
        const file = await database_1.default.file.create({
            data: {
                id: (0, uuid_1.v4)(),
                url: '',
                fileName: `receta-${Date.now()}.html`,
                fileType: 'text/html',
                size: Buffer.byteLength(html, 'utf-8'),
                uploadedById: userId,
                doctorId: doctor.id,
                patientId
            }
        });
        // Guardar el HTML en la columna url como data URI para visualización rápida
        const dataUri = `data:text/html;base64,${Buffer.from(html, 'utf-8').toString('base64')}`;
        await database_1.default.file.update({ where: { id: file.id }, data: { url: dataUri } });
        const prescription = await database_1.default.prescription.create({
            data: {
                medicalRecordId,
                doctorId: doctor.id,
                patientId,
                fileId: file.id
            },
            include: { file: true }
        });
        res.status(201).json(prescription);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al generar receta' });
    }
};
exports.generatePdfFromTemplate = generatePdfFromTemplate;
