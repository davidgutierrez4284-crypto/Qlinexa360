import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { uploadBufferToS3 } from '../utils/file.utils';

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || '';

export interface CaseShareConsentPdfData {
  patientName: string;
  patientEmail: string;
  caseLabel: string;
  ownerDoctorName: string;
  invitedDoctorName: string;
  signature: string;
  signedAt: string;
  signedAtIso: string;
  signedIp: string;
}

export class CaseShareConsentPdfService {
  static async generatePdfBuffer(data: CaseShareConsentPdfData): Promise<{ buffer: Buffer; hash: string }> {
    const templatePath = path.join(__dirname, '../templates/case-share-consent-template.html');
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateContent);
    const html = template(data);
    const buffer = await this.htmlToPdf(html);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return { buffer, hash };
  }

  static async generateAndUpload(
    inviteId: string,
    data: CaseShareConsentPdfData
  ): Promise<{ url: string; hash: string; buffer: Buffer }> {
    const { buffer, hash } = await this.generatePdfBuffer(data);
    const fileName = `case_share_consent_${inviteId}_${Date.now()}.pdf`;
    let url: string;
    if (BUCKET_NAME) {
      const { url: s3Url } = await uploadBufferToS3(buffer, 'case_share_consents', fileName, 'application/pdf');
      url = s3Url;
    } else {
      const dir = path.join(__dirname, '../../uploads/case_share_consents');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buffer);
      url = filePath;
    }
    return { url, hash, buffer };
  }

  private static async htmlToPdf(html: string): Promise<Buffer> {
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
