"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecipePdfService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const qrcode_1 = __importDefault(require("qrcode"));
const handlebars_1 = __importDefault(require("handlebars"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const file_utils_1 = require("../utils/file.utils");
const prisma = new client_1.PrismaClient();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
class RecipePdfService {
    /**
     * Generar PDF de receta médica
     */
    static async generateRecipePdf(recipeId) {
        var _a, _b;
        try {
            // Obtener datos completos de la receta
            const recipe = await prisma.recetaMedica.findUnique({
                where: { id: recipeId },
                include: {
                    detalleMedicamentos: true,
                    estudiosSolicitados: true,
                    doctor: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true
                                }
                            }
                        }
                    },
                    paciente: {
                        include: {
                            user: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
            if (!recipe) {
                throw new Error('Receta no encontrada');
            }
            // Generar QR code con URL de verificación real
            const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
            const emissionDate = recipe.fechaEmision || new Date();
            const verificationUrl = `${baseUrl}/api/recipes/verify/${recipe.id}?hash=${this.generateProductionHash(recipe.id, recipe.doctorId, emissionDate)}`;
            const qrCode = await qrcode_1.default.toDataURL(verificationUrl);
            // Convertir logo a base64 si existe (soporta ruta local o URL S3/HTTP)
            let logoBase64 = null;
            if (recipe.doctor.logoUrl) {
                try {
                    const logoUrl = recipe.doctor.logoUrl;
                    let logoBuffer;
                    let mimeType;
                    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
                        // Logo en S3 o URL externa
                        const { buffer, contentType } = await (0, file_utils_1.fetchBufferFromUrl)(logoUrl);
                        logoBuffer = buffer;
                        mimeType = (contentType || 'image/png').split(';')[0].trim();
                    }
                    else {
                        // Ruta local (uploads/logos/...)
                        const logoPath = path_1.default.join(__dirname, '../../', logoUrl);
                        if (fs_1.default.existsSync(logoPath)) {
                            logoBuffer = fs_1.default.readFileSync(logoPath);
                            mimeType = this.getMimeType(logoPath);
                        }
                        else {
                            throw new Error(`Logo no encontrado: ${logoPath}`);
                        }
                    }
                    logoBase64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
                }
                catch (error) {
                    console.error('Error converting logo to base64:', error);
                }
            }
            // Preparar datos para el template
            const templateData = {
                doctor: {
                    firstName: recipe.doctor.user.firstName,
                    lastName: recipe.doctor.user.lastName,
                    professionalTitle: recipe.doctor.professionalTitle || 'Dr.',
                    specialization: recipe.doctor.specialization || 'Medicina General',
                    consultorioDireccion: recipe.doctor.consultorioDireccion || 'Dirección no especificada',
                    consultorioTelefono: recipe.doctor.consultorioTelefono || 'Teléfono no especificado',
                    certificadoProfesional: recipe.doctor.certificadoProfesional || 'No especificado',
                    certificadoEspecialidad: recipe.doctor.certificadoEspecialidad || 'No especificado',
                    certificadoMaestria: recipe.doctor.certificadoMaestria || 'No especificado',
                    universidad: recipe.doctor.universidad || null,
                    logoUrl: logoBase64,
                    primaryColor: recipe.doctor.primaryColor || '#2563eb',
                    secondaryColor: recipe.doctor.secondaryColor || '#1e40af',
                    socialMediaFacebook: recipe.doctor.socialMediaFacebook || null,
                    socialMediaInstagram: recipe.doctor.socialMediaInstagram || null,
                    socialMediaX: recipe.doctor.socialMediaX || null,
                    socialMediaOther: recipe.doctor.socialMediaOther || null,
                    hasSocialMedia: !!(recipe.doctor.socialMediaFacebook || recipe.doctor.socialMediaInstagram || recipe.doctor.socialMediaX || recipe.doctor.socialMediaOther)
                },
                patient: {
                    firstName: recipe.paciente.user.firstName,
                    lastName: recipe.paciente.user.lastName,
                    email: recipe.paciente.user.email,
                    fechaNacimiento: 'No especificada', // Campo no disponible en el modelo Patient
                    id: recipe.paciente.id
                },
                recipe: {
                    id: recipe.id,
                    fechaEmision: ((_a = recipe.fechaEmision) === null || _a === void 0 ? void 0 : _a.toLocaleDateString('es-ES')) || new Date().toLocaleDateString('es-ES'),
                    timestamp: ((_b = recipe.fechaEmision) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString(),
                    observaciones: recipe.observaciones || '',
                    esRecetaMedicamento: recipe.esRecetaMedicamento,
                    esSolicitudEstudios: recipe.esSolicitudEstudios,
                    detalleMedicamentos: recipe.detalleMedicamentos || [],
                    estudiosSolicitados: recipe.estudiosSolicitados || []
                },
                qrCode: qrCode.split(',')[1] // Remover el prefijo data:image/png;base64,
            };
            // Generar HTML
            const html = await this.generateHtml(templateData);
            // Generar PDF
            const pdfBuffer = await this.generatePdf(html);
            const fileName = `receta_${recipeId}_${Date.now()}.pdf`;
            // En producción (S3 configurado): subir a S3 (persistente, evita pérdida en ECS)
            if (BUCKET_NAME) {
                const { url: s3Url } = await (0, file_utils_1.uploadBufferToS3)(Buffer.from(pdfBuffer), 'recipes', fileName, 'application/pdf');
                await prisma.recetaMedica.update({
                    where: { id: recipeId },
                    data: { archivoPdf: s3Url }
                });
                return s3Url; // Devolver URL S3 para compatibilidad
            }
            // Fallback local (desarrollo sin S3)
            const filePath = path_1.default.join(__dirname, '../../uploads/recipes', fileName);
            const dir = path_1.default.dirname(filePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(filePath, pdfBuffer);
            await prisma.recetaMedica.update({
                where: { id: recipeId },
                data: { archivoPdf: fileName }
            });
            return fileName;
        }
        catch (error) {
            console.error('Error generando PDF:', error);
            throw error;
        }
    }
    /**
     * Generar HTML desde el template
     */
    static async generateHtml(data) {
        try {
            const templatePath = path_1.default.join(__dirname, '../templates/recipe-template.html');
            const templateContent = fs_1.default.readFileSync(templatePath, 'utf-8');
            const template = handlebars_1.default.compile(templateContent);
            return template(data);
        }
        catch (error) {
            console.error('Error generando HTML:', error);
            throw error;
        }
    }
    /**
     * Generar PDF desde HTML
     */
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
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                },
                printBackground: true
            });
            return Buffer.from(pdfBuffer);
        }
        catch (error) {
            console.error('Error generando PDF:', error);
            throw error;
        }
        finally {
            if (browser) {
                await browser.close();
            }
        }
    }
    /**
     * Generar hash simple para verificación
     */
    static generateHash(recipeId, doctorId) {
        // Usar un timestamp fijo basado en la fecha de emisión para que sea consistente
        const timestamp = Math.floor(new Date('2025-08-11').getTime() / 1000); // Fecha fija para desarrollo
        const data = `${recipeId}-${doctorId}-${timestamp}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * Generar hash para producción usando fecha real de emisión
     */
    static generateProductionHash(recipeId, doctorId, emissionDate) {
        const timestamp = Math.floor(emissionDate.getTime() / 1000);
        const data = `${recipeId}-${doctorId}-${timestamp}`;
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    /** URL pública estable para ver/descargar PDF (sin caducidad por timestamp). */
    static buildPdfViewUrl(recipeId, doctorId, emissionDate) {
        const hash = this.generateProductionHash(recipeId, doctorId, emissionDate);
        const baseUrl = (process.env.RECIPE_PUBLIC_BASE_URL ||
            process.env.BASE_URL ||
            'https://api.qlinexa360.com').replace(/\/$/, '');
        return `${baseUrl}/api/recipes/${recipeId}/pdf-view?temp=${hash}`;
    }
    /**
     * Verificar autenticidad de receta usando QR
     */
    static async verifyRecipe(recipeId, qrData) {
        try {
            const recipe = await prisma.recetaMedica.findUnique({
                where: { id: recipeId }
            });
            if (!recipe) {
                return false;
            }
            // Verificar que los datos coincidan
            return qrData.recipeId === recipeId &&
                qrData.doctorId === recipe.doctorId &&
                qrData.patientId === recipe.pacienteId;
        }
        catch (error) {
            console.error('Error verificando receta:', error);
            return false;
        }
    }
    /**
     * Obtener URL del PDF
     */
    static getPdfUrl(fileName) {
        return `/uploads/recipes/${fileName}`;
    }
    /**
     * Obtener el tipo MIME de un archivo basado en su extensión
     */
    static getMimeType(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        switch (ext) {
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.png':
                return 'image/png';
            case '.gif':
                return 'image/gif';
            case '.svg':
                return 'image/svg+xml';
            default:
                return 'application/octet-stream'; // Archivo desconocido
        }
    }
}
exports.RecipePdfService = RecipePdfService;
