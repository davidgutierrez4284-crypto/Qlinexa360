"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecurityEvent = exports.performSecurityValidation = exports.validateImageContent = exports.validatePDFContent = exports.generateFileHash = exports.validateFileExtension = exports.validateFileSize = exports.detectSuspiciousContent = exports.validateFileSignature = exports.SECURITY_CONFIG = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Configuración de seguridad
exports.SECURITY_CONFIG = {
    // Tamaños máximos por tipo de archivo
    MAX_FILE_SIZES: {
        'application/pdf': 10 * 1024 * 1024, // 10MB para PDFs (recetas, estudios)
        'image/jpeg': 5 * 1024 * 1024, // 5MB para imágenes
        'image/png': 5 * 1024 * 1024, // 5MB para imágenes
        'image/webp': 5 * 1024 * 1024, // 5MB para imágenes
    },
    // Headers de archivo conocidos (magic numbers)
    FILE_SIGNATURES: {
        'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
        'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG
        'image/png': [0x89, 0x50, 0x4E, 0x47], // PNG
        'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
    },
    // Extensiones peligrosas que nunca deben permitirse
    DANGEROUS_EXTENSIONS: [
        '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
        '.msi', '.dll', '.sys', '.drv', '.ocx', '.cpl', '.hta', '.wsf', '.wsh',
        '.ps1', '.psm1', '.psd1', '.psc1', '.psc2', '.msp', '.mst', '.msu',
        '.app', '.dmg', '.pkg', '.deb', '.rpm', '.sh', '.bash', '.zsh',
        '.py', '.pl', '.rb', '.php', '.asp', '.aspx', '.jsp', '.jspx'
    ],
    // Patrones de contenido sospechoso
    SUSPICIOUS_PATTERNS: [
        /<script/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /eval\(/i,
        /document\./i,
        /window\./i,
        /alert\(/i,
        /confirm\(/i,
        /prompt\(/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /<applet/i,
        /<meta.*refresh/i,
        /<link.*javascript/i
    ]
};
/**
 * Valida la firma del archivo (magic numbers)
 */
const validateFileSignature = (buffer, expectedMimeType) => {
    const signature = exports.SECURITY_CONFIG.FILE_SIGNATURES[expectedMimeType];
    if (!signature)
        return false;
    if (buffer.length < signature.length)
        return false;
    for (let i = 0; i < signature.length; i++) {
        if (buffer[i] !== signature[i])
            return false;
    }
    return true;
};
exports.validateFileSignature = validateFileSignature;
/**
 * Detecta contenido sospechoso en archivos de texto
 */
const detectSuspiciousContent = (buffer) => {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000)); // Solo revisar los primeros 10KB
    const foundPatterns = [];
    exports.SECURITY_CONFIG.SUSPICIOUS_PATTERNS.forEach(pattern => {
        if (pattern.test(content)) {
            foundPatterns.push(pattern.source);
        }
    });
    return {
        isSuspicious: foundPatterns.length > 0,
        patterns: foundPatterns
    };
};
exports.detectSuspiciousContent = detectSuspiciousContent;
/**
 * Valida el tamaño del archivo según su tipo
 */
const validateFileSize = (size, mimeType) => {
    const maxSize = exports.SECURITY_CONFIG.MAX_FILE_SIZES[mimeType];
    return maxSize ? size <= maxSize : size <= 2 * 1024 * 1024; // 2MB por defecto
};
exports.validateFileSize = validateFileSize;
/**
 * Valida la extensión del archivo
 */
const validateFileExtension = (filename) => {
    const extension = filename.toLowerCase().split('.').pop();
    if (!extension)
        return false;
    return !exports.SECURITY_CONFIG.DANGEROUS_EXTENSIONS.includes(`.${extension}`);
};
exports.validateFileExtension = validateFileExtension;
/**
 * Genera un hash SHA-256 del archivo para verificación de integridad
 */
const generateFileHash = (buffer) => {
    return crypto_1.default.createHash('sha256').update(buffer).digest('hex');
};
exports.generateFileHash = generateFileHash;
/**
 * Valida el contenido del archivo PDF para detectar JavaScript ejecutable
 * Relajado: no rechazar por URLs (comunes en recetas/estudios) ni por estructura PDF inocua
 */
const validatePDFContent = (buffer) => {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 50000));
    const issues = [];
    // Solo rechazar JavaScript ejecutable explícito (objetos /JS con stream de código)
    // No rechazar por /S (strings), /Type/Action (acciones de link), /A (anotaciones) - son comunes en PDFs legítimos
    const dangerousJsPattern = /\/JS\s*\([^)]*\)\s*\/JS|\/JavaScript\s+\([^)]*\)/;
    if (dangerousJsPattern.test(content)) {
        issues.push('PDF contiene JavaScript ejecutable');
    }
    return {
        isValid: issues.length === 0,
        issues
    };
};
exports.validatePDFContent = validatePDFContent;
/**
 * Valida imágenes para detectar contenido sospechoso
 */
