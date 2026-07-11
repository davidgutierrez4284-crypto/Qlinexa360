"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_REPLY_FOOTER = exports.sendEmailHtmlWithTextFallback = exports.sendEmailHtml = exports.fromAddresses = exports.sendEmail = exports.ZOHO_ORG_SMTP_HOST = void 0;
exports.getLastSmtpError = getLastSmtpError;
exports.isSmtpConfigured = isSmtpConfigured;
exports.formatSmtpError = formatSmtpError;
exports.verifySmtpConnection = verifySmtpConnection;
exports.escapeHtmlText = escapeHtmlText;
exports.escapeHtmlAttr = escapeHtmlAttr;
exports.emailButton = emailButton;
exports.emailInfoCard = emailInfoCard;
exports.emailInfoRow = emailInfoRow;
exports.emailLinkButtons = emailLinkButtons;
exports.brandedEmailLayout = brandedEmailLayout;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../config/env");
/** Zoho Mail con dominio propio usa smtppro.zoho.com (no smtp.zoho.com). */
exports.ZOHO_ORG_SMTP_HOST = 'smtppro.zoho.com';
let lastSmtpError = null;
function getLastSmtpError() {
    return lastSmtpError;
}
function isSmtpConfigured() {
    var _a, _b, _c;
    return !!(((_a = env_1.env.SMTP_HOST) === null || _a === void 0 ? void 0 : _a.trim()) && ((_b = env_1.env.SMTP_USER) === null || _b === void 0 ? void 0 : _b.trim()) && ((_c = env_1.env.SMTP_PASS) === null || _c === void 0 ? void 0 : _c.trim()));
}
/** Mensaje legible para operación / logs (sin credenciales). */
function formatSmtpError(error) {
    const msg = error instanceof Error ? error.message : String(error);
    if ((/550.*5\.4\.6/i.test(msg) || /unusual sending activity/i.test(msg)) &&
        /zoho|smtppro\.zoho/i.test(msg + ' ' + (env_1.env.SMTP_HOST || ''))) {
        return 'Zoho bloqueó el envío por actividad inusual (550 5.4.6). Desbloquea la cuenta en https://mail.zoho.com/UnblockMe';
    }
    if (/550.*5\.4\.6/i.test(msg) || /unusual sending activity/i.test(msg)) {
        return 'El servidor SMTP bloqueó el envío por actividad inusual (550 5.4.6). Si usas Zoho, desbloquea en https://mail.zoho.com/UnblockMe';
    }
    if (/535|authentication failed|invalid login/i.test(msg)) {
        return 'Credenciales SMTP inválidas (SMTP_USER / SMTP_PASS)';
    }
    if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|getaddrinfo/i.test(msg)) {
        return `No se pudo conectar al servidor SMTP (${env_1.env.SMTP_HOST || 'sin host'}): ${msg}`;
    }
    return msg;
}
function createSmtpTransporter() {
    return nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: parseInt(env_1.env.SMTP_PORT || '587', 10),
        secure: env_1.env.SMTP_SECURE === 'true',
        auth: {
            user: env_1.env.SMTP_USER,
            pass: env_1.env.SMTP_PASS,
        },
    });
}
let transporter = createSmtpTransporter();
async function verifySmtpConnection() {
    if (!isSmtpConfigured()) {
        return {
            ok: false,
            message: 'SMTP no configurado (faltan SMTP_HOST, SMTP_USER o SMTP_PASS)',
        };
    }
    try {
        await transporter.verify();
        return { ok: true, message: `Conexión SMTP verificada (${env_1.env.SMTP_HOST}:${env_1.env.SMTP_PORT || '587'})` };
    }
    catch (error) {
        lastSmtpError = formatSmtpError(error);
        return { ok: false, message: lastSmtpError };
    }
}
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
        lastSmtpError = formatSmtpError(error);
        console.error('Error al enviar email:', lastSmtpError, error);
        throw error;
    }
};
exports.sendEmail = sendEmail;
exports.fromAddresses = {
    noReply: env_1.env.SMTP_FROM_NOREPLY || env_1.env.SMTP_FROM || 'no-reply@qlinexa360.com',
    admin: env_1.env.SMTP_FROM_ADMIN || env_1.env.SMTP_FROM || 'admin@qlinexa360.com',
    legal: env_1.env.SMTP_FROM_LEGAL || env_1.env.SMTP_FROM || 'legal@qlinexa360.com',
};
const sendEmailHtml = async (to, subject, html, from, attachments, replyTo) => {
    try {
        await transporter.sendMail(Object.assign({ from: from || exports.fromAddresses.noReply, to,
            subject,
            html,
            attachments }, (replyTo ? { replyTo } : {})));
        return true;
    }
    catch (error) {
        lastSmtpError = formatSmtpError(error);
        console.error('Error al enviar email (HTML):', lastSmtpError, error);
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
        lastSmtpError = formatSmtpError(error);
        console.error('Error al enviar email (HTML+text):', lastSmtpError, error);
        return false;
    }
};
exports.sendEmailHtmlWithTextFallback = sendEmailHtmlWithTextFallback;
/* ------------------------------------------------------------------ */
/*  Diseño de correos de marca Qlinexa360 (reutilizable)              */
/*  Mismo lenguaje visual que el correo de facturas a doctores.        */
/* ------------------------------------------------------------------ */
/** Pie de página estándar para correos enviados desde no-reply. */
exports.NO_REPLY_FOOTER = 'Mensaje enviado automáticamente desde una dirección de solo notificaciones; por favor no respondas a este correo.';
/** Escapa texto para contenido HTML (no atributos). */
function escapeHtmlText(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
}
/** Escapa valores para atributos HTML (href, etc.). */
function escapeHtmlAttr(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;');
}
/** Botón de acción principal (compatible con clientes de correo). */
function emailButton(label, href) {
    const safeHref = escapeHtmlAttr(href);
    return `<div style="text-align:center;margin:26px 0;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
      <tr>
        <td align="center" bgcolor="#2563eb" style="border-radius:10px;background-color:#2563eb;mso-padding-alt:14px 32px;">
          <a href="${safeHref}" target="_blank" style="display:inline-block;background-color:#2563eb;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:15px;font-family:'Segoe UI',Arial,sans-serif;padding:14px 32px;border-radius:10px;border:1px solid #1e40af;line-height:1.2;">${label}</a>
        </td>
      </tr>
    </table>
  </div>`;
}
/** Tarjeta informativa con acento de color a la izquierda. */
function emailInfoCard(innerHtml, accent = '#2563eb', bg = '#f0f9ff') {
    return `<div style="background:${bg};padding:18px 20px;border-radius:12px;margin:22px 0;border-left:4px solid ${accent};">${innerHtml}</div>`;
}
/** Fila etiqueta/valor para usar dentro de una tarjeta informativa. */
function emailInfoRow(label, value) {
    return `<p style="margin:0 0 2px 0;color:#64748b;font-size:13px;">${label}</p>
    <p style="margin:0 0 14px 0;color:#0f172a;font-size:16px;font-weight:600;">${value}</p>`;
}
/** Botones secundarios (compartir, etc.) en fila. */
function emailLinkButtons(buttons) {
    const items = buttons.map((b) => {
        const c = b.color || '#2563eb';
        return `<a href="${b.href}" style="display:inline-block;margin:4px 6px;padding:10px 16px;border:2px solid ${c};color:${c};text-decoration:none;font-weight:600;font-size:13px;border-radius:8px;">${b.label}</a>`;
    }).join('');
    return `<div style="text-align:center;margin:16px 0;">${items}</div>`;
}
/**
 * Envuelve el contenido de un correo en el diseño de marca Qlinexa360:
 * encabezado con degradado, tarjeta blanca redondeada y pie de página.
 */
function brandedEmailLayout(opts) {
    const { subtitle, bodyHtml, footerNote } = opts;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:'Segoe UI', Arial, sans-serif; color:#1f2937; line-height:1.6; margin:0; padding:0; background-color:#eef2f7;">
  <div style="max-width:600px; margin:0 auto; padding:24px;">
    <div style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 24px rgba(2,6,23,0.08);">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td bgcolor="#1e40af" style="background-color:#1e40af;background:linear-gradient(135deg,#2563eb 0%,#1e40af 100%);padding:30px 28px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:26px;letter-spacing:0.5px;font-weight:700;">Qlinexa360</h1>
            ${subtitle ? `<p style="color:#ffffff;margin:8px 0 0 0;font-size:15px;font-weight:600;">${subtitle}</p>` : ''}
          </td>
        </tr>
      </table>
      <div style="padding:32px 28px;">
        ${bodyHtml}
      </div>
    </div>
    ${footerNote ? `<p style="text-align:center; color:#94a3b8; font-size:12px; margin:16px 0 0 0;">${footerNote}</p>` : ''}
  </div>
</body>
</html>`;
}
