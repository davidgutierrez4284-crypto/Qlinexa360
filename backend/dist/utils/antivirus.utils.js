"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAntivirusMiddleware = exports.scanMultipleFiles = exports.isClamAVAvailable = exports.scanFileWithClamAV = void 0;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const uuid_1 = require("uuid");
/**
 * Escanea un archivo usando ClamAV
 * @param buffer - Buffer del archivo a escanear
 * @param filename - Nombre del archivo
 * @returns Promise<ScanResult>
 */
const scanFileWithClamAV = async (buffer, filename) => {
    const startTime = Date.now();
    const tempFilePath = (0, path_1.join)((0, os_1.tmpdir)(), `${(0, uuid_1.v4)()}_${filename}`);
    try {
        // Escribir archivo temporal
        await (0, promises_1.writeFile)(tempFilePath, buffer);
        // Ejecutar ClamAV
        const result = await new Promise((resolve, reject) => {
            const clamscan = (0, child_process_1.spawn)('clamscan', ['--no-summary', '--infected', tempFilePath]);
            let stdout = '';
            let stderr = '';
            clamscan.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            clamscan.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            clamscan.on('close', (code) => {
                const scanTime = Date.now() - startTime;
                // Código de salida de ClamAV:
                // 0 = No threats found
                // 1 = Threats found
                // 2 = Error occurred
                if (code === 0) {
                    resolve({
                        isInfected: false,
                        threats: [],
                        scanTime
                    });
                }
                else if (code === 1) {
                    // Extraer nombres de amenazas del output
                    const threats = stdout
                        .split('\n')
                        .filter(line => line.includes('FOUND'))
                        .map(line => {
                        const match = line.match(/FOUND: (.+)$/);
                        return match ? match[1] : 'Unknown threat';
                    });
                    resolve({
                        isInfected: true,
                        threats,
                        scanTime
                    });
                }
                else {
                    resolve({
                        isInfected: false,
                        threats: [],
                        scanTime,
                        error: `ClamAV error: ${stderr}`
                    });
                }
            });
            clamscan.on('error', (error) => {
                resolve({
                    isInfected: false,
                    threats: [],
                    scanTime: Date.now() - startTime,
                    error: `ClamAV not available: ${error.message}`
                });
            });
        });
        return result;
    }
    catch (error) {
        return {
            isInfected: false,
            threats: [],
            scanTime: Date.now() - startTime,
            error: `Scan error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
    finally {
        // Limpiar archivo temporal
        try {
            await (0, promises_1.unlink)(tempFilePath);
        }
        catch (error) {
            console.warn('Could not delete temp file:', tempFilePath);
        }
    }
};
exports.scanFileWithClamAV = scanFileWithClamAV;
/**
 * Verifica si ClamAV está disponible en el sistema
 */
const isClamAVAvailable = async () => {
    return new Promise((resolve) => {
        const clamscan = (0, child_process_1.spawn)('clamscan', ['--version']);
        clamscan.on('error', () => {
            resolve(false);
        });
        clamscan.on('close', (code) => {
            resolve(code === 0);
        });
    });
};
exports.isClamAVAvailable = isClamAVAvailable;
/**
 * Escanea múltiples archivos en paralelo
 */
const scanMultipleFiles = async (files) => {
    const scanPromises = files.map(file => (0, exports.scanFileWithClamAV)(file.buffer, file.filename));
    return Promise.all(scanPromises);
};
exports.scanMultipleFiles = scanMultipleFiles;
/**
 * Middleware para escanear archivos automáticamente
 */
const createAntivirusMiddleware = () => {
    return async (req, res, next) => {
        if (!req.file) {
            return next();
        }
        try {
            console.log(`[ANTIVIRUS] Scanning file: ${req.file.originalname}`);
            const scanResult = await (0, exports.scanFileWithClamAV)(req.file.buffer, req.file.originalname);
            // Agregar resultado del escaneo al request
            req.antivirusResult = scanResult;
            if (scanResult.isInfected) {
                console.error(`[ANTIVIRUS] Malware detected in ${req.file.originalname}:`, scanResult.threats);
                return res.status(400).json({
                    message: 'Archivo rechazado: se detectó contenido malicioso',
                    threats: scanResult.threats
                });
            }
            if (scanResult.error) {
                console.warn(`[ANTIVIRUS] Scan warning for ${req.file.originalname}:`, scanResult.error);
            }
            console.log(`[ANTIVIRUS] File ${req.file.originalname} scanned successfully in ${scanResult.scanTime}ms`);
            next();
        }
        catch (error) {
            console.error(`[ANTIVIRUS] Error scanning file ${req.file.originalname}:`, error);
            // En caso de error, permitir el archivo pero registrar la advertencia
            req.antivirusResult = {
                isInfected: false,
                threats: [],
                scanTime: 0,
                error: 'Antivirus scan failed'
            };
            next();
        }
    };
};
exports.createAntivirusMiddleware = createAntivirusMiddleware;
