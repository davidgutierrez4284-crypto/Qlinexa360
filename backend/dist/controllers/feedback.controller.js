"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitFeedback = void 0;
const client_1 = require("@prisma/client");
const error_utils_1 = require("../utils/error.utils");
const email_utils_1 = require("../utils/email.utils");
const prisma = new client_1.PrismaClient();
const ADMIN_EMAIL = 'admin@qlinexa360.com';
const submitFeedback = async (req, res) => {
    try {
        const { type, message, email: reporterEmail } = req.body;
        if (!type || !message) {
            throw new error_utils_1.AppError('Tipo y mensaje son requeridos.', 400);
        }
        if (type !== 'sugerencia' && type !== 'queja') {
            throw new error_utils_1.AppError('Tipo inválido. Debe ser "sugerencia" o "queja".', 400);
        }
        let userInfo;
        if (req.user) {
            // Usuario logeado: obtener datos del usuario enrolado
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                select: { firstName: true, lastName: true, email: true, phone: true },
            });
            if (!user) {
                throw new error_utils_1.AppError('Usuario no encontrado.', 404);
            }
            userInfo = {
                fullName: `${user.firstName} ${user.lastName}`.trim(),
                email: user.email,
                phone: user.phone || 'No registrado',
                source: 'enrolled',
            };
        }
        else {
            // Usuario NO logeado: requiere email en el body (externo a la plataforma)
            const emailTrimmed = typeof reporterEmail === 'string' ? reporterEmail.trim() : '';
            if (!emailTrimmed || !emailTrimmed.includes('@')) {
                throw new error_utils_1.AppError('Correo electrónico requerido para enviar sugerencias o quejas sin sesión iniciada.', 400);
            }
            userInfo = {
                fullName: 'Usuario externo (sin sesión)',
                email: emailTrimmed,
                phone: 'No registrado',
                source: 'external',
            };
        }
        const emailSubject = type === 'sugerencia'
            ? '[Qlinexa360] Sugerencia o recomendaciones'
            : '[Qlinexa360] Quejas';
        const sourceLabel = userInfo.source === 'enrolled' ? 'Usuario enrolado en la plataforma' : 'Usuario externo (sin sesión)';
        const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">${type === 'sugerencia' ? 'Sugerencia o recomendaciones' : 'Quejas'}</h2>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Información de quien reporta</h3>
          <p><strong>Origen:</strong> ${sourceLabel}</p>
          <p><strong>Nombre:</strong> ${userInfo.fullName}</p>
          <p><strong>Email:</strong> ${userInfo.email}</p>
          <p><strong>Teléfono:</strong> ${userInfo.phone}</p>
        </div>

        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #1f2937; margin-top: 0;">Mensaje</h3>
          <p style="white-space: pre-wrap; color: #374151;">${message}</p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p>Este correo fue generado automáticamente desde la plataforma Qlinexa360.</p>
          <p>Fecha: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</p>
        </div>
      </div>
    `;
        const emailSent = await (0, email_utils_1.sendEmailHtml)(ADMIN_EMAIL, emailSubject, emailBody, email_utils_1.fromAddresses.noReply);
        if (!emailSent) {
            throw new error_utils_1.AppError('Error al enviar el correo. Por favor intenta más tarde.', 500);
        }
        res.status(200).json({
            message: 'Tu mensaje ha sido enviado exitosamente.',
            success: true,
        });
    }
    catch (error) {
        console.error('Error en submitFeedback:', error);
        if (error instanceof error_utils_1.AppError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};
exports.submitFeedback = submitFeedback;
