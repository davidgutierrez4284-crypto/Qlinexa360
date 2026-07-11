"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadInvoiceFileToStorage = uploadInvoiceFileToStorage;
exports.localPathFromStoredUrl = localPathFromStoredUrl;
exports.readInvoiceFile = readInvoiceFile;
exports.resolveInvoiceDownloadTarget = resolveInvoiceDownloadTarget;
exports.deleteStoredInvoiceFile = deleteStoredInvoiceFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const file_utils_1 = require("./file.utils");
async function uploadInvoiceFileToStorage(file, doctorId, kind) {
    if (process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME) {
        const { url } = await (0, file_utils_1.uploadToS3)(file, `invoices/${kind}`, doctorId);
        return url;
    }
    const uploadsDir = path_1.default.join(__dirname, '../../uploads/invoices');
    if (!fs_1.default.existsSync(uploadsDir))
        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
    const filePath = path_1.default.join(uploadsDir, `${Date.now()}-${file.originalname}`);
    fs_1.default.writeFileSync(filePath, file.buffer);
    return `/uploads/invoices/${path_1.default.basename(filePath)}`;
}
function localPathFromStoredUrl(storedUrl) {
    if (storedUrl.startsWith('http'))
        return storedUrl;
    return path_1.default.join(__dirname, '../../', storedUrl.replace(/^\//, ''));
}
async function readInvoiceFile(storedUrl) {
    if (!storedUrl)
        return null;
    if (storedUrl.startsWith('http')) {
        try {
            const { buffer, contentType } = await (0, file_utils_1.fetchBufferFromUrl)(storedUrl);
            const filename = path_1.default.basename(new URL(storedUrl).pathname) || 'factura';
            return {
                buffer,
                contentType: contentType || 'application/octet-stream',
                filename,
            };
        }
        catch (_a) {
            return null;
        }
    }
    const localPath = localPathFromStoredUrl(storedUrl);
    if (!fs_1.default.existsSync(localPath))
        return null;
    const buffer = fs_1.default.readFileSync(localPath);
    const contentType = storedUrl.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'application/xml';
    return { buffer, contentType, filename: path_1.default.basename(localPath) };
}
async function resolveInvoiceDownloadTarget(storedUrl) {
    if (!storedUrl)
        return null;
    if (storedUrl.startsWith('http')) {
        const signed = await (0, file_utils_1.getS3SignedUrlIfExists)(storedUrl, 60 * 60);
        if (!signed)
            return null;
        return { type: 'redirect', url: signed };
    }
    const localPath = localPathFromStoredUrl(storedUrl);
    if (!fs_1.default.existsSync(localPath))
        return null;
    const contentType = storedUrl.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : 'application/xml';
    return { type: 'file', path: path_1.default.resolve(localPath), contentType };
}
async function deleteStoredInvoiceFile(storedUrl) {
    if (!storedUrl)
        return;
    try {
        if (storedUrl.startsWith('http')) {
            await (0, file_utils_1.deleteFromS3)(storedUrl);
            return;
        }
        const localPath = localPathFromStoredUrl(storedUrl);
        if (fs_1.default.existsSync(localPath))
            fs_1.default.unlinkSync(localPath);
    }
    catch (_a) {
        // no bloquear borrado en BD
    }
}
