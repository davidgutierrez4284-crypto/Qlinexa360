import { Request, Response } from 'express';
import prisma from '../config/database';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { uploadToS3 } from '../utils/file.utils';
import { AppError } from '../utils/error.utils';
import { AuthRequest } from '../middlewares/auth.middleware';
import { FileCategory } from '@prisma/client';
import { validateFile } from '../middlewares/upload.middleware';
import { securityLogger } from '../utils/logger.utils';

// Usar credenciales explícitas solo si existen; si no, el SDK usa la cadena por defecto (task role en ECS)
const s3ClientConfig: { region: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
  region: process.env.AWS_REGION || 'us-east-1',
};
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3ClientConfig.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}
const s3Client = new S3Client(s3ClientConfig);
const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';

const resolveAssistantDoctorId = async (req: AuthRequest): Promise<string> => {
  const selectedDoctorId = req.headers['x-selected-doctor-id'];
  if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
    throw new AppError('Doctor seleccionado requerido', 400);
  }

  const link = await prisma.asistenteDoctorVinculo.findFirst({
    where: {
      doctorId: selectedDoctorId,
      asistenteId: req.user?.userId,
      activo: true
    },
    select: { permisosHistorial: true }
  });

  if (!link) {
    throw new AppError('Asistente no vinculado a este doctor', 403);
  }

  if (!link.permisosHistorial) {
    throw new AppError('No tienes permisos para acceder a historial clínico', 403);
  }

  return selectedDoctorId;
};

const assistantCanAccessFile = async (req: AuthRequest, file: any): Promise<boolean> => {
  const doctorId = await resolveAssistantDoctorId(req);

  if (file.doctorId && file.doctorId === doctorId) {
    return true;
  }

  if (file.medicalRecordId) {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: file.medicalRecordId },
      select: { vinculadoADoctor: true, doctorPatient: { select: { doctorId: true } }, clinicalCaseId: true }
    });

    if (record?.vinculadoADoctor && record.vinculadoADoctor === doctorId) {
      return true;
    }

    if (record?.doctorPatient?.doctorId === doctorId) {
      return true;
    }

    // Si el doctor es colaborador del caso clínico
    if (record?.clinicalCaseId) {
      const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
        where: {
          padecimientoId: record.clinicalCaseId,
          doctorId
        }
      });
      if (isCollaborator) return true;
    }
  }

  return false;
};

/** Verifica si un doctor (por userId) puede acceder a un archivo como colaborador del caso clínico */
const doctorCanAccessFileAsCollaborator = async (userId: string, file: any): Promise<boolean> => {
  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true }
  });
  if (!doctor) return false;

  if (file.doctorId && file.doctorId === doctor.id) return true;

  if (file.doctorPatientId) {
    const dp = await prisma.doctorPatient.findUnique({
      where: { id: file.doctorPatientId },
      select: { doctorId: true }
    });
    if (dp?.doctorId === doctor.id) return true;
  }

  if (file.medicalRecordId) {
    const record = await prisma.medicalRecord.findUnique({
      where: { id: file.medicalRecordId },
      select: {
        clinicalCaseId: true,
        doctorPatient: { select: { doctorId: true } },
        vinculadoADoctor: true
      }
    });
    if (!record) return false;

    // Doctor titular del caso (doctorPatient) o vinculado a la consulta
    if (record.doctorPatient?.doctorId === doctor.id || record.vinculadoADoctor === doctor.id) {
      return true;
    }

    // Doctor colaborador del caso clínico
    if (record.clinicalCaseId) {
      const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
        where: {
          padecimientoId: record.clinicalCaseId,
          doctorId: doctor.id
        }
      });
      if (isCollaborator) return true;
    }
  }

  return false;
};

