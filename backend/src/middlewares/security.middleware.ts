import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/error.utils';

// Almacenamiento en memoria para rate limiting (en producción usar Redis)
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

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
export const uploadRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.userId || req.ip;
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

/**
 * Middleware para detectar actividad sospechosa
 */
export const suspiciousActivityDetection = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  const contentType = req.headers['content-type'] || '';
  
  // Detectar patrones sospechosos (RegExp → .test(userAgent); boolean → valor tal cual)
  const suspiciousPatterns: Array<RegExp | boolean> = [
    /bot|crawler|spider|scraper/i,
    !contentType.includes('multipart/form-data') && req.path.includes('/upload'),
    !!(req.headers['x-forwarded-for'] && !req.headers['x-real-ip']),
    parseInt(req.headers['content-length'] || '0', 10) > 50 * 1024 * 1024,
  ];

  const isSuspicious = suspiciousPatterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(userAgent);
    return Boolean(pattern);
  });
  
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

/**
 * Middleware para validar headers de seguridad
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Headers de seguridad recomendados
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");
  
  next();
};

/**
 * Middleware para validar tamaño de request
 */
export const requestSizeLimit = (req: Request, res: Response, next: NextFunction) => {
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      message: 'El tamaño del request excede el límite permitido'
    });
  }
  
  next();
};

/**
 * Middleware para sanitizar nombres de archivo
 */
export const sanitizeFilename = (req: Request, res: Response, next: NextFunction) => {
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

/**
 * Middleware para logging de seguridad
 */
export const securityLogging = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
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
        userId: (req as any).user?.userId || 'anonymous',
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

/**
 * Middleware para validar tokens CSRF (si se implementa)
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
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

    const isAllowedOrigin = (o: string) => {
      if (allowedOrigins.includes(o)) return true;
      try {
        const host = new URL(o).hostname;
        return host === 'qlinexa360.com' || host.endsWith('.qlinexa360.com') || host.endsWith('.cloudfront.net');
      } catch {
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