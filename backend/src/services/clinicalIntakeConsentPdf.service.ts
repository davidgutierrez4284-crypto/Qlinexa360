import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { FileCategory, PrismaClient } from '@prisma/client';
import { CONSENT_CONTENT } from './consentPdf.service';
import { uploadBufferToS3 } from '../utils/file.utils';

const prisma = new PrismaClient();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';

export interface ClinicalIntakeConsentParams {
  intakeId: string;
  doctorId: string;
  uploadedByUserId: string;
  patientId?: string | null;
  fullName: string;
  email: string;
  phone: string;
  signature: string;
  ipAddress: string;
  signedAt?: Date;
}

export interface ClinicalIntakeConsentPersistResult {
  fileId: string;
  url: string;
  hash: string;
  fileName: string;
  size: number;
}

export function mergeConsentFileIntoFormData(
  formData: unknown,
  file: { url: string; fileName: string; type: string; size: number; fileId: string }
): Record<string, unknown> {
  const fd =
    formData && typeof formData === 'object' && !Array.isArray(formData)
      ? { ...(formData as Record<string, unknown>) }
      : {};
  const attachments =
    fd.attachments && typeof fd.attachments === 'object' && !Array.isArray(fd.attachments)
      ? { ...(fd.attachments as Record<string, unknown>) }
      : {};
  const files =
    attachments.files && typeof attachments.files === 'object' && !Array.isArray(attachments.files)
      ? { ...(attachments.files as Record<string, unknown>) }
      : {};
  const key = 'CONSENT_DOCUMENT';
  const list = Array.isArray(files[key]) ? [...(files[key] as unknown[])] : [];
  list.push({
    url: file.url,
    fileName: file.fileName,
    type: file.type,
    size: file.size,
    fileId: file.fileId
  });
  files[key] = list;
  attachments.files = files;
  fd.attachments = attachments;
  return fd;
}

export class ClinicalIntakeConsentPdfService {
  static async generateAndPersist(
    params: ClinicalIntakeConsentParams
  ): Promise<ClinicalIntakeConsentPersistResult> {
    const signedAt = params.signedAt ?? new Date();
    const timestamp = signedAt.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'medium' });
    const isoTimestamp = signedAt.toISOString();
    const phone = String(params.phone || '').trim() || 'No indicado';

    const documents = Object.entries(CONSENT_CONTENT).map(([, doc]) => ({
      title: doc.title,
      content: doc.content
    }));

    const html = await this.generateHtml({
      documents,
      signature: params.signature,
      fullName: params.fullName,
      email: params.email,
      phone,
      timestamp,
      isoTimestamp,
      ipAddress: params.ipAddress || 'No registrada'
    });

    const pdfBuffer = await this.generatePdf(html);
    const hash = createHash('sha256').update(pdfBuffer).digest('hex');
    const fileName = `consentimientos_preconsulta_${params.intakeId}_${Date.now()}.pdf`;

    let url: string;
    if (BUCKET_NAME) {
      const uploadResult = await uploadBufferToS3(
        pdfBuffer,
        'consent_documents',
        fileName,
        'application/pdf'
      );
      url = uploadResult.url;
    } else {
      const uploadsDir = path.join(__dirname, '../../uploads/consent_documents');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, pdfBuffer);
      url = filePath;
    }

    const dbFile = await prisma.file.create({
      data: {
        fileName: 'Consentimientos_pre-consulta.pdf',
        fileType: 'application/pdf',
        size: pdfBuffer.length,
        url,
        category: FileCategory.CONSENT_DOCUMENT,
        uploadedById: params.uploadedByUserId,
        doctorId: params.doctorId,
        patientId: params.patientId || null,
        securityHash: hash
      }
    });

    return {
      fileId: dbFile.id,
      url,
      hash,
      fileName: dbFile.fileName,
      size: pdfBuffer.length
    };
  }

  private static async generateHtml(data: Record<string, unknown>): Promise<string> {
    const templatePath = path.join(__dirname, '../templates/clinical-intake-consent-template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent, { noEscape: true });
    return template(data);
  }

  private static async generatePdf(html: string): Promise<Buffer> {
    let browser;
    try {
      const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer'
        ]
      };
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        printBackground: true
      });
      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) await browser.close();
    }
  }
}
