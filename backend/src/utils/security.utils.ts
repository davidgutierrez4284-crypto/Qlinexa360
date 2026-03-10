import crypto from 'crypto';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

// Configuración de seguridad
export const SECURITY_CONFIG = {
  // Tamaños máximos por tipo de archivo
  MAX_FILE_SIZES: {
    'application/pdf': 10 * 1024 * 1024, // 10MB para PDFs (recetas, estudios)
    'image/jpeg': 5 * 1024 * 1024,      // 5MB para imágenes
    'image/png': 5 * 1024 * 1024,       // 5MB para imágenes
    'image/webp': 5 * 1024 * 1024,       // 5MB para imágenes
  },
  
  // Headers de archivo conocidos (magic numbers)
  FILE_SIGNATURES: {
    'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
    'image/jpeg': [0xFF, 0xD8, 0xFF],            // JPEG
    'image/png': [0x89, 0x50, 0x4E, 0x47],      // PNG
    'image/webp': [0x52, 0x49, 0x46, 0x46],     // RIFF
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
export const validateFileSignature = (buffer: Buffer, expectedMimeType: string): boolean => {
  const signature = SECURITY_CONFIG.FILE_SIGNATURES[expectedMimeType as keyof typeof SECURITY_CONFIG.FILE_SIGNATURES];
  if (!signature) return false;
  
  if (buffer.length < signature.length) return false;
  
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) return false;
  }
  
  return true;
};

/**
 * Detecta contenido sospechoso en archivos de texto
 */
export const detectSuspiciousContent = (buffer: Buffer): { isSuspicious: boolean; patterns: string[] } => {
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000)); // Solo revisar los primeros 10KB
  const foundPatterns: string[] = [];
  
  SECURITY_CONFIG.SUSPICIOUS_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      foundPatterns.push(pattern.source);
    }
  });
  
  return {
    isSuspicious: foundPatterns.length > 0,
    patterns: foundPatterns
  };
};

/**
 * Valida el tamaño del archivo según su tipo
 */
export const validateFileSize = (size: number, mimeType: string): boolean => {
  const maxSize = SECURITY_CONFIG.MAX_FILE_SIZES[mimeType as keyof typeof SECURITY_CONFIG.MAX_FILE_SIZES];
  return maxSize ? size <= maxSize : size <= 2 * 1024 * 1024; // 2MB por defecto
};

/**
 * Valida la extensión del archivo
 */
export const validateFileExtension = (filename: string): boolean => {
  const extension = filename.toLowerCase().split('.').pop();
  if (!extension) return false;
  
  return !SECURITY_CONFIG.DANGEROUS_EXTENSIONS.includes(`.${extension}`);
};

/**
 * Genera un hash SHA-256 del archivo para verificación de integridad
 */
export const generateFileHash = (buffer: Buffer): string => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

/**
 * Valida el contenido del archivo PDF para detectar JavaScript ejecutable
 * Relajado: no rechazar por URLs (comunes en recetas/estudios) ni por estructura PDF inocua
 */
export const validatePDFContent = (buffer: Buffer): { isValid: boolean; issues: string[] } => {
  const content = buffer.toString('utf8', 0, Math.min(buffer.length, 50000));
  const issues: string[] = [];
  
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

/**
 * Valida imágenes para detectar contenido sospechoso
 */
export const validateImageContent = (buffer: Buffer, mimeType: string): { isValid: boolean; issues: string[] } => {
  const issues: string[] = [];
  
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
    } catch (error) {
      issues.push('No se pudo validar el contenido de la imagen');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
};

/**
 * Función principal de validación de seguridad
 */
export const performSecurityValidation = (file: Express.Multer.File): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hash: string;
} => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Validar extensión
  if (!validateFileExtension(file.originalname)) {
    errors.push('Extensión de archivo no permitida por razones de seguridad');
  }
  
  // 2. Validar tamaño según tipo
  if (!validateFileSize(file.size, file.mimetype)) {
    errors.push(`El archivo excede el tamaño máximo permitido para ${file.mimetype}`);
  }
  
  // 3. Validar firma del archivo
  if (!validateFileSignature(file.buffer, file.mimetype)) {
    errors.push('La firma del archivo no coincide con su tipo MIME declarado');
  }
  
  // 4. Generar hash para auditoría
  const hash = generateFileHash(file.buffer);
  
  // 5. Validaciones específicas por tipo
  if (file.mimetype === 'application/pdf') {
    const pdfValidation = validatePDFContent(file.buffer);
    if (!pdfValidation.isValid) {
      errors.push(...pdfValidation.issues);
    }
  } else if (file.mimetype.startsWith('image/')) {
    const imageValidation = validateImageContent(file.buffer, file.mimetype);
    if (!imageValidation.isValid) {
      errors.push(...imageValidation.issues);
    }
  }
  
  // 6. Detectar contenido sospechoso
  const suspiciousCheck = detectSuspiciousContent(file.buffer);
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

/**
 * Registra eventos de seguridad para auditoría
 */
export const logSecurityEvent = (event: {
  type: 'file_upload' | 'file_rejected' | 'security_violation';
  userId: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  errors?: string[];
  warnings?: string[];
  ipAddress?: string;
}) => {
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