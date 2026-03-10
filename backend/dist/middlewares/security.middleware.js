"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = exports.securityLogging = exports.sanitizeFilename = exports.requestSizeLimit = exports.securityHeaders = exports.suspiciousActivityDetection = exports.uploadRateLimit = void 0;
// Almacenamiento en memoria para rate limiting (en producción usar Redis)
const uploadAttempts = new Map();
// Configuración de rate limiting
const RATE_LIMIT_CONFIG = {
    MAX_UPLOADS_PER_HOUR: 50,
    MAX_UPLOADS_PER_MINUTE: 10,
    WINDOW_SIZE: 60 * 60 * 1000, // 1 hora
    WINDOW_SIZE_MINUTE: 60 * 1000, // 1 minuto
};
/**
 * Middleware para rate limiting de uploads
 */
const uploadRateLimit = (req, res, next) => {
    var _a;
    const userId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || req.ip;
    const now = Date.now();
    // Limpiar intentos expirados
    const userAttempts = uploadAttempts.get(userId);
    if (userAttempts && now > userAttempts.resetTime) {
        uploadAttempts.delete(userId);
    }
    // Obtener intentos actuales
    const currentAttempts = uploadAttempts.get(userId) || { count: 0, resetTime: now + RATE_LIMIT_CONFIG.WINDOW_SIZE };
    // Verificar límite por hora
    if (currentAttempts.count >= RATE_LIMIT_CONFIG.MAX_UPLOADS_PER_HOUR) {
        return res.status(429).json({
            message: 'Has excedido el límite de subida de archivos por hora. Intenta más tarde.',
            retryAfter: Math.ceil((currentAttempts.resetTime - now) / 1000)
        });
    }
    // Incrementar contador
    currentAttempts.count++;
    uploadAttempts.set(userId, currentAttempts);
    next();
};
exports.uploadRateLimit = uploadRateLimit;
/**
 * Middleware para detectar actividad sospechosa
 */
const suspiciousActivityDetection = (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';
    const contentType = req.headers['content-type'] || '';
    // Detectar patrones sospechosos
    const suspiciousPatterns = [
        // User agents sospechosos
        /bot|crawler|spider|scraper/i,
        // Content-Type incorrecto para uploads
        !contentType.includes('multipart/form-data') && req.path.includes('/upload'),
        // Headers sospechosos
        req.headers['x-forwarded-for'] && !req.headers['x-real-ip'],
        // Tamaño de request sospechoso
        parseInt(req.headers['content-length'] || '0') > 50 * 1024 * 1024, // 50MB
    ];
    const isSuspicious = suspiciousPatterns.some(pattern => typeof pattern === 'string' ? userAgent.includes(pattern) : pattern);
    if (isSuspicious) {
        console.warn(`[SECURITY] Actividad sospechosa detectada:`, {
            ip,
            userAgent,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        });
        // En producción, aquí podrías:
        // 1. Bloquear temporalmente la IP
        // 2. Enviar alerta a sistemas de monitoreo
        // 3. Registrar en base de datos de amenazas
    }
    next();
};
exports.suspiciousActivityDetection = suspiciousActivityDetection;
/**
 * Middleware para validar headers de seguridad
 */
const securityHeaders = (req, res, next) => {
    // Headers de seguridad recomendados
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
    next();
};
exports.securityHeaders = securityHeaders;
/**
 * Middleware para validar tamaño de request
 */
const requestSizeLimit = (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (contentLength > maxSize) {
        return res.status(413).json({
            message: 'El tamaño del request excede el límite permitido'
        });
    }
    next();
};
exports.requestSizeLimit = requestSizeLimit;
/**
 * Middleware para sanitizar nombres de archivo
 */
const sanitizeFilename = (req, res, next) => {
    if (req.file) {
        // Remover caracteres peligrosos
        const sanitizedName = req.file.originalname
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\.\./g, '_')
            .replace(/^\./, '_')
            .replace(/\.$/, '_')
            .substring(0, 255); // Limitar longitud
        req.file.originalname = sanitizedName;
    }
    next();
};
exports.sanitizeFilename = sanitizeFilename;
/**
 * Middleware para logging de seguridad
 */
const securityLogging = (req, res, next) => {
    const startTime = Date.now();
    const originalSend = res.send;
    res.send = function (data) {
        var _a;
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        // Log eventos de seguridad importantes
        if (req.path.includes('/upload')) {
            const logData = {
                timestamp: new Date().toISOString(),
                method: req.method,
                path: req.path,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                statusCode,
                duration,
                userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) || 'anonymous',
                fileSize: req.headers['content-length'],
                success: statusCode < 400
            };
            console.log(`[SECURITY_UPLOAD] ${JSON.stringify(logData)}`);
            // En producción, enviar a sistema de logging
            if (statusCode >= 400) {
                console.error(`[SECURITY_ERROR] Upload failed:`, logData);
            }
        }
        return originalSend.call(this, data);
    };
    next();
};
exports.securityLogging = securityLogging;
/**
 * Middleware para validar tokens CSRF (si se implementa)
 */
const csrfProtection = (req, res, next) => {
    // Implementar validación CSRF si es necesario
    // Por ahora, solo validar que el request venga del mismo origen
    const origin = req.headers.origin;
    const referer = req.headers.referer;
    if (req.method === 'POST' && req.path.includes('/upload')) {
        // Validar que el request venga del frontend autorizado
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:5173',
            'https://www.qlinexa360.com',
            'https://qlinexa360.com',
            ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/$/, '')] : []),
        ].filter(Boolean);
        const isAllowedOrigin = (o) => {
            if (allowedOrigins.includes(o))
                return true;
            try {
                const host = new URL(o).hostname;
                return host === 'qlinexa360.com' || host.endsWith('.qlinexa360.com') || host.endsWith('.cloudfront.net');
            }
            catch (_a) {
                return false;
            }
        };
        if (origin && !isAllowedOrigin(origin)) {
            return res.status(403).json({
                message: 'Origen no autorizado'
            });
        }
    }
    next();
};
exports.csrfProtection = csrfProtection;
