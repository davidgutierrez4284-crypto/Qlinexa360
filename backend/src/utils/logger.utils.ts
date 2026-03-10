import { createWriteStream, WriteStream } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SECURITY = 'SECURITY'
}

export enum LogCategory {
  UPLOAD = 'UPLOAD',
  SECURITY = 'SECURITY',
  ANTIVIRUS = 'ANTIVIRUS',
  AUTH = 'AUTH',
  ERROR = 'ERROR',
  SYSTEM = 'SYSTEM'
}

interface LogEntry {
  timestamp?: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: any;
  fileInfo?: {
    filename?: string;
    size?: number;
    mimeType?: string;
    hash?: string;
  };
  securityInfo?: {
    threats?: string[];
    scanTime?: number;
    warnings?: string[];
  };
}

class SecurityLogger {
  private logDir: string;
  private streams: Map<string, WriteStream> = new Map();

  constructor() {
    this.logDir = join(process.cwd(), 'logs');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getStream(filename: string): WriteStream {
    if (!this.streams.has(filename)) {
      const filePath = join(this.logDir, filename);
      this.streams.set(filename, createWriteStream(filePath, { flags: 'a' }));
    }
    return this.streams.get(filename)!;
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp || new Date().toISOString();
    const baseLog = `[${timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
    
    const additionalInfo = [];
    if (entry.userId) additionalInfo.push(`userId=${entry.userId}`);
    if (entry.ip) additionalInfo.push(`ip=${entry.ip}`);
    if (entry.userAgent) additionalInfo.push(`userAgent=${entry.userAgent}`);
    
    if (entry.fileInfo) {
      const fileDetails = [];
      if (entry.fileInfo.filename) fileDetails.push(`filename=${entry.fileInfo.filename}`);
      if (entry.fileInfo.size) fileDetails.push(`size=${entry.fileInfo.size}`);
      if (entry.fileInfo.mimeType) fileDetails.push(`mimeType=${entry.fileInfo.mimeType}`);
      if (entry.fileInfo.hash) fileDetails.push(`hash=${entry.fileInfo.hash}`);
      if (fileDetails.length > 0) additionalInfo.push(`file={${fileDetails.join(', ')}}`);
    }
    
    if (entry.securityInfo) {
      const securityDetails = [];
      if (entry.securityInfo.threats) securityDetails.push(`threats=[${entry.securityInfo.threats.join(', ')}]`);
      if (entry.securityInfo.scanTime) securityDetails.push(`scanTime=${entry.securityInfo.scanTime}ms`);
      if (entry.securityInfo.warnings) securityDetails.push(`warnings=[${entry.securityInfo.warnings.join(', ')}]`);
      if (securityDetails.length > 0) additionalInfo.push(`security={${securityDetails.join(', ')}}`);
    }
    
    if (entry.details) {
      additionalInfo.push(`details=${JSON.stringify(entry.details)}`);
    }
    
    return additionalInfo.length > 0 ? `${baseLog} | ${additionalInfo.join(' | ')}` : baseLog;
  }

  private writeLog(entry: LogEntry) {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = { ...entry, timestamp };
    const formattedLog = this.formatLogEntry(logEntry);
    
    // Escribir a archivo específico por categoría
    const filename = `${entry.category.toLowerCase()}.log`;
    const stream = this.getStream(filename);
    stream.write(formattedLog + '\n');
    
    // También escribir a consola para desarrollo
    if (process.env.NODE_ENV === 'development') {
      const consoleMethod = entry.level === LogLevel.ERROR ? 'error' : 
                           entry.level === LogLevel.WARN ? 'warn' : 
                           entry.level === LogLevel.SECURITY ? 'warn' : 'log';
      console[consoleMethod](formattedLog);
    }
    
    // Para eventos de seguridad críticos, también escribir a security.log
    if (entry.level === LogLevel.SECURITY || entry.category === LogCategory.SECURITY) {
      const securityStream = this.getStream('security.log');
      securityStream.write(formattedLog + '\n');
    }
  }

  // Métodos públicos para logging
  public log(level: LogLevel, category: LogCategory, message: string, details?: any) {
    this.writeLog({ level, category, message, details });
  }

  public security(message: string, details?: any, userId?: string, ip?: string) {
    this.writeLog({
      level: LogLevel.SECURITY,
      category: LogCategory.SECURITY,
      message,
      details,
      userId,
      ip
    });
  }

  public upload(message: string, fileInfo?: any, userId?: string, ip?: string) {
    this.writeLog({
      level: LogLevel.INFO,
      category: LogCategory.UPLOAD,
      message,
      fileInfo,
      userId,
      ip
    });
  }

  public antivirus(message: string, securityInfo?: any, fileInfo?: any, userId?: string) {
    this.writeLog({
      level: LogLevel.INFO,
      category: LogCategory.ANTIVIRUS,
      message,
      securityInfo,
      fileInfo,
      userId
    });
  }

  public error(message: string, error?: any, userId?: string, ip?: string) {
    this.writeLog({
      level: LogLevel.ERROR,
      category: LogCategory.ERROR,
      message,
      details: error,
      userId,
      ip
    });
  }

  public warn(message: string, details?: any, userId?: string) {
    this.writeLog({
      level: LogLevel.WARN,
      category: LogCategory.SYSTEM,
      message,
      details,
      userId
    });
  }

  public info(message: string, details?: any, userId?: string) {
    this.writeLog({
      level: LogLevel.INFO,
      category: LogCategory.SYSTEM,
      message,
      details,
      userId
    });
  }

  // Método para cerrar streams al terminar la aplicación
  public close() {
    this.streams.forEach(stream => stream.end());
    this.streams.clear();
  }
}

// Instancia global del logger
export const securityLogger = new SecurityLogger();

// Middleware para logging automático de requests
export const createLoggingMiddleware = () => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Log de requests importantes
      if (req.path.includes('/upload')) {
        securityLogger.upload(
          `File upload ${statusCode >= 400 ? 'failed' : 'successful'}`,
          {
            filename: req.file?.originalname,
            size: req.file?.size,
            mimeType: req.file?.mimetype,
            hash: req.fileSecurityInfo?.hash
          },
          req.user?.userId,
          req.ip
        );
      }
      
      // Log de errores
      if (statusCode >= 400) {
        securityLogger.error(
          `Request failed: ${req.method} ${req.path}`,
          { statusCode, duration, data },
          req.user?.userId,
          req.ip
        );
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Manejar cierre graceful de la aplicación
process.on('SIGINT', () => {
  securityLogger.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  securityLogger.close();
  process.exit(0);
}); 