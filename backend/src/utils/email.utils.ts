import nodemailer from 'nodemailer';
import { env } from '../config/env';
import type { Attachment } from 'nodemailer/lib/mailer';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT || '587'),
  secure: env.SMTP_SECURE === 'true',
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

export const sendEmail = async (to: string, subject: string, text: string, from?: string) => {
  try {
    await transporter.sendMail({
      from: from || env.SMTP_FROM || env.SMTP_FROM_NOREPLY,
      to,
      subject,
      text
    });
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
}; 

export const fromAddresses = {
  noReply: env.SMTP_FROM_NOREPLY || env.SMTP_FROM || 'no-reply@qlinexa360.com',
  admin: env.SMTP_FROM_ADMIN || env.SMTP_FROM || 'admin@qlinexa360.com',
  legal: env.SMTP_FROM_LEGAL || env.SMTP_FROM || 'legal@qlinexa360.com',
};

export const sendEmailHtml = async (
  to: string,
  subject: string,
  html: string,
  from?: string,
  attachments?: Attachment[]
) => {
  try {
    await transporter.sendMail({
      from: from || fromAddresses.noReply,
      to,
      subject,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    console.error('Error al enviar email (HTML):', error);
    return false;
  }
};

/** Envía email con HTML y texto plano (multipart/alternative). Útil cuando clientes como Zoho fallan al renderizar HTML. */
export const sendEmailHtmlWithTextFallback = async (
  to: string,
  subject: string,
  html: string,
  text: string,
  from?: string,
  attachments?: Attachment[]
) => {
  try {
    await transporter.sendMail({
      from: from || fromAddresses.noReply,
      to,
      subject,
      text,
      html,
      attachments,
    });
    return true;
  } catch (error) {
    console.error('Error al enviar email (HTML+text):', error);
    return false;
  }
};