"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class ReminderController {
    // Obtener configuración de recordatorios del doctor
    static async getReminderConfig(req, res) {
        var _a;
        try {
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            let doctorId = null;
            if (req.user.role === 'DOCTOR') {
                const doctor = await prisma.doctor.findUnique({
                    where: { userId: req.user.userId },
                    select: { id: true }
                });
                doctorId = (doctor === null || doctor === void 0 ? void 0 : doctor.id) || null;
            }
            else if (req.user.role === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ error: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true
                    },
                    select: { id: true }
                });
                if (!link) {
                    return res.status(403).json({ error: 'Asistente no vinculado a este doctor' });
                }
                doctorId = selectedDoctorId;
            }
            if (!doctorId) {
                return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
            }
            // Buscar configuración en la base de datos
            const reminderConfig = await prisma.reminderConfig.findUnique({
                where: { doctorId },
                include: {
                    reminders: {
                        orderBy: { daysBefore: 'desc' }
                    }
                }
            });
            if (reminderConfig) {
                // Convertir reminders a formato simple
                // Mapeo: daysBefore 7 = 1 semana, 2 = 48h, 1 = 24h, 0 = 4h
                const reminder1Week = reminderConfig.reminders.some(r => r.daysBefore === 7 && r.isActive);
                const reminder48h = reminderConfig.reminders.some(r => r.daysBefore === 2 && r.isActive);
                const reminder24h = reminderConfig.reminders.some(r => r.daysBefore === 1 && r.isActive);
                const reminder4h = reminderConfig.reminders.some(r => r.daysBefore === 0 && r.isActive);
                // El sistema está activado si hay al menos un recordatorio activo
                const enabled = reminderConfig.reminders.some(r => r.isActive);
                return res.json({
                    success: true,
                    data: {
                        enabled,
                        reminder1Week,
                        reminder48h,
                        reminder24h,
                        reminder4h,
                        useEmail: reminderConfig.useEmail,
                        useWhatsApp: reminderConfig.useWhatsApp
                    }
                });
            }
            // Si no hay configuración, retornar valores por defecto
            return res.json({
                success: true,
                data: {
                    enabled: false,
                    reminder1Week: false,
                    reminder48h: false,
                    reminder24h: false,
                    reminder4h: false,
                    useEmail: true,
                    useWhatsApp: true
                }
            });
        }
        catch (error) {
            console.error('Error al obtener configuración de recordatorios:', error);
            res.status(500).json({ error: 'Error interno del servidor' });
        }
    }
    // Actualizar configuración de recordatorios del doctor
    static async updateReminderConfig(req, res) {
        var _a;
        try {
            if (!((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId)) {
                return res.status(401).json({ error: 'No autorizado' });
            }
            const { enabled, reminder1Week, reminder48h, reminder24h, reminder4h, useEmail, useWhatsApp } = req.body;
            let doctorId;
            if (req.user.role === 'DOCTOR') {
                const doctor = await prisma.doctor.findUnique({
                    where: { userId: req.user.userId },
                    select: { id: true }
                });
                if (!doctor) {
                    return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
                }
                doctorId = doctor.id;
            }
            else if (req.user.role === 'ASISTENTE') {
                const selectedDoctorId = req.headers['x-selected-doctor-id'];
                if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
                    return res.status(400).json({ error: 'Doctor seleccionado requerido' });
                }
                const link = await prisma.asistenteDoctorVinculo.findFirst({
                    where: {
                        doctorId: selectedDoctorId,
                        asistenteId: req.user.userId,
                        activo: true
                    },
                    select: { id: true }
                });
                if (!link) {
                    return res.status(403).json({ error: 'Asistente no vinculado a este doctor' });
                }
                doctorId = selectedDoctorId;
            }
            else {
                return res.status(403).json({ error: 'Solo doctores y asistentes pueden actualizar la configuración' });
            }
            // Buscar o crear configuración
            let reminderConfig = await prisma.reminderConfig.findUnique({
                where: { doctorId },
                include: { reminders: true }
            });
            if (!reminderConfig) {
                reminderConfig = await prisma.reminderConfig.create({
                    data: {
                        doctorId,
                        useEmail: useEmail !== undefined ? useEmail : true,
                        useWhatsApp: useWhatsApp !== undefined ? useWhatsApp : true
                    },
                    include: { reminders: true }
                });
            }
            else {
                // Actualizar configuración base
                await prisma.reminderConfig.update({
                    where: { id: reminderConfig.id },
                    data: {
                        useEmail: useEmail !== undefined ? useEmail : reminderConfig.useEmail,
                        useWhatsApp: useWhatsApp !== undefined ? useWhatsApp : reminderConfig.useWhatsApp
                    }
                });
            }
            // Si enabled es false, desactivar todos los recordatorios primero
            if (enabled === false) {
                await prisma.reminder.updateMany({
                    where: { reminderConfigId: reminderConfig.id },
                    data: { isActive: false }
                });
            }
            else {
                // Si enabled es true, procesar los recordatorios individuales
                const reminderMap = [
                    { key: 'reminder1Week', daysBefore: 7 }, // 1 semana = 7 días
                    { key: 'reminder48h', daysBefore: 2 }, // 48 horas = 2 días
                    { key: 'reminder24h', daysBefore: 1 }, // 24 horas = 1 día
                    { key: 'reminder4h', daysBefore: 0 } // 4 horas = 0 días (el sistema debe verificar horas)
                ];
                // Actualizar o crear recordatorios
                for (const { key, daysBefore } of reminderMap) {
                    const isActive = req.body[key] === true;
                    const existingReminder = reminderConfig.reminders.find(r => r.daysBefore === daysBefore);
                    if (existingReminder) {
                        // Actualizar recordatorio existente
                        await prisma.reminder.update({
                            where: { id: existingReminder.id },
                            data: { isActive }
                        });
                    }
                    else if (isActive) {
                        // Crear nuevo recordatorio solo si está activo
                        await prisma.reminder.create({
                            data: {
                                reminderConfigId: reminderConfig.id,
                                daysBefore,
                                isActive: true
                            }
                        });
                    }
                }
                // Si enabled es true pero no hay recordatorios activos después de procesar, activar el de 24h por defecto
                const updatedReminders = await prisma.reminder.findMany({
                    where: { reminderConfigId: reminderConfig.id }
                });
                const hasAnyActive = updatedReminders.some(r => r.isActive);
                if (!hasAnyActive) {
                    // Activar el recordatorio de 24 horas por defecto
                    const reminder24h = updatedReminders.find(r => r.daysBefore === 1);
                    if (reminder24h) {
                        await prisma.reminder.update({
                            where: { id: reminder24h.id },
                            data: { isActive: true }
                        });
                    }
                    else {
                        // Crear el recordatorio de 24 horas si no existe
                        await prisma.reminder.create({
                            data: {
                                reminderConfigId: reminderConfig.id,
                                daysBefore: 1,
                                isActive: true
                            }
                        });
                    }
                }
            }
            // Obtener configuración actualizada
            const updatedConfig = await prisma.reminderConfig.findUnique({
                where: { id: reminderConfig.id },
                include: {
                    reminders: {
                        orderBy: { daysBefore: 'desc' }
                    }
                }
            });
            // Mapeo: daysBefore 7 = 1 semana, 2 = 48h, 1 = 24h, 0 = 4h
            const reminder1WeekActive = updatedConfig.reminders.some(r => r.daysBefore === 7 && r.isActive);
            const reminder48hActive = updatedConfig.reminders.some(r => r.daysBefore === 2 && r.isActive);
            const reminder24hActive = updatedConfig.reminders.some(r => r.daysBefore === 1 && r.isActive);
            const reminder4hActive = updatedConfig.reminders.some(r => r.daysBefore === 0 && r.isActive);
            const isEnabled = updatedConfig.reminders.some(r => r.isActive);
            res.json({
                success: true,
                data: {
                    enabled: isEnabled,
                    reminder1Week: reminder1WeekActive,
                    reminder48h: reminder48hActive,
                    reminder24h: reminder24hActive,
                    reminder4h: reminder4hActive,
                    useEmail: updatedConfig.useEmail,
                    useWhatsApp: updatedConfig.useWhatsApp
                }
            });
        }
        catch (error) {
            console.error('Error al actualizar configuración de recordatorios:', error);
            if (error.code === 'P2002') {
                res.status(400).json({ error: 'Ya existe una configuración para este doctor' });
            }
            else {
                res.status(500).json({ error: 'Error interno del servidor' });
            }
        }
    }
}
exports.ReminderController = ReminderController;
