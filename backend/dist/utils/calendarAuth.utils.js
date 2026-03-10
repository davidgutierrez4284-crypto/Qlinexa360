"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyCalendarReconnectNeeded = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PROVIDER_LABELS = {
    google: 'Google Calendar',
    outlook: 'Outlook',
    apple: 'Apple Calendar',
    notion: 'Notion'
};
const notifyCalendarReconnectNeeded = async ({ doctorId, provider, reason }) => {
    try {
        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            select: {
                userId: true,
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        if (!(doctor === null || doctor === void 0 ? void 0 : doctor.userId)) {
            return;
        }
        const providerLabel = PROVIDER_LABELS[provider] || provider;
        const title = `Reconecta tu ${providerLabel}`;
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existing = await prisma.notification.findFirst({
            where: {
                userId: doctor.userId,
                type: client_1.NotificationType.SYSTEM_MESSAGE,
                title,
                createdAt: { gte: since }
            }
        });
        if (!existing) {
            await prisma.notification.create({
                data: {
                    userId: doctor.userId,
                    type: client_1.NotificationType.SYSTEM_MESSAGE,
                    title,
                    message: `Tu conexión con ${providerLabel} expiró o fue revocada. Entra a Configuración > Calendarios vinculados y vuelve a conectar.`,
                    data: {
                        provider,
                        reason: reason || null
                    }
                }
            });
        }
        await prisma.calendarSyncConfig.updateMany({
            where: {
                doctorId,
                provider
            },
            data: {
                error: reason || 'Se requiere reconectar el calendario.'
            }
        });
    }
    catch (error) {
        // Evitar que un fallo en notificación rompa el flujo principal
        console.error('Error notificando reconexión de calendario:', error);
    }
};
exports.notifyCalendarReconnectNeeded = notifyCalendarReconnectNeeded;