export const getFileSecure = async (req: AuthRequest, res: Response) => {
  try {
    const { fileId } = req.params;
    const user = req.user;

    if (!user) {
      throw new AppError('No estás autenticado', 401);
    }

    // Buscar el archivo en la base de datos
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    if (!file) {
      throw new AppError('Archivo no encontrado', 404);
    }

    // Verificar permisos
    if (user.role === 'ASISTENTE') {
      const canAccess = await assistantCanAccessFile(req, file);
      if (!canAccess) {
        securityLogger.security(
          'Unauthorized file access attempt',
          { fileId, requestedBy: user.userId, fileOwner: file.uploadedById },
          user.userId,
          req.ip
        );
        throw new AppError('No tienes permisos para acceder a este archivo', 403);
      }
    } else if (user.role === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { userId: user.userId },
        select: { id: true }
      });

      if (!patient) {
        throw new AppError('Perfil de paciente no encontrado', 404);
      }

      let canAccess = file.patientId === patient.id;
      if (!canAccess && file.medicalRecordId) {
        const record = await prisma.medicalRecord.findUnique({
          where: { id: file.medicalRecordId },
          select: { patientId: true }
        });
        canAccess = record?.patientId === patient.id;
      }

      if (!canAccess) {
        securityLogger.security(
          'Unauthorized file access attempt',
          { fileId, requestedBy: user.userId, fileOwner: file.uploadedById },
          user.userId,
          req.ip
        );
        throw new AppError('No tienes permisos para acceder a este archivo', 403);
      }
    } else if (user.role === 'DOCTOR') {
      const isUploader = file.uploadedById === user.userId;
      const isCollaborator = !isUploader && await doctorCanAccessFileAsCollaborator(user.userId, file);
      if (!isUploader && !isCollaborator) {
        securityLogger.security(
          'Unauthorized file access attempt',
          { fileId, requestedBy: user.userId, fileOwner: file.uploadedById },
          user.userId,
          req.ip
        );
        throw new AppError('No tienes permisos para acceder a este archivo', 403);
      }
    } else if (file.uploadedById !== user.userId) {
      securityLogger.security(
        'Unauthorized file access attempt',
        { fileId, requestedBy: user.userId, fileOwner: file.uploadedById },
        user.userId,
        req.ip
      );
      throw new AppError('No tienes permisos para acceder a este archivo', 403);
    }

    // Generar URL firmada para S3
    // Extraer la clave S3 de la URL completa
    const s3Key = file.url.replace(`https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/`, '');
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hora

    securityLogger.info(
      'File accessed successfully',
      { fileId, fileName: file.fileName, fileType: file.fileType },
      user.userId
    );

    res.json({
      url: signedUrl,
      file: {
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        size: file.size,
        category: file.category,
        uploadedBy: file.uploadedBy
      }
    });

  } catch (error: any) {
    console.error('Error al obtener archivo seguro:', error);
    securityLogger.error(
      'Error accessing secure file',
      error,
      req.user?.userId,
      req.ip
    );
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: 'Error interno del servidor al obtener el archivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getSignedUrlForS3 = async (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.query;
    const user = req.user;

    console.log('=== DEBUG: getSignedUrlForS3 ===');
    console.log('URL recibida:', url);
    console.log('Usuario:', user?.userId);
    console.log('BUCKET_NAME:', BUCKET_NAME);
    console.log('AWS_REGION:', process.env.AWS_REGION);

    if (!user) {
      throw new AppError('No estás autenticado', 401);
    }

    if (!url || typeof url !== 'string') {
      throw new AppError('URL requerida', 400);
    }

    // Intentar buscar el archivo en la BD (opcional, para archivos registrados)
    const file = await prisma.file.findFirst({
      where: { url: url }
    });

    console.log('Archivo encontrado en DB:', file ? 'SÍ' : 'NO');

    // Extraer el key de S3 desde la URL
    // Esto funciona tanto para archivos registrados en la BD como para fotos de perfil
    const region = process.env.AWS_REGION || 'us-east-1';
    
    console.log('Extrayendo clave S3 desde URL...');
    console.log('URL completa:', url);
    console.log('Bucket:', BUCKET_NAME);
    console.log('Región:', region);
    
    // Extraer el key de S3 desde la URL usando el pathname (más robusto)
    let s3Key: string = '';
    try {
      const urlObj = new URL(url);
      // El pathname contiene el key (sin el slash inicial)
      s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
      console.log('Clave S3 extraída desde pathname:', s3Key);
    } catch (urlError) {
      console.error('Error parseando URL con URL constructor:', urlError);
      
      // Método alternativo: usar replace con diferentes prefijos
      const possiblePrefixes = [
        `https://${BUCKET_NAME}.s3.amazonaws.com/`, // us-east-1
        `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/`, // otras regiones (ej: us-east-2)
        `https://${BUCKET_NAME}.s3-${region}.amazonaws.com/`, // formato legacy
      ];
      
      for (const prefix of possiblePrefixes) {
        if (url.startsWith(prefix)) {
          s3Key = url.replace(prefix, '');
          console.log('Clave S3 extraída usando prefijo:', prefix, '->', s3Key);
          break;
        }
      }
    }
    
    // Verificar que se extrajo correctamente
    if (!s3Key || s3Key === url || !s3Key.trim()) {
      console.error('Error: No se pudo extraer la clave S3 correctamente');
      console.error('URL recibida:', url);
      console.error('Bucket esperado:', BUCKET_NAME);
      console.error('Región esperada:', region);
      throw new AppError('Formato de URL de S3 inválido. No se pudo extraer la clave del archivo desde la URL.', 400);
    }
    
    console.log('Clave S3 extraída exitosamente:', s3Key);

    // Verificar permisos: si el archivo está en la BD, verificar permisos
    // Si no está en la BD (como fotos de perfil), verificar que el usuario tenga acceso
    // Para fotos de perfil, verificar que la URL pertenezca al usuario autenticado
    if (file) {
      if (user.role === 'ASISTENTE') {
        const canAccess = await assistantCanAccessFile(req, file);
        if (!canAccess) {
          throw new AppError('No tienes permisos para acceder a este archivo', 403);
        }
      } else if (user.role === 'DOCTOR') {
        const isUploader = file.uploadedById === user.userId;
        const isCollaborator = !isUploader && await doctorCanAccessFileAsCollaborator(user.userId, file);
        if (!isUploader && !isCollaborator) {
          throw new AppError('No tienes permisos para acceder a este archivo', 403);
        }
      }
    }
    if (!file) {
      // Verificar que la URL de foto de perfil pertenezca al usuario
      // Las fotos de perfil tienen el formato: category/userId/filename
      const urlParts = s3Key.split('/');
      if (urlParts.length >= 2) {
        const category = urlParts[0];
        const fileUserId = urlParts[1];
        
        // Verificar si es una foto de perfil (doctor, patient, assistant, admin)
        const allowedProfileCategories = [
          'doctor-profile-photos',
          'patient-profile-photos',
          'assistant-profile-photos',
          'admin-profile-photos'
        ];
        if (allowedProfileCategories.includes(category)) {
          // Verificar que el userId en la URL coincida con el usuario autenticado
          if (fileUserId !== user.userId) {
            // Si no coincide, permitir para doctores/asistentes que pueden ver fotos de pacientes
            // o denegar acceso no autorizado
            console.log('Verificando permisos de acceso a foto de perfil...');
            console.log('fileUserId:', fileUserId, 'user.userId:', user.userId);
            
            // Para fotos de perfil propias, debe coincidir el userId
            if (['assistant-profile-photos', 'admin-profile-photos'].includes(category)) {
              throw new AppError('No tienes permisos para acceder a esta foto de perfil', 403);
            }
            console.log('Permitiendo acceso a foto de perfil (verificación de permisos básica)');
          }
        }
      }
    }

    // Verificar que el archivo existe en S3 (evita NoSuchKey en dev con datos de otro ambiente)
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
    } catch (headErr: any) {
      const is404 = headErr?.name === 'NotFound' || headErr?.$metadata?.httpStatusCode === 404 || headErr?.Code === 'NoSuchKey';
      if (is404) {
        return res.status(404).json({ message: 'Archivo no encontrado en el almacenamiento' });
      }
      throw headErr;
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    console.log('Comando S3:', { Bucket: BUCKET_NAME, Key: s3Key });

    // Generar URL firmada con expiración de 7 días para fotos de perfil
    // (más largo que los archivos normales porque las fotos de perfil se muestran frecuentemente)
    const expirationTime = file ? 3600 : 7 * 24 * 3600; // 1 hora para archivos normales, 7 días para fotos de perfil
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: expirationTime });

    console.log('URL firmada generada exitosamente (expira en', expirationTime, 'segundos)');

    securityLogger.info(
      'Signed URL generated successfully',
      { 
        fileId: file?.id || 'N/A', 
        fileName: file?.fileName || 'Profile picture',
        url: url,
        s3Key: s3Key
      },
      user.userId
    );

    res.json({ url: signedUrl });

  } catch (error: any) {
    console.error('Error al generar URL firmada:', error);
    console.error('Stack trace:', error.stack);
    securityLogger.error(
      'Error generating signed URL',
      error,
      req.user?.userId,
      req.ip
    );
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: 'Error interno del servidor al generar URL firmada',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    const user = req.user;
    const { category } = req.body;
    const securityInfo = (req as any).fileSecurityInfo;
    const securityWarnings = (req as any).securityWarnings;
    const antivirusResult = (req as any).antivirusResult;

    // Validaciones básicas
    if (!file) {
      throw new AppError('No se ha subido ningún archivo', 400);
    }
    
    if (!user) {
      throw new AppError('No estás autenticado', 401);
    }
    
    if (!category || !Object.values(FileCategory).includes(category)) {
      throw new AppError('La categoría del archivo es inválida o no fue proporcionada', 400);
    }

    // Validar archivo usando el middleware
    const validation = validateFile(file);
    if (!validation.isValid) {
      throw new AppError(validation.error || 'Archivo inválido', 400);
    }

    securityLogger.info(
      'Starting file upload',
      {
        filename: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        category,
        securityHash: securityInfo?.hash
      },
      user.userId
    );

    // Subir a S3
    const { url, key } = await uploadToS3(file, category, user.userId);

    securityLogger.info(
      'File uploaded to S3 successfully',
      { s3Key: key, url },
      user.userId
    );

    // Crear registro en la base de datos con información de seguridad
    const newDbFile = await prisma.file.create({
      data: {
        fileName: file.originalname,
        fileType: file.mimetype,
        size: file.size,
        url: url,
        category: category,
        uploadedById: user.userId,
        // Agregar información de seguridad si está disponible
        ...(securityInfo && {
          securityHash: securityInfo.hash,
          securityValidated: securityInfo.validated,
          securityWarnings: securityWarnings || []
        })
      },
      include: {
        uploadedBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    securityLogger.info(
      'File registered in database',
      { fileId: newDbFile.id, fileName: newDbFile.fileName },
      user.userId
    );

    // Log de escaneo antivirus si está disponible
    if (antivirusResult) {
      securityLogger.antivirus(
        antivirusResult.isInfected ? 'Malware detected' : 'File scanned successfully',
        {
          threats: antivirusResult.threats,
          scanTime: antivirusResult.scanTime,
          warnings: antivirusResult.warnings
        },
        {
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype
        },
        user.userId
      );
    }

    // Preparar respuesta
    const response: any = {
      message: 'Archivo subido exitosamente',
      file: newDbFile
    };

    // Incluir advertencias de seguridad si las hay
    if (securityWarnings && securityWarnings.length > 0) {
      response.warnings = securityWarnings;
      response.message += ' (con advertencias de seguridad)';
    }

    res.status(201).json(response);

  } catch (error: any) {
    console.error('Error detallado al subir el archivo:', error);
    securityLogger.error(
      'File upload failed',
      error,
      req.user?.userId,
      req.ip
    );
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    
    res.status(500).json({ 
      message: 'Error interno del servidor al subir el archivo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}; 