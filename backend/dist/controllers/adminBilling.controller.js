"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminBillingController = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = __importDefault(require("../config/database"));
const notification_service_1 = require("../services/notification.service");
const logger_utils_1 = require("../utils/logger.utils");
/**
 * Relación de facturación del ADMIN: Qlinexa factura la SUSCRIPCIÓN a los doctores
 * (los únicos usuarios de paga). Solo se factura cuando hay pago real; los meses
 * gratis/promoción se registran con importe 0 (sin archivos) para llevar la relación completa.
 */
const UPLOADS_SUBDIR = '../../uploads/subscription-invoices';
function fullPathFromUrl(url) {
    return url.startsWith('/uploads/') ? path_1.default.join(__dirname, '../../', url) : url;
}
function parseAmount(raw) {
    if (raw === undefined || raw === null || raw === '')
        return 0;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0)
        return null;
    return Math.round(n * 100) / 100;
}
class AdminBillingController {
    /** Lista de doctores (clientes de paga) con datos fiscales y estado de suscripción. */
    static async listDoctors(_req, res) {
        const doctors = await database_1.default.doctor.findMany({
            orderBy: { user: { firstName: 'asc' } },
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
                subscription: { select: { status: true, startDate: true, endDate: true } },
                _count: { select: { subscriptionInvoices: true } }
            }
        });
        const data = doctors.map((d) => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: d.id,
                firstName: ((_a = d.user) === null || _a === void 0 ? void 0 : _a.firstName) || '',
                lastName: ((_b = d.user) === null || _b === void 0 ? void 0 : _b.lastName) || '',
                email: ((_c = d.user) === null || _c === void 0 ? void 0 : _c.email) || '',
                specialization: d.specialization,
                licenseNumber: d.licenseNumber,
                tax: {
                    taxName: d.taxName || '',
                    taxId: d.taxId || '',
                    taxAddress: d.taxAddress || '',
                    taxPostalCode: d.taxPostalCode || '',
                    taxRegime: d.taxRegime || ''
                },
                subscriptionStatus: ((_d = d.subscription) === null || _d === void 0 ? void 0 : _d.status) || null,
                subscriptionStart: ((_e = d.subscription) === null || _e === void 0 ? void 0 : _e.startDate) || null,
                subscriptionEnd: ((_f = d.subscription) === null || _f === void 0 ? void 0 : _f.endDate) || null,
                invoicesCount: d._count.subscriptionInvoices
            });
        });
        return res.json({ success: true, data });
    }
    /** Actualiza los datos fiscales del doctor (receptor de la factura). */
    static async updateDoctorTax(req, res) {
        const { id } = req.params;
        const { taxName, taxId, taxAddress, taxPostalCode, taxRegime } = req.body;
        const doctor = await database_1.default.doctor.findUnique({ where: { id } });
        if (!doctor)
            return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
        const updated = await database_1.default.doctor.update({
            where: { id },
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (taxName !== undefined ? { taxName: taxName || '' } : {})), (taxId !== undefined ? { taxId: taxId || '' } : {})), (taxAddress !== undefined ? { taxAddress: taxAddress || '' } : {})), (taxPostalCode !== undefined ? { taxPostalCode: taxPostalCode || null } : {})), (taxRegime !== undefined ? { taxRegime: taxRegime || null } : {}))
        });
        return res.json({
            success: true,
            message: 'Datos fiscales actualizados',
            data: {
                taxName: updated.taxName || '',
                taxId: updated.taxId || '',
                taxAddress: updated.taxAddress || '',
                taxPostalCode: updated.taxPostalCode || '',
                taxRegime: updated.taxRegime || ''
            }
        });
    }
    /** Facturas de suscripción de un doctor. */
    static async getDoctorInvoices(req, res) {
        const { doctorId } = req.params;
        const invoices = await database_1.default.subscriptionInvoice.findMany({
            where: { doctorId },
            orderBy: { invoiceDate: 'desc' }
        });
        return res.json({
            success: true,
            data: invoices.map((i) => (Object.assign(Object.assign({}, i), { amount: Number(i.amount) })))
        });
    }
    /** Crea una factura de suscripción para un doctor (PDF/XML opcionales; importe 0 = mes sin cobro). */
    static async uploadInvoice(req, res) {
        var _a, _b, _c;
        try {
            const { doctorId, invoiceDate, currency, notes } = req.body;
            if (!doctorId || !invoiceDate) {
                return res.status(400).json({ success: false, message: 'Faltan datos: doctorId y fecha de factura' });
            }
            const amount = parseAmount(req.body.amount);
            if (amount === null) {
                return res.status(400).json({ success: false, message: 'El importe debe ser un número mayor o igual a 0' });
            }
            const doctor = await database_1.default.doctor.findUnique({ where: { id: doctorId } });
            if (!doctor) {
                return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
            }
            const files = req.files || {};
            const pdfFile = (_a = files.pdf) === null || _a === void 0 ? void 0 : _a[0];
            const xmlFile = (_b = files.xml) === null || _b === void 0 ? void 0 : _b[0];
            // Cuando hay cobro real (importe > 0) exigimos el PDF de la factura.
            if (amount > 0 && !pdfFile) {
                return res.status(400).json({ success: false, message: 'Sube el PDF de la factura cuando el importe es mayor a 0' });
            }
            let pdfUrl = null;
            let xmlUrl = null;
            if (pdfFile || xmlFile) {
                const uploadsDir = path_1.default.join(__dirname, UPLOADS_SUBDIR);
                if (!fs_1.default.existsSync(uploadsDir))
                    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                if (pdfFile) {
                    const pdfPath = path_1.default.join(uploadsDir, `${Date.now()}-${pdfFile.originalname}`);
                    fs_1.default.writeFileSync(pdfPath, pdfFile.buffer);
                    pdfUrl = `/uploads/subscription-invoices/${path_1.default.basename(pdfPath)}`;
                }
                if (xmlFile) {
                    const xmlPath = path_1.default.join(uploadsDir, `${Date.now()}-${xmlFile.originalname}`);
                    fs_1.default.writeFileSync(xmlPath, xmlFile.buffer);
                    xmlUrl = `/uploads/subscription-invoices/${path_1.default.basename(xmlPath)}`;
                }
            }
            const invoice = await database_1.default.subscriptionInvoice.create({
                data: {
                    doctorId,
                    invoiceDate: new Date(invoiceDate),
                    amount,
                    currency: (currency || 'MXN').toUpperCase(),
                    pdfUrl,
                    xmlUrl,
                    notes: notes || null,
                    createdByAdminUserId: ((_c = req.user) === null || _c === void 0 ? void 0 : _c.userId) || null
                }
            });
            return res.status(201).json({ success: true, data: Object.assign(Object.assign({}, invoice), { amount: Number(invoice.amount) }) });
        }
        catch (error) {
            console.error('Error al subir factura de suscripción:', error);
            return res.status(500).json({ success: false, message: 'Error al subir la factura' });
        }
    }
    /** Elimina una factura de suscripción y sus archivos. */
    static async deleteInvoice(req, res) {
        const { id } = req.params;
        const invoice = await database_1.default.subscriptionInvoice.findUnique({ where: { id } });
        if (!invoice)
            return res.status(404).json({ success: false, message: 'Factura no encontrada' });
        try {
            if (invoice.pdfUrl && invoice.pdfUrl.startsWith('/uploads/'))
                fs_1.default.unlinkSync(fullPathFromUrl(invoice.pdfUrl));
            if (invoice.xmlUrl && invoice.xmlUrl.startsWith('/uploads/'))
                fs_1.default.unlinkSync(fullPathFromUrl(invoice.xmlUrl));
        }
        catch (e) {
            console.log('No se pudieron borrar los archivos locales de la factura:', e);
        }
        await database_1.default.subscriptionInvoice.delete({ where: { id } });
        return res.json({ success: true, message: 'Factura eliminada' });
    }
    /** Envía la factura al doctor por correo, con PDF/XML adjuntos. */
    static async sendInvoiceEmail(req, res) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const { id } = req.params;
            const invoice = await database_1.default.subscriptionInvoice.findUnique({
                where: { id },
                include: {
                    doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } }
                }
            });
            if (!invoice)
                return res.status(404).json({ success: false, message: 'Factura no encontrada' });
            const toEmail = (_b = (_a = invoice.doctor) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.email;
            if (!toEmail)
                return res.status(400).json({ success: false, message: 'El doctor no tiene correo registrado' });
            if (!invoice.pdfUrl) {
                return res.status(400).json({ success: false, message: 'Sube primero el PDF de la factura para poder enviarla' });
            }
            const pdfPath = fullPathFromUrl(invoice.pdfUrl);
            if (!fs_1.default.existsSync(pdfPath)) {
                return res.status(404).json({ success: false, message: 'El archivo PDF no se encuentra en el servidor' });
            }
            const xmlPath = invoice.xmlUrl ? fullPathFromUrl(invoice.xmlUrl) : undefined;
            const invoiceDateLabel = new Date(invoice.invoiceDate).toLocaleDateString('es-MX', {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            const amountLabel = `$${Number(invoice.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency}`;
            const sent = await notification_service_1.NotificationService.getInstance().sendSubscriptionInvoiceToDoctorEmail({
                toEmail,
                doctorName: `${((_d = (_c = invoice.doctor) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.firstName) || ''} ${((_f = (_e = invoice.doctor) === null || _e === void 0 ? void 0 : _e.user) === null || _f === void 0 ? void 0 : _f.lastName) || ''}`.trim(),
                invoiceDate: invoiceDateLabel,
                amountLabel,
                pdfPath,
                xmlPath: xmlPath && fs_1.default.existsSync(xmlPath) ? xmlPath : undefined
            });
            if (!sent)
                return res.status(500).json({ success: false, message: 'No se pudo enviar el correo' });
            await database_1.default.subscriptionInvoice.update({ where: { id }, data: { sentAt: new Date() } });
            return res.json({ success: true, message: 'Factura enviada al doctor por correo' });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error al enviar factura de suscripción por email:', error);
            return res.status(500).json({ success: false, message: 'Error interno al enviar la factura' });
        }
    }
}
exports.AdminBillingController = AdminBillingController;
