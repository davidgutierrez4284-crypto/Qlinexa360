import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
// import { logger } from '../utils/logger.utils';
import { NotificationService } from '../services/notification.service';
import { ScheduleService } from '../services/schedule.service';
import { GoogleCalendarSyncService } from '../services/googleCalendarSync.service';
import { OutlookCalendarSyncService } from '../services/outlookCalendarSync.service';
import { AppleCalendarSyncService } from '../services/appleCalendarSync.service';
import { sendEmailHtml, fromAddresses } from '../utils/email.utils';
import { formatAppointmentTime, formatAppointmentTimeWithAmPm } from '../utils/date.utils';

const prisma = new PrismaClient();

export class AgendaPacientesController {
  // Obtener configuración de agenda del doctor
  static async getAgendaConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      let doctorId: string;
      let doctor: { id: string; user: { firstName: string; lastName: string } };

      if (req.user.role === 'DOCTOR') {
        const d = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
          include: { user: true }
        });
        if (!d) {
          return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
        }
        doctor = d;
        doctorId = d.id;
      } else if (req.user.role === 'ASISTENTE') {
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
        const d = await prisma.doctor.findUnique({
          where: { id: selectedDoctorId },
          include: { user: true }
        });
        if (!d) {
          return res.status(404).json({ error: 'Doctor no encontrado' });
        }
        doctor = d;
        doctorId = selectedDoctorId;
      } else {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const agendaConfig = await prisma.agendaPacientesLink.findFirst({
        where: { doctor_id: doctorId }
      });

      // Si existe configuración, verificar y corregir el link si es necesario
      let linkToReturn = agendaConfig?.link || null;
      if (agendaConfig && doctor.user) {
        // Generar el link correcto según el ambiente
        const cleanFirstName = doctor.user.firstName
          .toLowerCase()
          .replace(/^(dr\.?|doctor\.?|dra\.?|doctora\.?)\s*/i, '')
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        
        const cleanLastName = doctor.user.lastName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        
        const username = `${cleanFirstName}-${cleanLastName}`;
        
        // Determinar la URL correcta según el ambiente
        const correctFrontendUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.FRONTEND_URL || 'https://www.qlinexa360.com')
          : 'http://localhost:5173';
        
        const correctLink = `${correctFrontendUrl}/agendar/${username}`;
        
        // Si el link guardado es diferente al correcto, actualizarlo
        if (agendaConfig.link !== correctLink) {
          console.log('⚠️ Link de agendamiento incorrecto detectado, actualizando...');
          console.log('   Link anterior:', agendaConfig.link);
          console.log('   Link correcto:', correctLink);
          
          await prisma.agendaPacientesLink.update({
            where: { id: agendaConfig.id },
            data: { link: correctLink }
          });
          
          linkToReturn = correctLink;
          console.log('✅ Link actualizado correctamente');
        }
      }

      // Normalizar respuesta para usar snake_case consistentemente
      res.json({
        success: true,
        data: agendaConfig ? {
          esta_activo: agendaConfig.esta_activo || false,
          mensaje_custom: agendaConfig.mensaje_custom || '',
          link: linkToReturn
        } : {
          esta_activo: false,
          mensaje_custom: '',
          link: null
        }
      });
    } catch (error) {
      console.error('Error al obtener configuración de agenda:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar configuración de agenda
  static async updateAgendaConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { estaActivo, mensajeCustom } = req.body;

      let doctorId: string;
      let doctor: { id: string; user: { firstName: string; lastName: string } };

      if (req.user.role === 'DOCTOR') {
        const d = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
          include: { user: true }
        });
        if (!d) {
          return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
        }
        doctor = d;
        doctorId = d.id;
      } else if (req.user.role === 'ASISTENTE') {
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
        const d = await prisma.doctor.findUnique({
          where: { id: selectedDoctorId },
          include: { user: true }
        });
        if (!d) {
          return res.status(404).json({ error: 'Doctor no encontrado' });
        }
        doctor = d;
        doctorId = selectedDoctorId;
      } else {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      // Generar username único para el link (usar firstName-lastName en minúsculas, sin espacios)
      // Limpiar el firstName para remover títulos profesionales como "Dr.", "Dr", etc.
      const cleanFirstName = doctor.user.firstName
        .toLowerCase()
        .replace(/^(dr\.?|doctor\.?|dra\.?|doctora\.?)\s*/i, '') // Remover títulos al inicio
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''); // Solo letras, números y guiones
      
      const cleanLastName = doctor.user.lastName
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''); // Solo letras, números y guiones
      
      const username = `${cleanFirstName}-${cleanLastName}`;
      
      // Determinar la URL del frontend
      // Si NODE_ENV está explícitamente en 'production', usar FRONTEND_URL o la URL de producción
      // En cualquier otro caso (desarrollo, undefined, etc.), usar localhost:5173
      let frontendUrl: string;
      if (process.env.NODE_ENV === 'production') {
        // En producción, usar FRONTEND_URL si está configurado, sino la URL de producción
        frontendUrl = process.env.FRONTEND_URL || 'https://www.qlinexa360.com';
        console.log('🔧 Generando link de agendamiento en PRODUCCIÓN:', frontendUrl);
      } else {
        // En desarrollo, SIEMPRE usar localhost:5173 (ignorar FRONTEND_URL si está configurado)
        frontendUrl = 'http://localhost:5173';
        console.log('🔧 Generando link de agendamiento en DESARROLLO:', frontendUrl);
        console.log('   NODE_ENV:', process.env.NODE_ENV || 'undefined');
        console.log('   FRONTEND_URL (ignorado en dev):', process.env.FRONTEND_URL || 'no configurado');
      }
      
      const link = `${frontendUrl}/agendar/${username}`;
      console.log('   Link generado:', link);

      // Buscar si ya existe una configuración para este doctor
      const existingConfig = await prisma.agendaPacientesLink.findFirst({
        where: { doctor_id: doctorId }
      });

      let agendaConfig;
      if (existingConfig) {
        // Actualizar configuración existente
        agendaConfig = await prisma.agendaPacientesLink.update({
          where: { id: existingConfig.id },
          data: {
            esta_activo: estaActivo,
            mensaje_custom: mensajeCustom || '',
            link: link // Actualizar el link por si cambió la URL del frontend
          }
        });
      } else {
        // Crear nueva configuración
        agendaConfig = await prisma.agendaPacientesLink.create({
          data: {
            doctor_id: doctorId,
            esta_activo: estaActivo,
            mensaje_custom: mensajeCustom || '',
            link
          }
        });
      }

      // Normalizar respuesta para usar snake_case consistentemente
      res.json({
        success: true,
        data: {
          esta_activo: agendaConfig.esta_activo || false,
          mensaje_custom: agendaConfig.mensaje_custom || '',
          link: agendaConfig.link || null
        }
      });
    } catch (error: any) {
      console.error('Error al actualizar configuración de agenda:', error);
      if (error.code === 'P2002') {
        res.status(400).json({ error: 'Ya existe una configuración para este doctor' });
      } else if (error.code === 'P2025') {
        res.status(404).json({ error: 'Configuración no encontrada' });
      } else {
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    }
  }

  // Obtener información del doctor para el link público
  static async getDoctorInfo(req: Request, res: Response) {
    try {
      const { doctorUsername } = req.params;

      // Buscar el doctor por el link generado
      const agendaConfig = await prisma.agendaPacientesLink.findFirst({
        where: {
          link: {
            contains: doctorUsername
          },
          esta_activo: true
        },
        include: {
          Doctor: {
            include: {
              user: true
            }
          }
        }
      });

      if (!agendaConfig) {
        return res.status(404).json({ error: 'Link no encontrado o inactivo' });
      }

      // Obtener URL firmada de la foto de perfil si es necesario
      let profilePictureUrl = agendaConfig.Doctor.profilePictureUrl;
      if (profilePictureUrl && profilePictureUrl.includes('amazonaws.com')) {
        try {
          const { getS3SignedUrl } = require('../utils/file.utils');
          profilePictureUrl = await getS3SignedUrl(profilePictureUrl);
          console.log('✅ URL firmada de foto de perfil obtenida exitosamente');
        } catch (error) {
          console.error('Error al obtener URL firmada de foto de perfil:', error);
          // Si falla, usar la URL directa (puede que sea pública)
        }
      }

      res.json({
        success: true,
        data: {
          doctorName: `${agendaConfig.Doctor.professionalTitle} ${agendaConfig.Doctor.user.firstName} ${agendaConfig.Doctor.user.lastName}`,
          profilePicture: profilePictureUrl,
          mensajeCustom: agendaConfig.mensaje_custom,
          specialization: agendaConfig.Doctor.specialization
        }
      });
    } catch (error) {
      console.error('Error al obtener información del doctor:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener horarios disponibles del doctor
  static async getAvailableSlots(req: Request, res: Response) {
    try {
      const { doctorUsername } = req.params;
      const { fecha } = req.query;

      // Buscar el doctor por el link
      const agendaConfig = await prisma.agendaPacientesLink.findFirst({
        where: {
          link: {
            contains: doctorUsername
          },
          esta_activo: true
        },
        include: {
          Doctor: true
        }
      });

      if (!agendaConfig) {
        return res.status(404).json({ error: 'Link no encontrado o inactivo' });
      }

      const doctorId = agendaConfig.doctor_id;
      
      // Parsear la fecha correctamente (formato YYYY-MM-DD)
      // IMPORTANTE: Usar fecha local (no UTC) para que getDay() funcione correctamente
      let targetDate: Date;
      if (fecha) {
        const dateParts = (fecha as string).split('-');
        if (dateParts.length === 3) {
          // Crear fecha en zona horaria local para que getDay() funcione correctamente
          targetDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1, // Los meses son 0-indexed
            parseInt(dateParts[2])
          );
        } else {
          targetDate = new Date(fecha as string);
        }
      } else {
        targetDate = new Date();
      }

      // Asegurar que la fecha esté en medianoche local para comparaciones correctas
      targetDate.setHours(0, 0, 0, 0);

      const dayOfWeek = targetDate.getDay(); // 0 = domingo, 1 = lunes, etc.
      const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      console.log(`📅 Verificando disponibilidad para fecha: ${targetDate.toISOString().split('T')[0]} (${dayNames[dayOfWeek]}, día ${dayOfWeek})`);

      // Verificar si la fecha está disponible según la configuración
      const isDateAvailable = await ScheduleService.isDateAvailable(doctorId, targetDate);
      if (!isDateAvailable) {
        console.log(`❌ Fecha no disponible según configuración del doctor (${dayNames[dayOfWeek]} no está habilitado)`);
        return res.json({
          success: true,
          data: [],
          message: 'Fecha no disponible según configuración del doctor'
        });
      }

      // Obtener configuración de horarios para obtener duración de cita y buffer time
      const scheduleConfig = await ScheduleService.getScheduleConfig(doctorId);
      const appointmentDuration = scheduleConfig?.appointmentDuration || 30; // minutos
      const bufferTime = scheduleConfig?.bufferTime || 15; // minutos

      // Generar slots en la zona horaria del doctor (evita desfase 9am→3am)
      const doctorTimezone = (agendaConfig.Doctor as { timezone?: string | null })?.timezone ?? 'America/Mexico_City';
      const availableSlots = await ScheduleService.generateAvailableSlots(doctorId, targetDate, doctorTimezone);

      if (availableSlots.length === 0) {
        return res.json({
          success: true,
          data: [],
          message: 'No hay horarios disponibles para esta fecha según la configuración del doctor'
        });
      }

      // Obtener configuración de horarios para calcular duración de citas
      const slotDuration = appointmentDuration * 60000; // convertir a milisegundos

      // Obtener citas existentes para la fecha
      // IMPORTANTE: Solo obtener fechas y horarios, NO información de pacientes
      // Excluir solo citas CONFIRMADAS o PENDIENTES (no canceladas ni rechazadas)
      const dateStart = new Date(targetDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(targetDate);
      dateEnd.setHours(23, 59, 59, 999);

      const occupiedAppointments = await prisma.appointment.findMany({
        where: {
          doctorId,
          date: {
            gte: dateStart,
            lte: dateEnd
          },
          // Solo excluir citas que están CONFIRMADAS (no PENDING)
          // Las citas PENDING no bloquean el slot porque pueden ser rechazadas por el doctor
          // Las citas CANCELADAS o REJECTED liberan el horario
          confirmationStatus: {
            in: ['CONFIRMED']
          }
        },
        select: {
          id: true,
          date: true,
          status: true,
          confirmationStatus: true
        }
      });

      // Obtener eventos del calendario interno que ocupan horarios
      // Incluir:
      // 1. Eventos externos (sin paciente asociado) - estos siempre ocupan horario
      // 2. Eventos con paciente que tienen appointments confirmados o pendientes
      const allEvents = await prisma.internalCalendarEvent.findMany({
        where: {
          doctorId,
          fechaHoraInicio: {
            gte: dateStart,
            lte: dateEnd
          }
        },
        include: {
          patient: {
            include: {
              appointments: {
                where: {
                  doctorId,
                  date: {
                    gte: dateStart,
                    lte: dateEnd
                  },
                  confirmationStatus: {
                    in: ['CONFIRMED']
                  }
                },
                select: {
                  id: true,
                  date: true,
                  confirmationStatus: true
                }
              }
            }
          }
        }
      });

      // Filtrar eventos que realmente ocupan horario
      const occupiedEvents = allEvents.filter(event => {
        // Si no tiene paciente, es un evento externo y siempre ocupa horario
        if (!event.patientId || !event.patient) {
          return true;
        }

        // Si tiene paciente, verificar si hay appointments confirmados o pendientes relacionados
        // Buscar appointment relacionado por fecha cercana (±30 minutos)
        if (event.patient.appointments && event.patient.appointments.length > 0) {
          const eventTime = event.fechaHoraInicio.getTime();
          const hasRelatedAppointment = event.patient.appointments.some(appointment => {
            const appointmentTime = new Date(appointment.date).getTime();
            const timeDiff = Math.abs(eventTime - appointmentTime);
            // Si el appointment está dentro de ±30 minutos del evento, están relacionados
            return timeDiff <= 30 * 60 * 1000;
          });

          // Si hay appointment relacionado confirmado o pendiente, ocupa horario
          // Si no hay appointment relacionado o está cancelado/rechazado, NO ocupa horario
          return hasRelatedAppointment;
        }

        // Si no hay appointments relacionados, asumir que es un evento externo y ocupa horario
        return true;
      }).map(event => ({
        id: event.id,
        fechaHoraInicio: event.fechaHoraInicio,
        fechaHoraFin: event.fechaHoraFin,
        patientId: event.patientId
      }));

      console.log(`📅 Verificando disponibilidad para ${targetDate.toISOString().split('T')[0]}:`);
      console.log(`   Slots generados: ${availableSlots.length}`);
      console.log(`   Appointments ocupados: ${occupiedAppointments.length}`);
      console.log(`   Eventos ocupados: ${occupiedEvents.length}`);

      // Filtrar slots que no tienen conflictos con citas o eventos existentes
      let availableTimes = availableSlots.filter(slot => {
        const slotEnd = new Date(slot.getTime() + slotDuration);
        
        // Verificar conflictos con appointments
        const hasAppointmentConflict = occupiedAppointments.some(appointment => {
          const appointmentStart = new Date(appointment.date);
          // Usar la duración configurada para el appointment también
          const appointmentEnd = new Date(appointmentStart.getTime() + slotDuration);
          
          // Verificar si hay solapamiento (considerando buffer time)
          const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
          
          return (
            (slotStartWithBuffer < appointmentEnd && slotEndWithBuffer > appointmentStart) ||
            (appointmentStart < slotEndWithBuffer && appointmentEnd > slotStartWithBuffer)
          );
        });

        if (hasAppointmentConflict) {
          return false;
        }

        // Verificar conflictos con eventos del calendario
        const hasEventConflict = occupiedEvents.some(event => {
          const eventStart = new Date(event.fechaHoraInicio);
          const eventEnd = new Date(event.fechaHoraFin);
          
          // Verificar si hay solapamiento (considerando buffer time)
          const slotStartWithBuffer = new Date(slot.getTime() - bufferTime * 60000);
          const slotEndWithBuffer = new Date(slotEnd.getTime() + bufferTime * 60000);
          
          return (
            (slotStartWithBuffer < eventEnd && slotEndWithBuffer > eventStart) ||
            (eventStart < slotEndWithBuffer && eventEnd > slotStartWithBuffer)
          );
        });

        if (hasEventConflict) {
          return false;
        }

        return true;
      });

      console.log(`   Slots disponibles después de filtrar: ${availableTimes.length}`);

      // Formatear slot en la zona horaria del doctor (YYYY-MM-DDTHH:mm:00)
      const formatSlotInTimezone = (d: Date, tz: string) => {
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(d);
        const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
        return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`;
      };

      res.json({
        success: true,
        data: availableTimes.map(slot => {
          const slotEnd = new Date(slot.getTime() + slotDuration);
          return {
            id: `slot_${slot.getTime()}`, // timestamp para createAppointment
            startTime: formatSlotInTimezone(slot, doctorTimezone),
            endTime: formatSlotInTimezone(slotEnd, doctorTimezone),
            isRecurring: false
          };
        })
      });
    } catch (error) {
      console.error('Error al obtener horarios disponibles:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Crear cita desde el link público
  static async createAppointment(req: Request, res: Response) {
    try {
      console.log('=== INICIO createAppointment ===');
      console.log('Params:', req.params);
      console.log('Body:', req.body);
      
      const { doctorUsername } = req.params;
      const { 
        slotId, 
        patientName, 
        patientEmail, 
        patientPhone, 
        motivoConsulta 
      } = req.body;

      if (!slotId || !patientName || !patientEmail || !patientPhone || !motivoConsulta) {
        console.error('❌ Faltan campos requeridos');
        return res.status(400).json({ 
          success: false,
          error: 'Todos los campos son requeridos' 
        });
      }

      // Buscar el doctor por el link
      const agendaConfig = await prisma.agendaPacientesLink.findFirst({
        where: {
          link: {
            contains: doctorUsername
          },
          esta_activo: true
        },
        include: {
          Doctor: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      if (!agendaConfig) {
        return res.status(404).json({ success: false, error: 'Link no encontrado o inactivo' });
      }

      // Parsear el slotId correctamente
      // El slotId viene como "slot_<timestamp>" desde getAvailableSlots
      // pero soportamos variantes por seguridad (timestamp o ISO).
      const slotIdValue = String(slotId || '').trim();
      let slotTime: Date | null = null;
      const slotIdMatch = slotIdValue.match(/^slot_(\d+)$/);
      if (slotIdMatch?.[1]) {
        slotTime = new Date(Number(slotIdMatch[1]));
      } else if (/^\d+$/.test(slotIdValue)) {
        slotTime = new Date(Number(slotIdValue));
      } else if (slotIdValue) {
        slotTime = new Date(slotIdValue);
      }
      
      // Validar que la fecha sea válida
      if (!slotTime || isNaN(slotTime.getTime())) {
        console.error('❌ Error parseando slotId:', slotId);
        return res.status(400).json({ 
          success: false,
          error: 'Formato de horario inválido' 
        });
      }

      // Obtener duración de cita configurada por el doctor
      const scheduleConfig = await ScheduleService.getScheduleConfig(agendaConfig.doctor_id);
      const appointmentDuration = scheduleConfig?.appointmentDuration ?? 30;
      const slotEnd = new Date(slotTime.getTime() + appointmentDuration * 60000);

      // Verificar que el slot esté disponible usando el servicio de horarios
      const doctorTimezone = (agendaConfig.Doctor as { timezone?: string | null })?.timezone ?? 'America/Mexico_City';
      const isSlotAvailable = await ScheduleService.isTimeSlotAvailable(agendaConfig.doctor_id, slotTime, doctorTimezone);

      if (!isSlotAvailable) {
        console.warn('⚠️  El horario no está disponible según la configuración del doctor');
        // No rechazar completamente - permitir crear la solicitud para que el doctor la revise
        // El doctor puede rechazarla si no está disponible
      }

      // NO verificar conflictos con citas CONFIRMED aquí porque:
      // 1. Las citas PENDING pueden ser rechazadas por el doctor
      // 2. El doctor verá el conflicto cuando apruebe/rechace
      // 3. Esto permite que múltiples pacientes soliciten el mismo horario (el doctor decide)

      // Crear o encontrar paciente
      let patient = await prisma.patient.findFirst({
        where: {
          email: patientEmail
        }
      });

      if (!patient) {
        // Crear nuevo paciente
        const newUser = await prisma.user.create({
          data: {
            email: patientEmail,
            password: Math.random().toString(36).slice(-8), // Contraseña temporal
            role: 'PATIENT',
            firstName: patientName.split(' ')[0] || patientName,
            lastName: patientName.split(' ').slice(1).join(' ') || '',
            phone: patientPhone
          }
        });

        patient = await prisma.patient.create({
          data: {
            userId: newUser.id,
            email: patientEmail,
            firstName: patientName.split(' ')[0] || patientName,
            lastName: patientName.split(' ').slice(1).join(' ') || '',
            phone: patientPhone,
            dateOfBirth: new Date(), // Fecha por defecto
            gender: 'OTHER',
            dataConsent: true,
            dataConsentAt: new Date()
          }
        });
      }

      // Crear relación doctor-paciente si no existe
      const doctorPatient = await prisma.doctorPatient.upsert({
        where: {
          doctorId_patientId: {
            doctorId: agendaConfig.doctor_id,
            patientId: patient.id
          }
        },
        update: {},
        create: {
          doctorId: agendaConfig.doctor_id,
          patientId: patient.id,
          status: 'ACTIVE',
          context: 'Agendamiento automático',
          specialization: agendaConfig.Doctor.specialization
        }
      });

      // Crear la cita
      const appointment = await prisma.appointment.create({
        data: {
          doctorId: agendaConfig.doctor_id,
          patientId: patient.id,
          doctorPatientId: doctorPatient.id, // Usar el ID correcto de la relación DoctorPatient
          userId: patient.userId,
          date: slotTime,
          status: 'SCHEDULED',
          confirmationStatus: 'PENDING', // Explícitamente establecer como PENDING para aprobación del doctor
          notes: `Cita creada desde link público - ${motivoConsulta}`
        }
      });

      console.log('✅ Appointment creado:', appointment.id);

      // Generar automáticamente pre-consulta si es la primera cita del paciente con este doctor
      let preConsultationToken: string | null = null;
      try {
        console.log('Intentando crear pre-consulta automática para appointment:', appointment.id);
        const preConsultationModule = await import('./preConsultation.controller');
        preConsultationToken = await preConsultationModule.createPreConsultationForAppointment(appointment.id);
        if (preConsultationToken) {
          console.log('Pre-consulta creada exitosamente');
        } else {
          console.log('No se creó pre-consulta (no es primera cita o ya existe consulta médica)');
        }
      } catch (preConsultationError) {
        console.error('Error generando pre-consulta automática:', preConsultationError);
        if (preConsultationError instanceof Error && preConsultationError.stack) {
          console.error('Stack trace:', preConsultationError.stack);
        }
        // No fallar la creación de la cita si la pre-consulta falla
      }

      // Crear evento en el calendario interno de Qlinexa360
      const doctorFirstName = agendaConfig.Doctor.user?.firstName || '';
      const doctorLastName = agendaConfig.Doctor.user?.lastName || '';
      const eventTitle = `${patientName} consulta`;
      const eventDescription = `Cita con ${agendaConfig.Doctor.professionalTitle} ${doctorFirstName} ${doctorLastName}\n\nMotivo: ${motivoConsulta}\nPaciente: ${patientName}\nEmail: ${patientEmail}\nTeléfono: ${patientPhone}`;

      const calendarEvent = await prisma.internalCalendarEvent.create({
        data: {
          doctorId: agendaConfig.doctor_id,
          patientId: patient.id,
          fechaHoraInicio: slotTime,
          fechaHoraFin: slotEnd,
          titulo: eventTitle,
          descripcion: eventDescription,
          origenEvento: 'google', // Por defecto, se sincronizará con el primer calendario disponible
          creadoPor: agendaConfig.doctor_id
        },
        include: {
          patient: {
            select: {
              id: true,
              userId: true,
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      console.log('✅ InternalCalendarEvent creado:', calendarEvent.id);

      // IMPORTANTE: NO sincronizar con calendarios externos todavía porque la cita está PENDING
      // La sincronización se hará cuando el doctor APRUEBE la cita (en updateAppointmentStatus)
      // Esto evita que el paciente reciba invitaciones de calendario antes de que el doctor confirme la cita
      console.log('⏳ Cita creada con estado PENDING - La sincronización con calendarios externos se hará cuando el doctor apruebe la cita');

      // Enviar notificaciones con hora en formato am/pm para mayor claridad
      const appointmentData = {
        doctorName: `${agendaConfig.Doctor.professionalTitle} ${doctorFirstName} ${doctorLastName}`,
        patientName: patientName,
        date: slotTime,
        time: `${formatAppointmentTimeWithAmPm(slotTime, doctorTimezone)} - ${formatAppointmentTimeWithAmPm(slotEnd, doctorTimezone)}`,
        reason: motivoConsulta,
        timezone: doctorTimezone
      };

      // Enviar email al paciente con adjunto .ics para que agregue el evento a su calendario
      const emailService = (await import('../services/notification.service')).EmailService.getInstance();
      const icsContent = (await import('../utils/ics.utils')).generateIcsForAppointment({
        eventId: calendarEvent.id,
        title: eventTitle,
        description: eventDescription,
        start: slotTime,
        end: slotEnd
      });
      const frontendUrl = process.env.FRONTEND_URL || 'https://www.qlinexa360.com';
      const emailSent = await emailService.sendCalendarEventEmail(patientEmail, {
        patientName,
        doctorName: appointmentData.doctorName,
        eventTitle,
        eventDate: slotTime,
        eventEndDate: slotEnd,
        description: motivoConsulta,
        timezone: doctorTimezone,
        icsContent,
        preConsultationLink: preConsultationToken ? `${frontendUrl}/pre-consulta/${preConsultationToken}` : undefined
      });

      // Enviar WhatsApp si está configurado (solo mensaje, el email ya se envió con .ics)
      let whatsappSent = false;
      if (patientPhone) {
        const { WhatsAppService } = await import('../services/notification.service');
        whatsappSent = await WhatsAppService.getInstance().sendAppointmentConfirmationMessage(patientPhone, appointmentData);
      }

      const patientNotifications = { emailSent, whatsappSent };

      // Enviar notificación al doctor
      const doctorNotifications = await NotificationService.sendDoctorNotification(
        'doctor@example.com', // TODO: Obtener email del doctor desde la relación User
        '', // TODO: Obtener teléfono del doctor desde la relación User
        appointmentData
      );

      res.json({
        success: true,
        data: {
          appointmentId: appointment.id,
          message: 'Solicitud de cita enviada exitosamente. El doctor revisará tu solicitud y te notificará cuando sea aprobada.',
          notifications: {
            patient: patientNotifications,
            doctor: doctorNotifications
          },
          calendarEventId: calendarEvent.id,
          confirmationStatus: 'PENDING'
        }
      });
    } catch (error) {
      console.error('Error al crear cita:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Enviar link de agendamiento a pacientes por email
  static async sendLinkToPatients(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { patientIds } = req.body;

      if (!patientIds || !Array.isArray(patientIds) || patientIds.length === 0) {
        return res.status(400).json({ error: 'Se requiere al menos un paciente' });
      }

      let doctorId: string;
      let doctor: { id: string; user: { firstName: string; lastName: string } };

      if (req.user.role === 'DOCTOR') {
        const d = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
          include: { user: true }
        });
        if (!d) {
          return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
        }
        doctor = d;
        doctorId = d.id;
      } else if (req.user.role === 'ASISTENTE') {
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
        const d = await prisma.doctor.findUnique({
          where: { id: selectedDoctorId },
          include: { user: true }
        });
        if (!d) {
          return res.status(404).json({ error: 'Doctor no encontrado' });
        }
        doctor = d;
        doctorId = selectedDoctorId;
      } else {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      // Obtener configuración de agenda del doctor
      const agendaConfig = await prisma.agendaPacientesLink.findFirst({
        where: { doctor_id: doctorId }
      });

      if (!agendaConfig || !agendaConfig.esta_activo) {
        return res.status(400).json({ error: 'La agenda no está activa. Actívala primero.' });
      }

      // Obtener pacientes
      const patients = await prisma.patient.findMany({
        where: {
          id: { in: patientIds },
          doctors: { some: { doctorId: doctorId } }
        },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      if (patients.length === 0) {
        return res.status(404).json({ error: 'No se encontraron pacientes válidos' });
      }

      const doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
      const link = agendaConfig.link;
      const results = [];

      // Enviar email a cada paciente
      for (const patient of patients) {
        if (!patient.user?.email) {
          results.push({
            patientId: patient.id,
            patientName: `${patient.user?.firstName || ''} ${patient.user?.lastName || ''}`,
            email: patient.user?.email || 'N/A',
            success: false,
            error: 'El paciente no tiene email registrado'
          });
          continue;
        }

        try {
          const patientName = `${patient.user.firstName} ${patient.user.lastName}`;
          const subject = 'Agenda tu cita médica - Qlinexa360';
          const html = `
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background-color: #f5f5f5;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb;">
                  <h1 style="color:#2563eb; margin: 0; font-size: 24px;">Qlinexa360</h1>
                  <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Agenda tu cita médica</p>
                </div>
                
                <h2 style="color:#333; margin-top: 0;">Hola ${patient.user.firstName},</h2>
                
                <p style="font-size: 16px; color: #333;">
                  <strong style="color: #2563eb;">${doctorName}</strong> te invita a agendar tu cita médica de forma rápida y sencilla.
                </p>
                
                ${agendaConfig.mensaje_custom ? `
                <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
                  <p style="margin: 0; font-style: italic; color: #1e40af; font-size: 15px;">"${agendaConfig.mensaje_custom}"</p>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748b; font-style: normal;">— ${doctorName}</p>
                </div>
                ` : ''}
                
                <p style="font-size: 16px; color: #333; margin-top: 25px;">
                  Puedes agendar tu cita en cualquier momento haciendo clic en el siguiente botón:
                </p>
                
                <div style="text-align: center; margin: 35px 0;">
                  <a href="${link}" style="background-color: #2563eb; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.3); transition: background-color 0.3s;">
                    📅 Agendar mi cita
                  </a>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 25px 0;">
                  <p style="margin: 0 0 10px 0; font-size: 13px; color: #666; font-weight: bold;">O copia y pega este enlace en tu navegador:</p>
                  <p style="margin: 0; font-size: 12px; color: #2563eb; word-break: break-all; font-family: monospace; background-color: white; padding: 10px; border-radius: 4px; border: 1px solid #e5e7eb;">${link}</p>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                  <p style="font-size: 13px; color: #666; margin: 0 0 10px 0;">
                    <strong>💡 Información importante:</strong>
                  </p>
                  <ul style="font-size: 13px; color: #666; margin: 0; padding-left: 20px;">
                    <li>Este enlace es personalizado y seguro</li>
                    <li>Podrás ver solo los horarios disponibles del doctor</li>
                    <li>El agendamiento es inmediato y recibirás confirmación por email</li>
                  </ul>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="font-size: 12px; color: #999; margin: 0;">
                    Gracias por usar <strong style="color: #2563eb;">Qlinexa360</strong>
                  </p>
                  <p style="font-size: 11px; color: #999; margin: 5px 0 0 0;">
                    Si tienes alguna pregunta, no dudes en contactarnos.
                  </p>
                </div>
              </div>
            </body>
            </html>`;

          const emailSent = await sendEmailHtml(
            patient.user.email,
            subject,
            html,
            fromAddresses.noReply
          );

          results.push({
            patientId: patient.id,
            patientName: `${patient.user.firstName} ${patient.user.lastName}`,
            email: patient.user.email,
            success: emailSent,
            error: emailSent ? null : 'Error al enviar email'
          });
        } catch (error: any) {
          console.error(`Error al enviar email a paciente ${patient.id}:`, error);
          results.push({
            patientId: patient.id,
            patientName: `${patient.user?.firstName || ''} ${patient.user?.lastName || ''}`,
            email: patient.user?.email || 'N/A',
            success: false,
            error: error.message || 'Error desconocido'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      res.json({
        success: true,
        message: `Emails enviados: ${successCount} exitosos, ${failCount} fallidos`,
        results
      });
    } catch (error) {
      console.error('Error al enviar links a pacientes:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Obtener citas de un paciente específico
  static async getPatientAppointments(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      const { patientId } = req.params;

      if (!patientId) {
        return res.status(400).json({ error: 'ID de paciente requerido' });
      }

      // Obtener doctorId desde la base de datos usando userId
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId }
      });

      if (!doctor) {
        return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
      }

      const doctorId = doctor.id;

      // Verificar que el paciente pertenece al doctor
      const doctorPatient = await prisma.doctorPatient.findFirst({
        where: {
          doctorId: doctorId,
          patientId: patientId
        }
      });

      if (!doctorPatient) {
        return res.status(403).json({ error: 'No tienes acceso a este paciente' });
      }

      // Obtener las citas del paciente
      const appointments = await prisma.appointment.findMany({
        where: {
          patientId: patientId,
          doctorId: doctorId
        },
        orderBy: {
          date: 'desc'
        },
        take: 20 // Limitar a las últimas 20 citas
      });

      res.json(appointments);
    } catch (error) {
      console.error('Error al obtener citas del paciente:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
} 