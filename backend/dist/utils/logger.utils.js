"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLoggingMiddleware = exports.securityLogger = exports.LogCategory = exports.LogLevel = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const fs_2 = require("fs");
var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["SECURITY"] = "SECURITY";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var LogCategory;
(function (LogCategory) {
    LogCategory["UPLOAD"] = "UPLOAD";
    LogCategory["SECURITY"] = "SECURITY";
    LogCategory["ANTIVIRUS"] = "ANTIVIRUS";
    LogCategory["AUTH"] = "AUTH";
    LogCategory["ERROR"] = "ERROR";
    LogCategory["SYSTEM"] = "SYSTEM";
})(LogCategory || (exports.LogCategory = LogCategory = {}));
class SecurityLogger {
    constructor() {
        this.streams = new Map();
        this.logDir = (0, path_1.join)(process.cwd(), 'logs');
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        if (!(0, fs_2.existsSync)(this.logDir)) {
            (0, fs_2.mkdirSync)(this.logDir, { recursive: true });
        }
    }
    getStream(filename) {
        if (!this.streams.has(filename)) {
            const filePath = (0, path_1.join)(this.logDir, filename);
            this.streams.set(filename, (0, fs_1.createWriteStream)(filePath, { flags: 'a' }));
        }
        return this.streams.get(filename);
    }
    formatLogEntry(entry) {
        const timestamp = entry.timestamp || new Date().toISOString();
        const baseLog = `[${timestamp}] [${entry.level}] [${entry.category}] ${entry.message}`;
        const additionalInfo = [];
        if (entry.userId)
            additionalInfo.push(`userId=${entry.userId}`);
        if (entry.ip)
            additionalInfo.push(`ip=${entry.ip}`);
        if (entry.userAgent)
            additionalInfo.push(`userAgent=${entry.userAgent}`);
        if (entry.fileInfo) {
            const fileDetails = [];
            if (entry.fileInfo.filename)
                fileDetails.push(`filename=${entry.fileInfo.filename}`);
            if (entry.fileInfo.size)
                fileDetails.push(`size=${entry.fileInfo.size}`);
            if (entry.fileInfo.mimeType)
                fileDetails.push(`mimeType=${entry.fileInfo.mimeType}`);
            if (entry.fileInfo.hash)
                fileDetails.push(`hash=${entry.fileInfo.hash}`);
            if (fileDetails.length > 0)
                additionalInfo.push(`file={${fileDetails.join(', ')}}`);
        }
        if (entry.securityInfo) {
            const securityDetails = [];
            if (entry.securityInfo.threats)
                securityDetails.push(`threats=[${entry.securityInfo.threats.join(', ')}]`);
            if (entry.securityInfo.scanTime)
                securityDetails.push(`scanTime=${entry.securityInfo.scanTime}ms`);
            if (entry.securityInfo.warnings)
                securityDetails.push(`warnings=[${entry.securityInfo.warnings.join(', ')}]`);
            if (securityDetails.length > 0)
                additionalInfo.push(`security={${securityDetails.join(', ')}}`);
        }
        if (entry.details) {
            additionalInfo.push(`details=${JSON.stringify(entry.details)}`);
        }
        return additionalInfo.length > 0 ? `${baseLog} | ${additionalInfo.join(' | ')}` : baseLog;
    }
    writeLog(entry) {
        const timestamp = new Date().toISOString();
        const logEntry = Object.assign(Object.assign({}, entry), { timestamp });
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
    log(level, category, message, details) {
        this.writeLog({ level, category, message, details });
    }
    security(message, details, userId, ip) {
        this.writeLog({
            level: LogLevel.SECURITY,
            category: LogCategory.SECURITY,
            message,
            details,
            userId,
            ip
        });
    }
    upload(message, fileInfo, userId, ip) {
        this.writeLog({
            level: LogLevel.INFO,
            category: LogCategory.UPLOAD,
            message,
            fileInfo,
            userId,
            ip
        });
    }
    antivirus(message, securityInfo, fileInfo, userId) {
        this.writeLog({
            level: LogLevel.INFO,
            category: LogCategory.ANTIVIRUS,
            message,
            securityInfo,
            fileInfo,
            userId
        });
    }
    error(message, error, userId, ip) {
        this.writeLog({
            level: LogLevel.ERROR,
            category: LogCategory.ERROR,
            message,
            details: error,
            userId,
            ip
        });
    }
    warn(message, details, userId) {
        this.writeLog({
            level: LogLevel.WARN,
            category: LogCategory.SYSTEM,
            message,
            details,
            userId
        });
    }
    info(message, details, userId) {
        this.writeLog({
            level: LogLevel.INFO,
            category: LogCategory.SYSTEM,
            message,
            details,
            userId
        });
    }
    // Método para cerrar streams al terminar la aplicación
    close() {
        this.streams.forEach(stream => stream.end());
        this.streams.clear();
    }
}
// Instancia global del logger
exports.securityLogger = new SecurityLogger();
// Middleware para logging automático de requests
const createLoggingMiddleware = () => {
    return (req, res, next) => {
        const startTime = Date.now();
        const originalSend = res.send;
        res.send = function (data) {
            var _a, _b, _c, _d, _e, _f;
            const duration = Date.now() - startTime;
            const statusCode = res.statusCode;
            // Log de requests importantes
            if (req.path.includes('/upload')) {
                exports.securityLogger.upload(`File upload ${statusCode >= 400 ? 'failed' : 'successful'}`, {
                    filename: (_a = req.file) === null || _a === void 0 ? void 0 : _a.originalname,
                    size: (_b = req.file) === null || _b === void 0 ? void 0 : _b.size,
                    mimeType: (_c = req.file) === null || _c === void 0 ? void 0 : _c.mimetype,
                    hash: (_d = req.fileSecurityInfo) === null || _d === void 0 ? void 0 : _d.hash
                }, (_e = req.user) === null || _e === void 0 ? void 0 : _e.userId, req.ip);
            }
            // Log de errores
            if (statusCode >= 400) {
                exports.securityLogger.error(`Request failed: ${req.method} ${req.path}`, { statusCode, duration, data }, (_f = req.user) === null || _f === void 0 ? void 0 : _f.userId, req.ip);
            }
            return originalSend.call(this, data);
        };
        next();
    };
};
exports.createLoggingMiddleware = createLoggingMiddleware;
// Manejar cierre graceful de la aplicación
process.on('SIGINT', () => {
    exports.securityLogger.close();
    process.exit(0);
});
process.on('SIGTERM', () => {
    exports.securityLogger.close();
    process.exit(0);
});
