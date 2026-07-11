"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.env = {
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
    /** URL del SPA (ej. https://www.qlinexa360.com en prod). Evitar solo qlinexa360.com sin www si no hay DNS en el apex. */
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    /** URL HTTPS pública del SPA para back_urls de Mercado Pago (ej. túnel ngrok al :5173). Opcional en local. */
    FRONTEND_PUBLIC_URL: process.env.FRONTEND_PUBLIC_URL || '',
    /** URL https:// para prueba de TLS en export HU-01 (ej. https://app.qlinexa360.com). Si vacío, se usa FRONTEND_URL. */
    AUDIT_EVIDENCE_HTTPS_URL: process.env.AUDIT_EVIDENCE_HTTPS_URL || '',
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    STUDY_MAX_FILES_PER_USER: parseInt(process.env.STUDY_MAX_FILES_PER_USER || '20', 10),
    /** Token para acceder a reportes admin (header X-Admin-Report-Token). Configurar en Secrets Manager. */
    ADMIN_REPORT_TOKEN: process.env.ADMIN_REPORT_TOKEN || '',
    /** Token alternativo solo para seed (POST /api/admin/seed-prod). Opcional. */
    SEED_TOKEN: process.env.SEED_TOKEN || '',
    /** Solo desarrollo: si true, permite login sin 2FA (usuarios con email inexistente). NUNCA usar en producción. */
    DISABLE_2FA_DEV: process.env.DISABLE_2FA_DEV === 'true',
    BASE_URL: process.env.BASE_URL || process.env.API_URL || 'http://localhost:3000',
    MERCADOPAGO_CLIENT_ID: process.env.MERCADOPAGO_CLIENT_ID || '',
    MERCADOPAGO_CLIENT_SECRET: process.env.MERCADOPAGO_CLIENT_SECRET || '',
    MERCADOPAGO_REDIRECT_URI: process.env.MERCADOPAGO_REDIRECT_URI ||
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/payments/mercadopago/callback`,
    MERCADOPAGO_WEBHOOK_SECRET: process.env.MERCADOPAGO_WEBHOOK_SECRET || '',
    MERCADOPAGO_PLATFORM_ACCESS_TOKEN: process.env.MERCADOPAGO_PLATFORM_ACCESS_TOKEN || '',
    MERCADOPAGO_AUTH_BASE_URL: process.env.MERCADOPAGO_AUTH_BASE_URL || 'https://auth.mercadopago.com.mx',
    MERCADOPAGO_ENV: (process.env.MERCADOPAGO_ENV || 'sandbox'),
    QLINEXA360_MARKETPLACE_FEE_PERCENTAGE: parseFloat(process.env.QLINEXA360_MARKETPLACE_FEE_PERCENTAGE || '1'),
};
