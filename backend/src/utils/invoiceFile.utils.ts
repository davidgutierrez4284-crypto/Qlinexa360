import fs from 'fs';
import path from 'path';
import {
  deleteFromS3,
  fetchBufferFromUrl,
  getS3SignedUrlIfExists,
  uploadToS3,
} from './file.utils';

export async function uploadInvoiceFileToStorage(
  file: Express.Multer.File,
  doctorId: string,
  kind: 'pdf' | 'xml'
): Promise<string> {
  if (process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME) {
    const { url } = await uploadToS3(file, `invoices/${kind}`, doctorId);
    return url;
  }

  const uploadsDir = path.join(__dirname, '../../uploads/invoices');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, `${Date.now()}-${file.originalname}`);
  fs.writeFileSync(filePath, file.buffer);
  return `/uploads/invoices/${path.basename(filePath)}`;
}

export function localPathFromStoredUrl(storedUrl: string): string {
  if (storedUrl.startsWith('http')) return storedUrl;
  return path.join(__dirname, '../../', storedUrl.replace(/^\//, ''));
}

export async function readInvoiceFile(storedUrl: string): Promise<{
  buffer: Buffer;
  contentType: string;
  filename: string;
} | null> {
  if (!storedUrl) return null;

  if (storedUrl.startsWith('http')) {
    try {
      const { buffer, contentType } = await fetchBufferFromUrl(storedUrl);
      const filename = path.basename(new URL(storedUrl).pathname) || 'factura';
      return {
        buffer,
        contentType: contentType || 'application/octet-stream',
        filename,
      };
    } catch {
      return null;
    }
  }

  const localPath = localPathFromStoredUrl(storedUrl);
  if (!fs.existsSync(localPath)) return null;
  const buffer = fs.readFileSync(localPath);
  const contentType = storedUrl.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : 'application/xml';
  return { buffer, contentType, filename: path.basename(localPath) };
}

export async function resolveInvoiceDownloadTarget(
  storedUrl: string
): Promise<{ type: 'redirect'; url: string } | { type: 'file'; path: string; contentType: string } | null> {
  if (!storedUrl) return null;

  if (storedUrl.startsWith('http')) {
    const signed = await getS3SignedUrlIfExists(storedUrl, 60 * 60);
    if (!signed) return null;
    return { type: 'redirect', url: signed };
  }

  const localPath = localPathFromStoredUrl(storedUrl);
  if (!fs.existsSync(localPath)) return null;
  const contentType = storedUrl.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : 'application/xml';
  return { type: 'file', path: path.resolve(localPath), contentType };
}

export async function deleteStoredInvoiceFile(storedUrl: string): Promise<void> {
  if (!storedUrl) return;
  try {
    if (storedUrl.startsWith('http')) {
      await deleteFromS3(storedUrl);
      return;
    }
    const localPath = localPathFromStoredUrl(storedUrl);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  } catch {
    // no bloquear borrado en BD
  }
}