const validateImageContent = (buffer, mimeType) => {
    const issues = [];
    // Verificar que la imagen no sea demasiado pequeña (podría ser un archivo malicioso disfrazado)
    if (buffer.length < 100) {
        issues.push('Archivo de imagen demasiado pequeño');
    }
    // Verificar proporciones de imagen (para detectar archivos no-imagen)
    if (mimeType.startsWith('image/')) {
        try {
            // Intentar leer las dimensiones de la imagen
            const header = buffer.slice(0, 100);
            const headerStr = header.toString('hex');
            // Verificar que tenga headers de imagen válidos
            if (!headerStr.includes('ffd8') && !headerStr.includes('89504e47') && !headerStr.includes('52494646')) {
                issues.push('Headers de imagen no válidos');
            }
        }
        catch (error) {
            issues.push('No se pudo validar el contenido de la imagen');
        }
    }
    return {
        isValid: issues.length === 0,
        issues
    };
};
exports.validateImageContent = validateImageContent;
/**
 * Función principal de validación de seguridad
 */
const performSecurityValidation = (file) => {
    const errors = [];
    const warnings = [];
    // 1. Validar extensión
    if (!(0, exports.validateFileExtension)(file.originalname)) {
        errors.push('Extensión de archivo no permitida por razones de seguridad');
    }
    // 2. Validar tamaño según tipo
    if (!(0, exports.validateFileSize)(file.size, file.mimetype)) {
        errors.push(`El archivo excede el tamaño máximo permitido para ${file.mimetype}`);
    }
    // 3. Validar firma del archivo
    if (!(0, exports.validateFileSignature)(file.buffer, file.mimetype)) {
        errors.push('La firma del archivo no coincide con su tipo MIME declarado');
    }
    // 4. Generar hash para auditoría
    const hash = (0, exports.generateFileHash)(file.buffer);
    // 5. Validaciones específicas por tipo
    if (file.mimetype === 'application/pdf') {
        const pdfValidation = (0, exports.validatePDFContent)(file.buffer);
        if (!pdfValidation.isValid) {
            errors.push(...pdfValidation.issues);
        }
    }
    else if (file.mimetype.startsWith('image/')) {
        const imageValidation = (0, exports.validateImageContent)(file.buffer, file.mimetype);
        if (!imageValidation.isValid) {
            errors.push(...imageValidation.issues);
        }
    }
    // 6. Detectar contenido sospechoso
    const suspiciousCheck = (0, exports.detectSuspiciousContent)(file.buffer);
    if (suspiciousCheck.isSuspicious) {
        warnings.push(`Contenido sospechoso detectado: ${suspiciousCheck.patterns.join(', ')}`);
    }
    // 7. Validaciones adicionales
    if (file.originalname.includes('..')) {
        errors.push('Nombre de archivo contiene caracteres peligrosos');
    }
    if (file.originalname.length > 255) {
        errors.push('Nombre de archivo demasiado largo');
    }
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        hash
    };
};
exports.performSecurityValidation = performSecurityValidation;
/**
 * Registra eventos de seguridad para auditoría
 */
const logSecurityEvent = (event) => {
    const timestamp = new Date().toISOString();
    console.log(`[SECURITY] ${timestamp} - ${event.type}:`, {
        userId: event.userId,
        filename: event.filename,
        fileSize: event.fileSize,
        mimeType: event.mimeType,
        hash: event.hash,
        errors: event.errors,
        warnings: event.warnings,
        ipAddress: event.ipAddress
    });
    // Aquí podrías enviar a un sistema de logging como Winston, Log4j, etc.
    // También podrías enviar alertas a sistemas de monitoreo de seguridad
};
exports.logSecurityEvent = logSecurityEvent;
