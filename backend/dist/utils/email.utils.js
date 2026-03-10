"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailHtmlWithTextFallback = exports.sendEmailHtml = exports.fromAddresses = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
const transporter = nodemailer_1.default.createTransport({
    host: env_1.env.SMTP_HOST,
    port: parseInt(env_1.env.SMTP_PORT || '587'),
    secure: env_1.env.SMTP_SECURE === 'true',
    auth: {
        user: env_1.env.SMTP_USER,
        pass: env_1.env.SMTP_PASS
    }
});
const sendEmail = async (to, subject, text, from) => {
    try {
        await transporter.sendMail({
            from: from || env_1.env.SMTP_FROM || env_1.env.SMTP_FROM_NOREPLY,
            to,
            subject,
            text
        });
    }
    catch (error) {
        console.error('Error al enviar email:', error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
exports.fromAddresses = {
    noReply: env_1.env.SMTP_FROM_NOREPLY || env_1.env.SMTP_FROM || 'no-reply@qlinexa360.com',
    admin: env_1.env.SMTP_FROM_ADMIN || env_1.env.SMTP_FROM || 'admin@qlinexa360.com',
    legal: env_1.env.SMTP_FROM_LEGAL || env_1.env.SMTP_FROM || 'legal@qlinexa360.com',
};
const sendEmailHtml = async (to, subject, html, from, attachments) => {
    try {
        await transporter.sendMail({
            from: from || exports.fromAddresses.noReply,
            to,
            subject,
            html,
            attachments,
        });
        return true;
    }
    catch (error) {
        console.error('Error al enviar email (HTML):', error);
        return false;
    }
};
exports.sendEmailHtml = sendEmailHtml;
/** Envía email con HTML y texto plano (multipart/alternative). Útil cuando clientes como Zoho fallan al renderizar HTML. */
const sendEmailHtmlWithTextFallback = async (to, subject, html, text, from, attachments) => {
    try {
        await transporter.sendMail({
            from: from || exports.fromAddresses.noReply,
            to,
            subject,
            text,
            html,
            attachments,
        });
        return true;
    }
    catch (error) {
        console.error('Error al enviar email (HTML+text):', error);
        return false;
    }
};
exports.sendEmailHtmlWithTextFallback = sendEmailHtmlWithTextFallback;
