import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3ClientConfig: ConstructorParameters<typeof S3Client>[0] = {
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

export const uploadToS3 = async (file: Express.Multer.File, category: string, userId: string): Promise<{ url: string, key: string }> => {
  if (!BUCKET_NAME) {
    console.error("Error: La variable de entorno AWS_S3_BUCKET_NAME no está definida. La subida de archivos está deshabilitada.");
    throw new Error("El bucket de S3 no está configurado en el servidor.");
  }
  
  const fileExtension = file.originalname.split('.').pop();
  const key = `${category.toLowerCase()}/${userId}/${uuidv4()}.${fileExtension}`;

  console.log('S3: Subiendo archivo a', category, 'con key:', key);
  console.log('S3: Bucket:', BUCKET_NAME, 'Region:', process.env.AWS_REGION);

  // Intentar subir con ACL público primero
  let command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'public-read', // Hacer el objeto público para que sea accesible desde el navegador
  });

  try {
    await s3Client.send(command);
    console.log('S3: Archivo subido exitosamente con ACL público');
  } catch (aclError: any) {
    // Si falla por ACL, intentar sin ACL (asumiendo que el bucket tiene una política pública)
    console.warn('S3: Error al subir con ACL público, intentando sin ACL:', aclError.message);
    if (aclError.name === 'AccessControlListNotSupported' || aclError.message?.includes('ACL')) {
      console.log('S3: El bucket no permite ACLs, subiendo sin ACL (asumiendo política de bucket pública)');
      command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // Sin ACL - requiere que el bucket tenga una política que permita acceso público
      });
      
      try {
        await s3Client.send(command);
        console.log('S3: Archivo subido exitosamente sin ACL (usando política de bucket)');
      } catch (error: any) {
        console.error('S3: Error subiendo archivo sin ACL:', error);
        throw error;
      }
    } else {
      // Si es otro error, lanzarlo
      console.error('S3: Error subiendo archivo:', aclError);
      throw aclError;
    }
  }

  // Generar URL pública
  // Formato de URL: https://bucket-name.s3.region.amazonaws.com/key
  // Para buckets en algunas regiones, el formato puede ser: https://bucket-name.s3-region.amazonaws.com/key
  const region = process.env.AWS_REGION || 'us-east-1';
  
  // Detectar si la región requiere un formato de URL diferente
  // Algunas regiones usan s3.region.amazonaws.com, otras usan s3-region.amazonaws.com
  let publicUrl: string;
  if (region === 'us-east-1') {
    // us-east-1 usa un formato especial sin región en la URL
    publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
  } else {
    // Otras regiones usan el formato estándar
    publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
  }

  console.log('S3: URL pública generada:', publicUrl);

  return { url: publicUrl, key: key };
};

/**
 * Subir un buffer (ej: PDF generado) a S3.
 * Usado para PDFs de recetas que antes se guardaban en disco (ephemeral en ECS).
 */
export const uploadBufferToS3 = async (
  buffer: Buffer,
  category: string,
  fileName: string,
  contentType = 'application/pdf'
): Promise<{ url: string; key: string }> => {
  if (!BUCKET_NAME) {
    throw new Error('El bucket de S3 no está configurado. Configure AWS_S3_BUCKET_NAME.');
  }
  const key = `${category.toLowerCase()}/${uuidv4()}_${fileName}`;
  const region = process.env.AWS_REGION || 'us-east-1';

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const publicUrl =
    region === 'us-east-1'
      ? `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
      : `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;

  return { url: publicUrl, key };
};

export const deleteFromS3 = async (url: string): Promise<void> => {
  const key = extractS3KeyFromUrl(url);

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Registra la metadata de un archivo subido en la tabla File
 * @param prisma PrismaClient
 * @param file Multer file
 * @param uploadedById string (userId)
 * @param context string (ej: 'profile_photo', 'tax_certificate', 'study', etc.)
 * @param options doctorId, patientId, doctorPatientId (opcionales)
 * @returns El registro File creado
 */
export async function registerFileInDB(prisma: any, file: Express.Multer.File, uploadedById: string, context: string, options?: { doctorId?: string, patientId?: string, doctorPatientId?: string }) {
  return prisma.file.create({
    data: {
      url: (file as any).url || '', // S3 URL, debe ser pasada por el controlador
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById,
      doctorId: options?.doctorId,
      patientId: options?.patientId,
      doctorPatientId: options?.doctorPatientId,
      context
    }
  });
}

export async function getS3SignedUrl(fileUrl: string, expiresInSeconds: number = 60 * 5): Promise<string> {
  const url = new URL(fileUrl);
  const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/** Obtiene URL firmada si el objeto existe en S3; null si NoSuchKey (archivo no encontrado en dev) */
export async function getS3SignedUrlIfExists(fileUrl: string, expiresInSeconds: number = 60 * 5): Promise<string | null> {
  try {
    const url = new URL(fileUrl);
    const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return getS3SignedUrl(fileUrl, expiresInSeconds);
  } catch (err: any) {
    const is404 = err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404 || err?.Code === 'NoSuchKey';
    if (is404) return null;
    throw err;
  }
}

/** Extrae el key de S3 desde una URL almacenada */
export function extractS3KeyFromUrl(fileUrl: string): string {
  try {
    const url = new URL(fileUrl);
    return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
  } catch {
    return fileUrl;
  }
}

/** Obtiene metadata del objeto S3 (tamaño, content-type) */
export async function getS3ObjectHead(key: string): Promise<{ contentLength: number; contentType?: string }> {
  const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  const head = await s3Client.send(command);
  return {
    contentLength: head.ContentLength ?? 0,
    contentType: head.ContentType
  };
}

/**
 * Obtener buffer de una URL (S3 o HTTP pública).
 * Usado para logos en recetas cuando logoUrl está en S3.
 */
export async function fetchBufferFromUrl(fileUrl: string): Promise<{ buffer: Buffer; contentType?: string }> {
  try {
    const url = new URL(fileUrl);
    const isOurS3 = BUCKET_NAME && (
      url.hostname === `${BUCKET_NAME}.s3.amazonaws.com` ||
      url.hostname.includes(`${BUCKET_NAME}.s3.`)
    );

    if (isOurS3 && BUCKET_NAME) {
      const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      const response = await s3Client.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType
      };
    }

    // URL externa (otro S3, CDN, etc.): fetch HTTP
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || undefined;
    return { buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    console.error('Error fetching buffer from URL:', fileUrl, error);
    throw error;
  }
}

/** Stream de S3 con soporte Range para video seeking */
export async function getS3Stream(
  key: string,
  range?: string
): Promise<{ stream: Readable; contentLength: number; contentType: string; contentRange?: string; isPartial: boolean }> {
  const params: { Bucket: string; Key: string; Range?: string } = { Bucket: BUCKET_NAME, Key: key };
  if (range) params.Range = range;
  const response = await s3Client.send(new GetObjectCommand(params));
  const stream = response.Body as Readable;
  const contentLength = Number(response.ContentLength ?? 0);
  const contentType = response.ContentType ?? 'video/mp4';
  const contentRange = (response as any).ContentRange as string | undefined;
  return {
    stream,
    contentLength,
    contentType,
    contentRange,
    isPartial: !!range && !!contentRange
  };
} 