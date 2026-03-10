import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
  AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_SECURE: process.env.SMTP_SECURE,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_FROM_NOREPLY: process.env.SMTP_FROM_NOREPLY,
  SMTP_FROM_ADMIN: process.env.SMTP_FROM_ADMIN,
  SMTP_FROM_LEGAL: process.env.SMTP_FROM_LEGAL,
  WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY,
  WHATSAPP_PHONE_NUMBER: process.env.WHATSAPP_PHONE_NUMBER,
  // Variables de entorno faltantes
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  STUDY_MAX_FILES_PER_USER: parseInt(process.env.STUDY_MAX_FILES_PER_USER || '20', 10),
  /** Token para acceder a reportes admin (header X-Admin-Report-Token). Configurar en Secrets Manager. */
  ADMIN_REPORT_TOKEN: process.env.ADMIN_REPORT_TOKEN || '',
  /** Token alternativo solo para seed (POST /api/admin/seed-prod). Opcional. */
  SEED_TOKEN: process.env.SEED_TOKEN || '',
  /** Solo desarrollo: si true, permite login sin 2FA (usuarios con email inexistente). NUNCA usar en producción. */
  DISABLE_2FA_DEV: process.env.DISABLE_2FA_DEV === 'true',
}; 