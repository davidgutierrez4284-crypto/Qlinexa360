"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromS3 = exports.uploadBufferToS3 = exports.uploadToS3 = void 0;
exports.registerFileInDB = registerFileInDB;
exports.getS3SignedUrl = getS3SignedUrl;
exports.getS3SignedUrlIfExists = getS3SignedUrlIfExists;
exports.extractS3KeyFromUrl = extractS3KeyFromUrl;
exports.getS3ObjectHead = getS3ObjectHead;
exports.fetchBufferFromUrl = fetchBufferFromUrl;
exports.getS3Stream = getS3Stream;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const uuid_1 = require("uuid");
const s3ClientConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
};
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    s3ClientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
}
const s3Client = new client_s3_1.S3Client(s3ClientConfig);
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';
const uploadToS3 = async (file, category, userId) => {
    var _a;
    if (!BUCKET_NAME) {
        console.error("Error: La variable de entorno AWS_S3_BUCKET_NAME no está definida. La subida de archivos está deshabilitada.");
        throw new Error("El bucket de S3 no está configurado en el servidor.");
    }
    const fileExtension = file.originalname.split('.').pop();
    const key = `${category.toLowerCase()}/${userId}/${(0, uuid_1.v4)()}.${fileExtension}`;
    console.log('S3: Subiendo archivo a', category, 'con key:', key);
    console.log('S3: Bucket:', BUCKET_NAME, 'Region:', process.env.AWS_REGION);
    // Intentar subir con ACL público primero
    let command = new client_s3_1.PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read', // Hacer el objeto público para que sea accesible desde el navegador
    });
    try {
        await s3Client.send(command);
        console.log('S3: Archivo subido exitosamente con ACL público');
    }
    catch (aclError) {
        // Si falla por ACL, intentar sin ACL (asumiendo que el bucket tiene una política pública)
        console.warn('S3: Error al subir con ACL público, intentando sin ACL:', aclError.message);
        if (aclError.name === 'AccessControlListNotSupported' || ((_a = aclError.message) === null || _a === void 0 ? void 0 : _a.includes('ACL'))) {
            console.log('S3: El bucket no permite ACLs, subiendo sin ACL (asumiendo política de bucket pública)');
            command = new client_s3_1.PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: file.buffer,
                ContentType: file.mimetype,
                // Sin ACL - requiere que el bucket tenga una política que permita acceso público
            });
            try {
                await s3Client.send(command);
                console.log('S3: Archivo subido exitosamente sin ACL (usando política de bucket)');
            }
            catch (error) {
                console.error('S3: Error subiendo archivo sin ACL:', error);
                throw error;
            }
        }
        else {
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
    let publicUrl;
    if (region === 'us-east-1') {
        // us-east-1 usa un formato especial sin región en la URL
        publicUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    }
    else {
        // Otras regiones usan el formato estándar
        publicUrl = `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
    }
    console.log('S3: URL pública generada:', publicUrl);
    return { url: publicUrl, key: key };
};
exports.uploadToS3 = uploadToS3;
/**
 * Subir un buffer (ej: PDF generado) a S3.
 * Usado para PDFs de recetas que antes se guardaban en disco (ephemeral en ECS).
 */
const uploadBufferToS3 = async (buffer, category, fileName, contentType = 'application/pdf') => {
    if (!BUCKET_NAME) {
        throw new Error('El bucket de S3 no está configurado. Configure AWS_S3_BUCKET_NAME.');
    }
    const key = `${category.toLowerCase()}/${(0, uuid_1.v4)()}_${fileName}`;
    const region = process.env.AWS_REGION || 'us-east-1';
    const command = new client_s3_1.PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    });
    await s3Client.send(command);
    const publicUrl = region === 'us-east-1'
        ? `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`
        : `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;
    return { url: publicUrl, key };
};
exports.uploadBufferToS3 = uploadBufferToS3;
const deleteFromS3 = async (url) => {
    const key = extractS3KeyFromUrl(url);
    const command = new client_s3_1.DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    await s3Client.send(command);
};
exports.deleteFromS3 = deleteFromS3;
/**
 * Registra la metadata de un archivo subido en la tabla File
 * @param prisma PrismaClient
 * @param file Multer file
 * @param uploadedById string (userId)
 * @param context string (ej: 'profile_photo', 'tax_certificate', 'study', etc.)
 * @param options doctorId, patientId, doctorPatientId (opcionales)
 * @returns El registro File creado
 */
async function registerFileInDB(prisma, file, uploadedById, context, options) {
    return prisma.file.create({
        data: {
            url: file.url || '', // S3 URL, debe ser pasada por el controlador
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            uploadedById,
            doctorId: options === null || options === void 0 ? void 0 : options.doctorId,
            patientId: options === null || options === void 0 ? void 0 : options.patientId,
            doctorPatientId: options === null || options === void 0 ? void 0 : options.doctorPatientId,
            context
        }
    });
}
async function getS3SignedUrl(fileUrl, expiresInSeconds = 60 * 5) {
    const url = new URL(fileUrl);
    const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    const command = new client_s3_1.GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    return (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn: expiresInSeconds });
}
/** Obtiene URL firmada si el objeto existe en S3; null si NoSuchKey (archivo no encontrado en dev) */
async function getS3SignedUrlIfExists(fileUrl, expiresInSeconds = 60 * 5) {
    var _a;
    try {
        const url = new URL(fileUrl);
        const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
        await s3Client.send(new client_s3_1.HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        return getS3SignedUrl(fileUrl, expiresInSeconds);
    }
    catch (err) {
        const is404 = (err === null || err === void 0 ? void 0 : err.name) === 'NotFound' || ((_a = err === null || err === void 0 ? void 0 : err.$metadata) === null || _a === void 0 ? void 0 : _a.httpStatusCode) === 404 || (err === null || err === void 0 ? void 0 : err.Code) === 'NoSuchKey';
        if (is404)
            return null;
        throw err;
    }
}
/** Extrae el key de S3 desde una URL almacenada */
function extractS3KeyFromUrl(fileUrl) {
    try {
        const url = new URL(fileUrl);
        return url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    }
    catch (_a) {
        return fileUrl;
    }
}
/** Obtiene metadata del objeto S3 (tamaño, content-type) */
async function getS3ObjectHead(key) {
    var _a;
    const command = new client_s3_1.HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const head = await s3Client.send(command);
    return {
        contentLength: (_a = head.ContentLength) !== null && _a !== void 0 ? _a : 0,
        contentType: head.ContentType
    };
}
/**
 * Obtener buffer de una URL (S3 o HTTP pública).
 * Usado para logos en recetas cuando logoUrl está en S3.
 */
async function fetchBufferFromUrl(fileUrl) {
    var _a, e_1, _b, _c;
    try {
        const url = new URL(fileUrl);
        const isOurS3 = BUCKET_NAME && (url.hostname === `${BUCKET_NAME}.s3.amazonaws.com` ||
            url.hostname.includes(`${BUCKET_NAME}.s3.`));
        if (isOurS3 && BUCKET_NAME) {
            const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
            const response = await s3Client.send(new client_s3_1.GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
            const stream = response.Body;
            const chunks = [];
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = await stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) await _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return {
                buffer: Buffer.concat(chunks),
                contentType: response.ContentType
            };
        }
        // URL externa (otro S3, CDN, etc.): fetch HTTP
        const res = await fetch(fileUrl);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get('content-type') || undefined;
        return { buffer: Buffer.from(arrayBuffer), contentType };
    }
    catch (error) {
        console.error('Error fetching buffer from URL:', fileUrl, error);
        throw error;
    }
}
/** Stream de S3 con soporte Range para video seeking */
async function getS3Stream(key, range) {
    var _a, _b;
    const params = { Bucket: BUCKET_NAME, Key: key };
    if (range)
        params.Range = range;
    const response = await s3Client.send(new client_s3_1.GetObjectCommand(params));
    const stream = response.Body;
    const contentLength = Number((_a = response.ContentLength) !== null && _a !== void 0 ? _a : 0);
    const contentType = (_b = response.ContentType) !== null && _b !== void 0 ? _b : 'video/mp4';
    const contentRange = response.ContentRange;
    return {
        stream,
        contentLength,
        contentType,
        contentRange,
        isPartial: !!range && !!contentRange
    };
}
