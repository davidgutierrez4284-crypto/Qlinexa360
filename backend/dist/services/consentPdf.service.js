"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentPdfService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const file_utils_1 = require("../utils/file.utils");
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
// Contenido de documentos (mismo que RegisterDoctor - documentos iguales para todos)
const CONSENT_CONTENT = {
    PRIVACY_POLICY: {
        title: 'Aviso de Privacidad',
        content: `
      <p><b>AVISO DE PRIVACIDAD INTEGRAL - Qlinexa360</b></p>
      <p><b>1. Responsable del Tratamiento:</b> Qlinexa360, plataforma digital de gestión médica, es responsable del tratamiento de sus datos personales.</p>
      <p><b>2. Finalidades del Tratamiento:</b> Sus datos personales serán utilizados para: (a) Gestionar su registro en la plataforma; (b) Facilitar la comunicación entre profesionales de la salud y pacientes; (c) Mantener su historial clínico digital; (d) Enviar notificaciones relacionadas con su atención médica; (e) Cumplir con obligaciones legales y regulatorias.</p>
      <p><b>3. Datos Personales Recopilados:</b> Recopilamos: (a) Datos de identificación (nombre, email, teléfono); (b) Datos médicos (historial clínico, diagnósticos, tratamientos); (c) Datos de contacto de emergencia; (d) Datos fiscales (cuando aplique); (e) Datos de seguro médico (cuando aplique).</p>
      <p><b>4. Transferencias:</b> Sus datos pueden ser transferidos a: (a) Profesionales de la salud autorizados; (b) Autoridades sanitarias cuando sea requerido por ley; (c) Proveedores de servicios tecnológicos que nos apoyan en la operación de la plataforma.</p>
      <p><b>5. Medidas de Seguridad:</b> Implementamos medidas técnicas, administrativas y físicas para proteger sus datos personales, incluyendo encriptación de datos, acceso restringido y auditorías regulares de seguridad.</p>
      <p><b>6. Derechos ARCO:</b> Usted tiene derecho a: (a) Acceder a sus datos personales; (b) Rectificar sus datos cuando sean inexactos; (c) Cancelar el uso de sus datos; (d) Oponerse al tratamiento de sus datos para fines específicos.</p>
      <p><b>7. Revocación del Consentimiento:</b> Puede revocar su consentimiento en cualquier momento, sin embargo, esto puede limitar la funcionalidad de la plataforma.</p>
      <p><b>8. Conservación de Datos:</b> Sus datos se conservarán conforme a la normativa sanitaria mexicana (NOM-004-SSA3-2012) por un mínimo de 5 años desde el último acto médico.</p>
      <p><b>9. Cambios al Aviso:</b> Nos reservamos el derecho de modificar este aviso. Los cambios serán notificados a través de la plataforma.</p>
      <p><b>10. Contacto:</b> Para ejercer sus derechos ARCO o realizar consultas sobre este aviso, puede contactarnos a través de la plataforma o al correo electrónico de soporte.</p>
    `
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
      <p><b>9. Modificaciones:</b> Los términos podrán modificarse y se notificarán a los usuarios registrados. El uso continuo implicará su aceptación.</p>
      <p><b>10. Legislación aplicable:</b> Este documento se rige conforme a las leyes mexicanas, incluyendo la LFPDPPP y la NOM-004-SSA3-2012.</p>
      <p><b>Cláusula de Comunicación:</b> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.</p>
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
      <p><b>8. Modificaciones:</b> Este contrato podrá modificarse y se notificarán los cambios a los usuarios registrados. El uso continuo implicará su aceptación.</p>
      <p><b>9. Legislación aplicable:</b> Este contrato se rige conforme a las leyes mexicanas aplicables.</p>
      <p><b>Cláusula de Comunicación:</b> El usuario acepta recibir comunicación a través de correo electrónico, WhatsApp y a través de la misma plataforma Qlinexa360 en la sesión de usuario registrado; acepta que esta comunicación es profesional y enfocada a fomentar una buena atención Clínica y responsable entre Profesionales de la Salud, Pacientes y Asistentes de Profesionales de la Salud.</p>
    `
    }
};
class ConsentPdfService {
    /**
     * Genera los 3 PDFs de consentimiento y retorna URLs y buffers (para adjuntar en emails)
     */
    static async generateConsentPdfs(params) {
        const { userId, email, fullName, signature } = params;
        const timestamp = new Date().toLocaleString('es-MX', {
            dateStyle: 'long',
            timeStyle: 'medium'
        });
        const results = {};
        for (const [type, doc] of Object.entries(CONSENT_CONTENT)) {
            const html = await this.generateHtml({
                title: doc.title,
                content: doc.content,
                signature,
                fullName,
                email,
                timestamp
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
