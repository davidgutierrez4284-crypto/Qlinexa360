"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentPdfService = exports.CONSENT_CONTENT = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const privacyPolicyPdfHtml_1 = require("../legal/privacyPolicyPdfHtml");
const referralProgramTermsPdfHtml_1 = require("../legal/referralProgramTermsPdfHtml");
const mercadoPagoTermsPdfHtml_1 = require("../legal/mercadoPagoTermsPdfHtml");
const file_utils_1 = require("../utils/file.utils");
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
// Contenido de documentos (alineado con la web pública y formularios de registro)
exports.CONSENT_CONTENT = {
    PRIVACY_POLICY: {
        title: 'Aviso de Privacidad',
        content: privacyPolicyPdfHtml_1.PRIVACY_POLICY_PDF_HTML
    },
    TERMS_OF_SERVICE: {
        title: 'Términos de Uso',
        content: `
      <p><b>1. Aceptación del usuario:</b> Al registrarse y utilizar la plataforma Qlinexa360, el usuario acepta los presentes Términos de Uso, que regulan el acceso y uso de la plataforma web y móvil.</p>
      <p><b>2. Definiciones:</b> Plataforma: Sistema digital ofrecido por Qlinexa360. Profesional de la Salud: Usuario médico que gestiona pacientes. Paciente: Usuario que accede o es registrado con fines de consulta y seguimiento clínico.</p>
      <p><b>3. Uso permitido:</b> El uso está limitado a la consulta, registro, edición y gestión de información médica, conforme a la legislación sanitaria aplicable en México.</p>
      <p><b>4. Registro y veracidad de información:</b> El usuario se compromete a proporcionar información verdadera, completa y actualizada. Qlinexa360 se reserva el derecho de suspender cuentas que incumplan esta disposición.</p>
      <p><b>5. Responsabilidades del usuario:</b> Mantener la confidencialidad de su acceso. Usar los datos de manera ética y legal. Informar a sus profesionales de la salud sobre el uso de sus datos personales.</p>
      <p><b>6. Propiedad intelectual:</b> Todos los contenidos, diseños y elementos visuales son propiedad exclusiva de Qlinexa360 y no podrán ser reproducidos sin autorización.</p>
      <p><b>7. Suspensión y cancelación:</b> La plataforma podrá suspender el acceso a usuarios que no cumplan los presentes términos o usen la plataforma de forma inapropiada.</p>
      <p><b>8. Limitación de responsabilidad:</b> Qlinexa360 no se hace responsable de diagnósticos clínicos ni consecuencias médicas derivadas del uso de la información registrada por los usuarios.</p>
      ${referralProgramTermsPdfHtml_1.REFERRAL_PROGRAM_TERMS_PDF_HTML}
      ${mercadoPagoTermsPdfHtml_1.MERCADOPAGO_TERMS_PDF_HTML}
      <p><b>Naturaleza de la plataforma:</b> Qlinexa360 no presta servicios médicos, no realiza diagnósticos ni prescribe tratamientos. La plataforma actúa únicamente como intermediario tecnológico para la gestión de información clínica. Qlinexa360 es una plataforma tecnológica de gestión clínica. Las recetas, consultas, citas y seguimiento son emitidas exclusivamente por el profesional de la salud que la suscribe, quien es el único responsable del diagnóstico, tratamiento y prescripción.</p>
      <p>Qlinexa360 es una plataforma tecnológica de apoyo a la gestión clínica. No actúa como establecimiento médico, no sustituye el juicio profesional y no se ostenta como sistema certificado o autorizado por autoridad sanitaria salvo que expresamente se indique con el documento oficial correspondiente.</p>
      <p><b>11. Modificaciones:</b> Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.</p>
      <p><b>12. Legislación aplicable:</b> Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.</p>
      <p><b>Cláusula de Comunicación:</b> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud. Contactos: legal@qlinexa360.com , admin@qlinexa360.com</p>
    `
    },
    PLATFORM_CONTRACT: {
        title: 'Contrato de Uso de Plataforma',
        content: `
      <p><b>Contrato de Uso y Responsabilidad - Plataforma Qlinexa360</b></p>
      <p><b>1. Objeto:</b> Este contrato establece las condiciones legales de uso de la plataforma Qlinexa360, la cual permite el registro, almacenamiento, consulta y gestión de información médica de pacientes.</p>
      <p><b>2. Acceso y uso:</b> El paciente tendrá acceso a su información médica personal y podrá compartirla con los profesionales de la salud autorizados dentro de la plataforma.</p>
      <p><b>3. Conservación de datos:</b> La Plataforma se obliga a conservar los expedientes clínicos conforme a la NOM-004-SSA3-2012, por un mínimo de 5 años desde el último acto médico registrado.</p>
      <p><b>4. Protección de datos personales:</b> La información del paciente está protegida bajo la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). Los datos se almacenan de forma cifrada y solo el profesional de la salud autorizado y el paciente acceden a ellos.</p>
      <p><b>5. Consentimiento informado:</b> El paciente deberá aceptar el presente contrato y firmar de forma digital, registrando nombre completo, fecha y hora (timestamp). Este consentimiento forma parte del proceso de registro.</p>
      <p><b>6. Responsabilidad del paciente:</b> El paciente es responsable de proporcionar información médica veraz, mantener la confidencialidad de su acceso y usar la plataforma de manera ética y conforme a la ley.</p>
      <p><b>7. Comunicación médica:</b> La plataforma facilita la comunicación entre pacientes y profesionales de la salud, pero no sustituye la consulta médica presencial cuando sea necesaria.</p>
      <p><b>Naturaleza de la plataforma:</b> Qlinexa360 no presta servicios médicos, no realiza diagnósticos ni prescribe tratamientos. La plataforma actúa únicamente como intermediario tecnológico para la gestión de información clínica. Qlinexa360 es una plataforma tecnológica de gestión clínica. Las recetas, consultas, citas y seguimiento son emitidas exclusivamente por el profesional de la salud que la suscribe, quien es el único responsable del diagnóstico, tratamiento y prescripción.</p>
      <p>Qlinexa360 es una plataforma tecnológica de apoyo a la gestión clínica. No actúa como establecimiento médico, no sustituye el juicio profesional y no se ostenta como sistema certificado o autorizado por autoridad sanitaria salvo que expresamente se indique con el documento oficial correspondiente.</p>
      ${mercadoPagoTermsPdfHtml_1.MERCADOPAGO_CONTRACT_PDF_HTML}
      <p><b>9. Modificaciones:</b> Este contrato podrá modificarse y se notificarán los cambios a los usuarios registrados. El uso continuo implicará su aceptación.</p>
      <p><b>10. Legislación aplicable:</b> Este contrato se rige conforme a las leyes mexicanas aplicables.</p>
      <p><b>Cláusula de Comunicación:</b> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud. Contactos: legal@qlinexa360.com , admin@qlinexa360.com</p>
    `
    }
};
class ConsentPdfService {
    /**
     * Genera los 3 PDFs de consentimiento y retorna URLs y buffers (para adjuntar en emails)
     */
    static async generateConsentPdfs(params) {
        const { userId, email, fullName, phone, signature, role, ipAddress, signedAt } = params;
        const signedAtDate = signedAt !== null && signedAt !== void 0 ? signedAt : new Date();
        const timestamp = signedAtDate.toLocaleString('es-MX', {
            dateStyle: 'long',
            timeStyle: 'medium'
        });
        const isoTimestamp = signedAtDate.toISOString();
        const results = {};
        for (const [type, doc] of Object.entries(exports.CONSENT_CONTENT)) {
            const html = await this.generateHtml({
                title: doc.title,
                content: doc.content,
                signature,
                fullName,
                email,
                phone: (phone === null || phone === void 0 ? void 0 : phone.trim()) || 'No indicado',
                role,
                timestamp,
                isoTimestamp,
                ipAddress
            });
            const pdfBuffer = await this.generatePdf(html);
            const fileName = `consent_${type.toLowerCase()}_${userId}_${Date.now()}.pdf`;
            let url;
            if (BUCKET_NAME) {
                const uploadResult = await (0, file_utils_1.uploadBufferToS3)(Buffer.from(pdfBuffer), 'consent_documents', fileName, 'application/pdf');
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
            results[type] = { url, buffer: pdfBuffer };
        }
        return results;
    }
    static async generateHtml(data) {
        const templatePath = path_1.default.join(__dirname, '../templates/consent-document-template.html');
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
                margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
                printBackground: true
            });
            return Buffer.from(pdfBuffer);
        }
        catch (error) {
            console.error('Error generando PDF de consentimiento:', error);
            throw error;
        }
        finally {
            if (browser)
                await browser.close();
        }
    }
}
exports.ConsentPdfService = ConsentPdfService;
