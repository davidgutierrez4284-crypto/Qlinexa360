"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClinicalIntakeConsentPdfService = void 0;
exports.mergeConsentFileIntoFormData = mergeConsentFileIntoFormData;
const puppeteer_1 = __importDefault(require("puppeteer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const client_1 = require("@prisma/client");
const consentPdf_service_1 = require("./consentPdf.service");
const file_utils_1 = require("../utils/file.utils");
const prisma = new client_1.PrismaClient();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
function mergeConsentFileIntoFormData(formData, file) {
    const fd = formData && typeof formData === 'object' && !Array.isArray(formData)
        ? Object.assign({}, formData) : {};
    const attachments = fd.attachments && typeof fd.attachments === 'object' && !Array.isArray(fd.attachments)
        ? Object.assign({}, fd.attachments) : {};
    const files = attachments.files && typeof attachments.files === 'object' && !Array.isArray(attachments.files)
        ? Object.assign({}, attachments.files) : {};
    const key = 'CONSENT_DOCUMENT';
    const list = Array.isArray(files[key]) ? [...files[key]] : [];
    list.push({
        url: file.url,
        fileName: file.fileName,
        type: file.type,
        size: file.size,
        fileId: file.fileId
    });
    files[key] = list;
    attachments.files = files;
    fd.attachments = attachments;
    return fd;
}
class ClinicalIntakeConsentPdfService {
    static async generateAndPersist(params) {
        var _a;
        const signedAt = (_a = params.signedAt) !== null && _a !== void 0 ? _a : new Date();
        const timestamp = signedAt.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'medium' });
        const isoTimestamp = signedAt.toISOString();
        const phone = String(params.phone || '').trim() || 'No indicado';
        const documents = Object.entries(consentPdf_service_1.CONSENT_CONTENT).map(([, doc]) => ({
            title: doc.title,
            content: doc.content
        }));
        const html = await this.generateHtml({
            documents,
            signature: params.signature,
            fullName: params.fullName,
            email: params.email,
            phone,
            timestamp,
            isoTimestamp,
            ipAddress: params.ipAddress || 'No registrada'
        });
        const pdfBuffer = await this.generatePdf(html);
        const hash = (0, crypto_1.createHash)('sha256').update(pdfBuffer).digest('hex');
        const fileName = `consentimientos_preconsulta_${params.intakeId}_${Date.now()}.pdf`;
        let url;
        if (BUCKET_NAME) {
            const uploadResult = await (0, file_utils_1.uploadBufferToS3)(pdfBuffer, 'consent_documents', fileName, 'application/pdf');
            url = uploadResult.url;
        }
        else {
            const uploadsDir = path_1.default.join(__dirname, '../../uploads/consent_documents');
            if (!fs_1.default.existsSync(uploadsDir)) {
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            }
            const filePath = path_1.default.join(uploadsDir, fileName);
            fs_1.default.writeFileSync(filePath, pdfBuffer);
            url = filePath;
        }
        const dbFile = await prisma.file.create({
            data: {
                fileName: 'Consentimientos_pre-consulta.pdf',
                fileType: 'application/pdf',
                size: pdfBuffer.length,
                url,
                category: client_1.FileCategory.CONSENT_DOCUMENT,
                uploadedById: params.uploadedByUserId,
                doctorId: params.doctorId,
                patientId: params.patientId || null,
                securityHash: hash
            }
        });
        return {
            fileId: dbFile.id,
            url,
            hash,
            fileName: dbFile.fileName,
            size: pdfBuffer.length
        };
    }
    static async generateHtml(data) {
        const templatePath = path_1.default.join(__dirname, '../templates/clinical-intake-consent-template.html');
        const templateContent = fs_1.default.readFileSync(templatePath, 'utf-8');
        const template = handlebars_1.default.compile(templateContent, { noEscape: true });
        return template(data);
    }
    static async generatePdf(html) {
        let browser;
        try {
            const launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer'
                ]
            };
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }
            browser = await puppeteer_1.default.launch(launchOptions);
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
                printBackground: true
            });
            return Buffer.from(pdfBuffer);
        }
        finally {
            if (browser)
                await browser.close();
        }
    }
}
exports.ClinicalIntakeConsentPdfService = ClinicalIntakeConsentPdfService;
