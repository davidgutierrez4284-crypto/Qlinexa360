"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseShareConsentPdfService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const file_utils_1 = require("../utils/file.utils");
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
class CaseShareConsentPdfService {
    static async generatePdfBuffer(data) {
        const templatePath = path_1.default.join(__dirname, '../templates/case-share-consent-template.html');
        const templateContent = fs_1.default.readFileSync(templatePath, 'utf-8');
        const template = handlebars_1.default.compile(templateContent);
        const html = template(data);
        const buffer = await this.htmlToPdf(html);
        const hash = crypto_1.default.createHash('sha256').update(buffer).digest('hex');
        return { buffer, hash };
    }
    static async generateAndUpload(inviteId, data) {
        const { buffer, hash } = await this.generatePdfBuffer(data);
        const fileName = `case_share_consent_${inviteId}_${Date.now()}.pdf`;
        let url;
        if (BUCKET_NAME) {
            const { url: s3Url } = await (0, file_utils_1.uploadBufferToS3)(buffer, 'case_share_consents', fileName, 'application/pdf');
            url = s3Url;
        }
        else {
            const dir = path_1.default.join(__dirname, '../../uploads/case_share_consents');
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            const filePath = path_1.default.join(dir, fileName);
            fs_1.default.writeFileSync(filePath, buffer);
            url = filePath;
        }
        return { url, hash, buffer };
    }
    static async htmlToPdf(html) {
        let browser;
        try {
            const launchOptions = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
            };
            if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
            }
            browser = await puppeteer_1.default.launch(launchOptions);
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
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
exports.CaseShareConsentPdfService = CaseShareConsentPdfService;
