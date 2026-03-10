import { spawn } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface ScanResult {
  isInfected: boolean;
  threats: string[];
  scanTime: number;
  error?: string;
}

/**
 * Escanea un archivo usando ClamAV
 * @param buffer - Buffer del archivo a escanear
 * @param filename - Nombre del archivo
 * @returns Promise<ScanResult>
 */
export const scanFileWithClamAV = async (buffer: Buffer, filename: string): Promise<ScanResult> => {
  const startTime = Date.now();
  const tempFilePath = join(tmpdir(), `${uuidv4()}_${filename}`);
  
  try {
    // Escribir archivo temporal
    await writeFile(tempFilePath, buffer);
    
    // Ejecutar ClamAV
    const result = await new Promise<ScanResult>((resolve, reject) => {
      const clamscan = spawn('clamscan', ['--no-summary', '--infected', tempFilePath]);
      
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
        } else if (code === 1) {
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
        } else {
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
    
  } catch (error) {
    return {
      isInfected: false,
      threats: [],
      scanTime: Date.now() - startTime,
      error: `Scan error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  } finally {
    // Limpiar archivo temporal
    try {
      await unlink(tempFilePath);
    } catch (error) {
      console.warn('Could not delete temp file:', tempFilePath);
    }
  }
};

/**
 * Verifica si ClamAV está disponible en el sistema
 */
export const isClamAVAvailable = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const clamscan = spawn('clamscan', ['--version']);
    
    clamscan.on('error', () => {
      resolve(false);
    });
    
    clamscan.on('close', (code) => {
      resolve(code === 0);
    });
  });
};

/**
 * Escanea múltiples archivos en paralelo
 */
export const scanMultipleFiles = async (files: Array<{ buffer: Buffer; filename: string }>): Promise<ScanResult[]> => {
  const scanPromises = files.map(file => 
    scanFileWithClamAV(file.buffer, file.filename)
  );
  
  return Promise.all(scanPromises);
};

/**
 * Middleware para escanear archivos automáticamente
 */
export const createAntivirusMiddleware = () => {
  return async (req: any, res: any, next: any) => {
    if (!req.file) {
      return next();
    }
    
    try {
      console.log(`[ANTIVIRUS] Scanning file: ${req.file.originalname}`);
      
      const scanResult = await scanFileWithClamAV(req.file.buffer, req.file.originalname);
      
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
      
    } catch (error) {
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