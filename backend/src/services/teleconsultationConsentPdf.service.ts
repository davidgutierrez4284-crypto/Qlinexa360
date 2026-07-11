import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { uploadBufferToS3 } from '../utils/file.utils';

const prisma = new PrismaClient();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';

export interface TeleconsultationConsentData {
  patientFullName: string;
  patientEmail: string;
  patientPhone: string;
  doctorFullName: string;
  doctorTitle: string;
  appointmentDate: string;
  appointmentTime: string;
  signature: string;
  signedAt: string;
  signedAtIso: string;
  consentIp: string;
  generatedAt: string;
  documentHash?: string;
}

export class TeleconsultationConsentPdfService {
  static async generateConsentPdf(data: TeleconsultationConsentData): Promise<{ buffer: Buffer; hash: string }> {
    const html = await this.generateHtml(data);
    const pdfBuffer = await this.generatePdf(html);
    const buffer = Buffer.from(pdfBuffer);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return { buffer, hash };
  }

  static async generateAndUpload(
    appointmentId: string,
    consentData: Omit<TeleconsultationConsentData, 'documentHash' | 'generatedAt' | 'signedAt' | 'signedAtIso'>
  ): Promise<{ url: string; hash: string; buffer: Buffer }> {
    const now = new Date();
    const signedAt = now.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'medium' });
    const signedAtIso = now.toISOString();
    const generatedAt = signedAtIso;

    const { buffer, hash } = await this.generateConsentPdf({
      ...consentData,
      signedAt,
      signedAtIso,
      generatedAt
    });

    const fileName = `teleconsulta_consent_${appointmentId}_${Date.now()}.pdf`;

    let url: string;
    if (BUCKET_NAME) {
      const { url: s3Url } = await uploadBufferToS3(
        buffer,
        'teleconsultation_consents',
        fileName,
        'application/pdf'
      );
      url = s3Url;
    } else {
      const dir = path.join(__dirname, '../../uploads/teleconsultation_consents');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buffer);
      url = filePath;
    }

    return { url, hash, buffer };
  }

  private static async generateHtml(data: TeleconsultationConsentData): Promise<string> {
    const templatePath = path.join(__dirname, '../templates/teleconsultation-consent-template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    return template(data);
  }

  private static async generatePdf(html: string): Promise<Buffer> {
    let browser;
    try {
      const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      };
      if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      }
      browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
        printBackground: true
      });
      return Buffer.from(pdfBuffer);
    } finally {
      if (browser) await browser.close();
    }
  }
}
