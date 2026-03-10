"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetController = void 0;
const client_1 = require("@prisma/client");
const error_utils_1 = require("../utils/error.utils");
const logger_utils_1 = require("../utils/logger.utils");
const notification_service_1 = require("../services/notification.service");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
class PasswordResetController {
    // Solicitar recuperación de contraseña
    static async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                throw new error_utils_1.AppError('Email es requerido', 400);
            }
            // Verificar que el usuario existe
            const user = await prisma.user.findUnique({
                where: { email: email.toLowerCase() }
            });
            if (!user) {
                // Por seguridad, no revelamos si el email existe o no
                logger_utils_1.securityLogger.info(`Password reset requested for non-existent email: ${email}`);
                return res.json({
                    message: 'Si el email existe en nuestra base de datos, recibirás un enlace de recuperación'
                });
            }
            // Generar token único y seguro
            const token = crypto_1.default.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
            // Eliminar tokens anteriores del usuario
            await prisma.passwordResetToken.deleteMany({
                where: { userId: user.id }
            });
            // Crear nuevo token
            await prisma.passwordResetToken.create({
                data: {
                    token,
                    userId: user.id,
                    email: user.email,
                    expiresAt
                }
            });
            // Enviar email de recuperación
            try {
                await notification_service_1.NotificationService.sendPasswordResetEmail(user.email, user.firstName, user.lastName, token);
                logger_utils_1.securityLogger.info(`Password reset email sent to ${user.email}`);
            }
            catch (emailError) {
                logger_utils_1.securityLogger.error(`Error sending password reset email to ${user.email}:`, emailError);
                throw new error_utils_1.AppError('Error enviando email de recuperación', 500);
            }
            res.json({
                message: 'Si el email existe en nuestra base de datos, recibirás un enlace de recuperación'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error in password reset request:', error);
            if (error instanceof error_utils_1.AppError) {
                res.status(error.statusCode).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }
    // Verificar token de recuperación
    static async verifyResetToken(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                throw new error_utils_1.AppError('Token es requerido', 400);
            }
            // Buscar token válido
            const resetToken = await prisma.passwordResetToken.findFirst({
                where: {
                    token,
                    used: false,
                    expiresAt: { gt: new Date() }
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });
            if (!resetToken) {
                throw new error_utils_1.AppError('Token inválido o expirado', 400);
            }
            res.json({
                message: 'Token válido',
                user: {
                    email: resetToken.user.email,
                    firstName: resetToken.user.firstName,
                    lastName: resetToken.user.lastName
                },
                purpose: resetToken.purpose || 'password_reset'
            });
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error verifying reset token:', error);
            if (error instanceof error_utils_1.AppError) {
                res.status(error.statusCode).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }
    // Resetear contraseña
    static async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                throw new error_utils_1.AppError('Token y nueva contraseña son requeridos', 400);
            }
            if (newPassword.length < 8) {
                throw new error_utils_1.AppError('La contraseña debe tener al menos 8 caracteres', 400);
            }
            // Buscar token válido
            const resetToken = await prisma.passwordResetToken.findFirst({
                where: {
                    token,
                    used: false,
                    expiresAt: { gt: new Date() }
                },
                include: {
                    user: true
                }
            });
            if (!resetToken) {
                throw new error_utils_1.AppError('Token inválido o expirado', 400);
            }
            // Encriptar nueva contraseña
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
            // Actualizar contraseña del usuario
            await prisma.user.update({
                where: { id: resetToken.userId },
                data: { password: hashedPassword }
            });
            // Marcar token como usado
            await prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: {
                    used: true,
                    usedAt: new Date()
                }
            });
            // Enviar email de confirmación
            try {
                await notification_service_1.NotificationService.sendPasswordChangedEmail(resetToken.user.email, resetToken.user.firstName, resetToken.user.lastName);
                logger_utils_1.securityLogger.info(`Password changed confirmation email sent to ${resetToken.user.email}`);
            }
            catch (emailError) {
                logger_utils_1.securityLogger.error(`Error sending password changed email to ${resetToken.user.email}:`, emailError);
                // No fallar el proceso si el email falla
            }
            logger_utils_1.securityLogger.info(`Password successfully reset for user: ${resetToken.user.email}`);
            const requiresConsent = resetToken.purpose === 'patient_setup';
            res.json(Object.assign({ message: 'Contraseña actualizada exitosamente' }, (requiresConsent && { requiresConsent: true })));
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error resetting password:', error);
            if (error instanceof error_utils_1.AppError) {
                res.status(error.statusCode).json({ error: error.message });
            }
            else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }
    // Limpiar tokens expirados (para mantenimiento)
    static async cleanupExpiredTokens() {
        try {
            const deletedCount = await prisma.passwordResetToken.deleteMany({
                where: {
                    OR: [
                        { expiresAt: { lt: new Date() } },
                        { used: true }
                    ]
                }
            });
            if (deletedCount.count > 0) {
                logger_utils_1.securityLogger.info(`Cleaned up ${deletedCount.count} expired/used password reset tokens`);
            }
        }
        catch (error) {
            logger_utils_1.securityLogger.error('Error cleaning up expired tokens:', error);
        }
    }
}
exports.PasswordResetController = PasswordResetController;
