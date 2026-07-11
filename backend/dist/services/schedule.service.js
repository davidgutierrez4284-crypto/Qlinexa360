"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleService = void 0;
const client_1 = require("@prisma/client");
const date_utils_1 = require("../utils/date.utils");
const prisma = new client_1.PrismaClient();
const DEFAULT_TIMEZONE = process.env.PRACTICE_TIMEZONE || 'America/Mexico_City';
const ACTIVE_CONFIRMATION_STATUSES = ['PENDING', 'CONFIRMED', 'RESCHEDULED'];
class ScheduleService {
    // Obtener configuración de horarios del doctor
    static async getScheduleConfig(doctorId) {
        try {
            // Buscar configuración en la base de datos
            const scheduleConfig = await prisma.doctorScheduleConfig.findUnique({
                where: { doctorId }
            });
            if (scheduleConfig) {
                // Convertir el formato de la base de datos al formato esperado
                const weeklySchedule = scheduleConfig.weeklySchedule;
                const normalizedSchedule = {
                    monday: [],
                    tuesday: [],
                    wednesday: [],
                    thursday: [],
                    friday: [],
                    saturday: [],
                    sunday: []
                };
                // Normalizar el schedule: soportar array de rangos { startTime, endTime } y formato legacy con timeSlots
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                days.forEach(day => {
                    const dayData = weeklySchedule[day];
                    if (Array.isArray(dayData)) {
                        normalizedSchedule[day] = dayData.map((range) => ({
                            startTime: (range.startTime || '09:00').substring(0, 5), // asegurar HH:MM
                            endTime: (range.endTime || '17:00').substring(0, 5),
                            isAvailable: true
                        }));
                    }
                    else if (dayData && typeof dayData === 'object' && 'timeSlots' in dayData) {
                        // Formato legacy: convertir timeSlots a rangos
                        const timeSlots = (dayData.timeSlots || []).filter((s) => s.available).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
                        const ranges = [];
                        let current = null;
                        for (const slot of timeSlots) {
                            const t = (slot.time || '09:00').substring(0, 5);
                            if (!current)
                                current = { startTime: t, endTime: t };
                            else {
                                const [ch, cm] = current.endTime.split(':').map(Number);
                                const [nh, nm] = t.split(':').map(Number);
                                const diffMin = (nh * 60 + nm) - (ch * 60 + cm);
                                if (diffMin === 30)
                                    current.endTime = t;
                                else {
                                    const endMin = ch * 60 + cm + 30;
                                    ranges.push(Object.assign(Object.assign({}, current), { isAvailable: true }));
                                    current = { startTime: t, endTime: t };
                                }
                            }
                        }
                        if (current) {
                            const [h, m] = current.endTime.split(':').map(Number);
                            const endMin = h * 60 + m + 30;
                            current.endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
                            ranges.push(Object.assign(Object.assign({}, current), { isAvailable: true }));
                        }
                        normalizedSchedule[day] = ranges;
                    }
                });
                return {
                    doctorId,
                    blockWeekends: false, // Ya no usamos blockWeekends, se maneja con weeklySchedule
                    appointmentDuration: scheduleConfig.appointmentDuration,
                    bufferTime: scheduleConfig.bufferTime,
                    weeklySchedule: normalizedSchedule
                };
            }
            // Si no hay configuración, retornar valores por defecto
            return {
                doctorId,
                blockWeekends: true,
                appointmentDuration: 30,
                bufferTime: 15,
                weeklySchedule: {
                    monday: [
                        { startTime: "09:00", endTime: "12:00", isAvailable: true },
                        { startTime: "14:00", endTime: "18:00", isAvailable: true }
                    ],
                    tuesday: [
                        { startTime: "09:00", endTime: "12:00", isAvailable: true },
                        { startTime: "14:00", endTime: "18:00", isAvailable: true }
                    ],
                    wednesday: [
                        { startTime: "09:00", endTime: "12:00", isAvailable: true },
                        { startTime: "14:00", endTime: "18:00", isAvailable: true }
                    ],
                    thursday: [
                        { startTime: "09:00", endTime: "12:00", isAvailable: true },
                        { startTime: "14:00", endTime: "18:00", isAvailable: true }
                    ],
                    friday: [
                        { startTime: "09:00", endTime: "12:00", isAvailable: true },
                        { startTime: "14:00", endTime: "18:00", isAvailable: true }
                    ],
                    saturday: [],
                    sunday: []
                }
            };
        }
        catch (error) {
            console.error('Error al obtener configuración de horarios:', error);
            return null;
        }
    }
    // Verificar si una fecha está disponible según la configuración
    static async isDateAvailable(doctorId, date) {
        try {
            const config = await this.getScheduleConfig(doctorId);
            if (!config)
                return false;
            const dayOfWeek = date.getDay(); // 0 = domingo, 1 = lunes, etc.
            const dayName = this.getDayName(dayOfWeek);
            // Si bloquea fines de semana y es fin de semana
            if (config.blockWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
                return false;
            }
            // Verificar si hay horarios configurados para ese día
            const daySchedule = config.weeklySchedule[dayName];
            if (!daySchedule || daySchedule.length === 0) {
                return false;
            }
            // Verificar si hay al menos un horario disponible
            return daySchedule.some(slot => slot.isAvailable);
        }
        catch (error) {
            console.error('Error al verificar disponibilidad de fecha:', error);
            return false;
        }
    }
    /**
     * Genera slots disponibles para una fecha en la zona horaria del doctor.
     * @param doctorId - ID del doctor
     * @param date - Fecha (solo se usa year, month, day)
     * @param timezone - Zona horaria del doctor (ej: America/Mexico_City). Si no se pasa, usa DEFAULT_TIMEZONE.
     */
    static async generateAvailableSlots(doctorId, date, timezone) {
        try {
            const config = await this.getScheduleConfig(doctorId);
            if (!config)
                return [];
            const tz = timezone || DEFAULT_TIMEZONE;
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();
            const dayOfWeek = date.getDay();
            const dayName = this.getDayName(dayOfWeek);
            const daySchedule = config.weeklySchedule[dayName];
            if (!daySchedule || daySchedule.length === 0) {
                return [];
            }
            const availableSlots = [];
            for (const timeSlot of daySchedule) {
                if (!timeSlot.isAvailable)
                    continue;
                const [startHour, startMinute] = timeSlot.startTime.split(':').map(Number);
                const [endHour, endMinute] = timeSlot.endTime.split(':').map(Number);
                const slotStart = (0, date_utils_1.createDateInTimezone)(year, month, day, startHour, startMinute, tz);
                const slotEnd = (0, date_utils_1.createDateInTimezone)(year, month, day, endHour, endMinute, tz);
                let currentSlot = new Date(slotStart);
                while (currentSlot < slotEnd) {
                    const slotEndTime = new Date(currentSlot.getTime() + config.appointmentDuration * 60000);
                    if (slotEndTime <= slotEnd) {
                        availableSlots.push(new Date(currentSlot));
                    }
                    currentSlot = new Date(currentSlot.getTime() + (config.appointmentDuration + config.bufferTime) * 60000);
                }
            }
            return availableSlots;
        }
        catch (error) {
            console.error('Error al generar slots disponibles:', error);
            return [];
        }
    }
    /**
     * Verifica si un horario (timestamp) está entre los slots disponibles.
     * @param doctorId - ID del doctor
     * @param slotTime - Momento exacto del slot (Date)
     * @param timezone - Zona horaria del doctor
     */
    static async isTimeSlotAvailable(doctorId, slotTime, timezone) {
        try {
            const tz = timezone || DEFAULT_TIMEZONE;
            const { year, month, day } = (0, date_utils_1.getDatePartsInTimezone)(slotTime, tz);
            const date = new Date(year, month, day);
            const availableSlots = await this.generateAvailableSlots(doctorId, date, tz);
            const slotMs = slotTime.getTime();
            return availableSlots.some(slot => Math.abs(slot.getTime() - slotMs) < 60000);
        }
        catch (error) {
            console.error('Error al verificar disponibilidad de horario:', error);
            return false;
        }
    }
    // Obtener nombre del día de la semana
    static getDayName(dayOfWeek) {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[dayOfWeek];
    }
    // Actualizar configuración de horarios
    static async updateScheduleConfig(config) {
        try {
            // TODO: Implementar guardado en base de datos
            console.log('Configuración de horarios actualizada:', config);
            return true;
        }
        catch (error) {
            console.error('Error al actualizar configuración de horarios:', error);
            return false;
        }
    }
    /** Parsea YYYY-MM-DD o Date a medianoche local. */
    static parseLocalDateOnly(dateInput) {
        if (dateInput instanceof Date) {
            const d = new Date(dateInput);
            d.setHours(0, 0, 0, 0);
            return d;
        }
        const dateParts = dateInput.split('-');
        if (dateParts.length === 3) {
            const d = new Date(parseInt(dateParts[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[2], 10));
            d.setHours(0, 0, 0, 0);
            return d;
        }
        const d = new Date(dateInput);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    /**
     * Slots reservables para un día según agenda compartida del doctor,
     * descontando citas activas y eventos ocupados del calendario interno.
     */
    static async getBookableSlotsForDate(doctorId, dateInput, options = {}) {
        try {
            const tz = options.timezone || DEFAULT_TIMEZONE;
            const targetDate = this.parseLocalDateOnly(dateInput);
            const isDateAvailable = await this.isDateAvailable(doctorId, targetDate);
            if (!isDateAvailable)
                return [];
            const scheduleConfig = await this.getScheduleConfig(doctorId);
            const appointmentDuration = (scheduleConfig === null || scheduleConfig === void 0 ? void 0 : scheduleConfig.appointmentDuration) || 30;
            const bufferTime = (scheduleConfig === null || scheduleConfig === void 0 ? void 0 : scheduleConfig.bufferTime) || 15;
            const slotDuration = appointmentDuration * 60000;
            const availableSlots = await this.generateAvailableSlots(doctorId, targetDate, tz);
            if (availableSlots.length === 0)
                return [];
            const dateStart = new Date(targetDate);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(targetDate);
            dateEnd.setHours(23, 59, 59, 999);
            const occupiedAppointments = await prisma.appointment.findMany({
                where: Object.assign(Object.assign({ doctorId }, (options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {})), { date: { gte: dateStart, lt: dateEnd }, status: { not: 'CANCELLED' }, confirmationStatus: { in: [...ACTIVE_CONFIRMATION_STATUSES] } }),
                select: { id: true, date: true }
            });
            const allEvents = await prisma.internalCalendarEvent.findMany({
                where: Object.assign(Object.assign({ doctorId }, (options.excludeEventId ? { id: { not: options.excludeEventId } } : {})), { fechaHoraInicio: { gte: dateStart, lte: dateEnd } }),
                include: {
                    patient: {
                        include: {
                            appointments: {
                                where: Object.assign(Object.assign({ doctorId }, (options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {})), { date: { gte: dateStart, lte: dateEnd }, status: { not: 'CANCELLED' }, confirmationStatus: { in: [...ACTIVE_CONFIRMATION_STATUSES] } }),
                                select: { id: true, date: true, confirmationStatus: true }
                            }
                        }
                    }
                }
            });
            const occupiedEvents = allEvents.filter(event => {
                var _a;
                if (!event.patientId || !event.patient)
                    return true;
                if ((_a = event.patient.appointments) === null || _a === void 0 ? void 0 : _a.length) {
                    const eventTime = event.fechaHoraInicio.getTime();
                    return event.patient.appointments.some(appointment => {
                        const appointmentTime = new Date(appointment.date).getTime();
                        return Math.abs(eventTime - appointmentTime) <= 30 * 60 * 1000;
                    });
                }
                return true;
            });
            const availableTimes = availableSlots.filter(slot => {
                const slotEnd = new Date(slot.getTime() + slotDuration);
                const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
                const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
                const hasAppointmentConflict = occupiedAppointments.some(appointment => {
                    const appointmentStart = new Date(appointment.date);
                    const appointmentEnd = new Date(appointmentStart.getTime() + slotDuration);
                    return ((slotStartWithBuffer < appointmentEnd && slotEndWithBuffer > appointmentStart) ||
                        (appointmentStart < slotEndWithBuffer && appointmentEnd > slotStartWithBuffer));
                });
                if (hasAppointmentConflict)
                    return false;
                return !occupiedEvents.some(event => {
                    const eventStart = new Date(event.fechaHoraInicio);
                    const eventEnd = new Date(event.fechaHoraFin);
                    return ((slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) ||
                        (eventStart < slotEndWithBuffer && eventEnd > slotStartWithBuffer));
                });
            });
            return availableTimes.map(slot => ({
                id: `slot_${slot.getTime()}`,
                startTime: slot.toISOString(),
                endTime: new Date(slot.getTime() + slotDuration).toISOString(),
                displayTime: (0, date_utils_1.formatAppointmentTime)(slot, tz)
            }));
        }
        catch (error) {
            console.error('Error al obtener slots reservables:', error);
            return [];
        }
    }
    /** Verifica si un instante coincide con un slot reservable de la agenda compartida. */
    static async isSlotBookable(doctorId, slotTime, options = {}) {
        try {
            const tz = options.timezone || DEFAULT_TIMEZONE;
            const { year, month, day } = (0, date_utils_1.getDatePartsInTimezone)(slotTime, tz);
            const date = new Date(year, month, day);
            const slots = await this.getBookableSlotsForDate(doctorId, date, options);
            const slotMs = slotTime.getTime();
            return slots.some(s => Math.abs(new Date(s.startTime).getTime() - slotMs) < 60000);
        }
        catch (error) {
            console.error('Error al verificar slot reservable:', error);
            return false;
        }
    }
    // Verificar conflictos con citas existentes
    static async checkAppointmentConflicts(doctorId, date, startTime, endTime) {
        try {
            // Crear copias de la fecha para evitar modificar el objeto original
            const dateStart = new Date(date);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(date);
            dateEnd.setHours(23, 59, 59, 999);
            const existingAppointments = await prisma.appointment.findMany({
                where: {
                    doctorId,
                    date: {
                        gte: dateStart,
                        lt: dateEnd
                    },
                    status: {
                        in: ['SCHEDULED', 'CONFIRMED']
                    },
                    // Excluir citas PENDING de la verificación de conflictos, ya que pueden ser rechazadas por el doctor
                    confirmationStatus: {
                        not: 'PENDING'
                    }
                }
            });
            // Verificar si hay conflictos de horario
            for (const appointment of existingAppointments) {
                const appointmentStart = new Date(appointment.date);
                const appointmentEnd = new Date(appointment.date.getTime() + 30 * 60000);
                // Verificar si hay solapamiento
                if ((startTime < appointmentEnd && endTime > appointmentStart) ||
                    (appointmentStart < endTime && appointmentEnd > startTime)) {
                    return true; // Hay conflicto
                }
            }
            return false; // No hay conflictos
        }
        catch (error) {
            console.error('Error al verificar conflictos de citas:', error);
            return true; // En caso de error, asumir que hay conflicto
        }
    }
}
exports.ScheduleService = ScheduleService;
