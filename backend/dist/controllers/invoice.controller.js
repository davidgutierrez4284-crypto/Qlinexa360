"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInvoiceByEmail = exports.deleteInvoice = exports.getInvoices = exports.uploadInvoice = void 0;
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const notification_service_1 = require("../services/notification.service");
const logger_utils_1 = require("../utils/logger.utils");
const error_utils_1 = require("../utils/error.utils");
const prisma = new client_1.PrismaClient();
const resolveDoctorId = async (req) => {
    if (!req.user) {
        throw new error_utils_1.AppError('Autenticación requerida', 401);
    }
    if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
        if (!doctor) {
            throw new error_utils_1.AppError('Perfil de doctor no encontrado', 404);
        }
        return doctor.id;
    }
    if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
            throw new error_utils_1.AppError('Doctor seleccionado requerido', 400);
        }
        const link = await prisma.asistenteDoctorVinculo.findFirst({
            where: {
                doctorId: selectedDoctorId,
                asistenteId: req.user.userId,
                activo: true
            }
        });
        if (!link) {
            throw new error_utils_1.AppError('Asistente no vinculado a este doctor', 403);
        }
        return selectedDoctorId;
    }
    throw new error_utils_1.AppError('No autorizado', 403);
};
// Subir factura (PDF + XML) asociada a un paciente
const uploadInvoice = async (req, res) => {
    try {
        const { patientId, patientName, patientLastName, patientRFC, invoiceDate } = req.body;
        const doctorId = await resolveDoctorId(req);
        if (!patientId || !patientName || !patientLastName || !patientRFC || !invoiceDate) {
            return res.status(400).json({ message: 'Faltan datos obligatorios' });
        }
        const doctorPatient = await prisma.doctorPatient.findFirst({
            where: { doctorId, patientId }
        });
        if (!doctorPatient) {
            return res.status(403).json({ message: 'Paciente no asociado a este doctor' });
        }
        if (!req.files || !req.files.pdf || !req.files.xml) {
            return res.status(400).json({ message: 'Se requieren ambos archivos: PDF y XML' });
        }
        const pdfFile = req.files.pdf[0];
        const xmlFile = req.files.xml[0];
        // Guardar archivos localmente (puedes adaptar a S3 si lo usas)
        const uploadsDir = path_1.default.join(__dirname, '../../uploads/invoices');
        if (!fs_1.default.existsSync(uploadsDir))
            fs_1.default.mkdirSync(uploadsDir, { recursive: true });
        const pdfPath = path_1.default.join(uploadsDir, `${Date.now()}-${pdfFile.originalname}`);
        const xmlPath = path_1.default.join(uploadsDir, `${Date.now()}-${xmlFile.originalname}`);
        fs_1.default.writeFileSync(pdfPath, pdfFile.buffer);
        fs_1.default.writeFileSync(xmlPath, xmlFile.buffer);
        const pdfUrl = `/uploads/invoices/${path_1.default.basename(pdfPath)}`;
        const xmlUrl = `/uploads/invoices/${path_1.default.basename(xmlPath)}`;
        const invoice = await prisma.invoice.create({
            data: {
                doctorId,
                patientId,
                patientName,
                patientLastName,
                patientRFC,
                invoiceDate: new Date(invoiceDate),
                pdfUrl,
                xmlUrl
            }
        });
        res.status(201).json(invoice);
    }
    catch (error) {
        console.error('Error al subir factura:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al subir factura', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.uploadInvoice = uploadInvoice;
// Obtener facturas (doctor ve todas, paciente solo las suyas)
const getInvoices = async (req, res) => {
    var _a, _b, _c;
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida', 401);
        }
        const user = req.user;
        console.log('=== getInvoices DEBUG ===');
        console.log('User from token:', user);
        console.log('User role:', user.role);
        console.log('User userId:', user.userId);
        let where = {};
        if (((_a = user.role) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'DOCTOR' || ((_b = user.role) === null || _b === void 0 ? void 0 : _b.toUpperCase()) === 'ASISTENTE') {
            const doctorId = await resolveDoctorId(req);
            where.doctorId = doctorId;
            console.log('Filtering by doctorId:', where.doctorId);
        }
        else if (((_c = user.role) === null || _c === void 0 ? void 0 : _c.toUpperCase()) === 'PATIENT') {
            // Obtener el patientId desde la base de datos usando el userId del token
            console.log('Looking for patient with userId:', user.userId);
            const patient = await prisma.patient.findUnique({
                where: { userId: user.userId }
            });
            console.log('Patient found:', patient ? { id: patient.id, userId: patient.userId } : 'NOT FOUND');
            if (!patient) {
                console.error('Patient profile not found for userId:', user.userId);
                return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
            }
            where.patientId = patient.id;
            console.log('Filtering invoices by patientId:', where.patientId);
        }
        else {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const invoices = await prisma.invoice.findMany({
            where,
            orderBy: { invoiceDate: 'desc' }
        });
        console.log('Invoices found:', invoices.length);
        console.log('Invoices:', invoices.map(inv => ({ id: inv.id, patientId: inv.patientId, invoiceDate: inv.invoiceDate })));
        res.json(invoices);
    }
    catch (error) {
        console.error('Error al obtener facturas:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al obtener facturas', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.getInvoices = getInvoices;
// Eliminar factura (solo doctor dueño)
const deleteInvoice = async (req, res) => {
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida', 401);
        }
        const { id } = req.params;
        const user = req.user;
        const invoice = await prisma.invoice.findUnique({ where: { id } });
        if (!invoice)
            return res.status(404).json({ message: 'Factura no encontrada' });
        // Verificar que el doctor sea el dueño de la factura
        const doctorId = (user === null || user === void 0 ? void 0 : user.role) === 'PATIENT' ? null : await resolveDoctorId(req);
        if (!doctorId || doctorId !== invoice.doctorId) {
            return res.status(403).json({ message: 'No tienes permiso para eliminar esta factura' });
        }
        // Elimina archivos locales (opcional)
        try {
            if (invoice.pdfUrl && invoice.pdfUrl.startsWith('/uploads/')) {
                fs_1.default.unlinkSync(path_1.default.join(__dirname, '../../', invoice.pdfUrl));
            }
            if (invoice.xmlUrl && invoice.xmlUrl.startsWith('/uploads/')) {
                fs_1.default.unlinkSync(path_1.default.join(__dirname, '../../', invoice.xmlUrl));
            }
        }
        catch (e) {
            console.log('Error al eliminar archivos locales:', e);
            // Continuar aunque falle la eliminación de archivos
        }
        await prisma.invoice.delete({ where: { id } });
        res.json({ message: 'Factura eliminada' });
    }
    catch (error) {
        console.error('Error al eliminar factura:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error al eliminar factura', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};
exports.deleteInvoice = deleteInvoice;
// Enviar factura por email al paciente
const sendInvoiceByEmail = async (req, res) => {
    var _a, _b, _c, _d, _e;
    try {
        if (!req.user) {
            throw new error_utils_1.AppError('Autenticación requerida', 401);
        }
        const { id } = req.params; // invoice id
        const user = req.user;
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                patient: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        user: {
                            select: {
                                email: true
                            }
                        }
                    }
                },
                doctor: {
                    select: {
                        id: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Factura no encontrada' });
        }
        // Verificar que el doctor sea el dueño de la factura
        const doctorId = (user === null || user === void 0 ? void 0 : user.role) === 'PATIENT' ? null : await resolveDoctorId(req);
        if (!doctorId || doctorId !== invoice.doctorId) {
            return res.status(403).json({ success: false, message: 'No tienes permiso para enviar esta factura' });
        }
        // Obtener email del paciente (del Patient o del User)
        const patientEmail = invoice.patient.email || ((_a = invoice.patient.user) === null || _a === void 0 ? void 0 : _a.email);
        if (!patientEmail) {
            return res.status(400).json({ success: false, message: 'El paciente no tiene email registrado' });
        }
        // Formatear fecha de factura
        const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        // Construir rutas completas de los archivos
        const pdfPath = invoice.pdfUrl.startsWith('/uploads/')
            ? path_1.default.join(__dirname, '../../', invoice.pdfUrl)
            : invoice.pdfUrl;
        const xmlPath = invoice.xmlUrl.startsWith('/uploads/')
            ? path_1.default.join(__dirname, '../../', invoice.xmlUrl)
            : invoice.xmlUrl;
        // Verificar que los archivos existan
        if (!fs_1.default.existsSync(pdfPath)) {
            return res.status(404).json({ success: false, message: 'El archivo PDF no se encuentra en el servidor' });
        }
        if (!fs_1.default.existsSync(xmlPath)) {
            return res.status(404).json({ success: false, message: 'El archivo XML no se encuentra en el servidor' });
        }
        // Enviar correo con archivos adjuntos
        const notificationService = notification_service_1.NotificationService.getInstance();
        const sent = await notificationService.sendInvoiceToPatientEmail({
            toEmail: patientEmail,
            patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
            doctorName: `${((_c = (_b = invoice.doctor) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.firstName) || ''} ${((_e = (_d = invoice.doctor) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.lastName) || ''}`.trim(),
            invoiceDate,
            pdfPath,
            xmlPath
        });
        if (!sent) {
            return res.status(500).json({ success: false, message: 'No se pudo enviar el correo' });
        }
        return res.json({ success: true, message: 'Factura enviada al paciente por correo' });
    }
    catch (error) {
        logger_utils_1.securityLogger.error('Error al enviar factura por email:', error);
        const handled = error instanceof error_utils_1.AppError ? error : new error_utils_1.AppError('Error interno del servidor', 500);
        res.status(handled.statusCode).json({ success: false, message: handled.message });
    }
};
exports.sendInvoiceByEmail = sendInvoiceByEmail;
