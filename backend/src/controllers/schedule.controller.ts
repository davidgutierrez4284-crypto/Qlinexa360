import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { ScheduleService } from '../services/schedule.service';

const prisma = new PrismaClient();

export class ScheduleController {
  // Obtener configuración de horarios del doctor
  static async getScheduleConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'No autorizado' });
      }

      let doctorId: string | null = null;

      if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
          select: { id: true }
        });
        doctorId = doctor?.id || null;
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

        doctorId = selectedDoctorId;
      }

      if (!doctorId) {
        return res.status(404).json({ error: 'Perfil de doctor no encontrado' });
      }

      // Buscar configuración en la base de datos
      const scheduleConfig = await prisma.doctorScheduleConfig.findUnique({
        where: { doctorId }
      });

      if (scheduleConfig) {
        // Retornar configuración de la base de datos
        // El formato esperado es: { monday: [{ startTime, endTime }], ... }
        const weeklySchedule = scheduleConfig.weeklySchedule as any;
        const normalizedSchedule: any = {};
        
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach(day => {
          const dayData = weeklySchedule[day];
          if (Array.isArray(dayData)) {
            // Formato correcto: array de rangos
            normalizedSchedule[day] = dayData.map((range: any) => ({
              startTime: range.startTime || '09:00',
              endTime: range.endTime || '17:00'
            }));
          } else if (dayData && typeof dayData === 'object' && 'timeSlots' in dayData) {
            // Convertir formato antiguo con timeSlots a rangos
            const timeSlots = dayData.timeSlots || [];
            const ranges: any[] = [];
            let currentRange: any = null;
            
            timeSlots
              .filter((s: any) => s.available)
              .sort((a: any, b: any) => a.time.localeCompare(b.time))
              .forEach((slot: any) => {
                if (!currentRange) {
                  currentRange = { startTime: slot.time, endTime: slot.time };
                } else {
                  const currentEnd = new Date(`2000-01-01T${currentRange.endTime}`);
                  const nextTime = new Date(`2000-01-01T${slot.time}`);
                  const diffMinutes = (nextTime.getTime() - currentEnd.getTime()) / 60000;
                  
                  if (diffMinutes === 30) {
                    currentRange.endTime = slot.time;
                  } else {
                    const endTime = new Date(`2000-01-01T${currentRange.endTime}`);
                    endTime.setMinutes(endTime.getMinutes() + 30);
                    currentRange.endTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
                    ranges.push(currentRange);
                    currentRange = { startTime: slot.time, endTime: slot.time };
                  }
                }
              });
            
            if (currentRange) {
              const endTime = new Date(`2000-01-01T${currentRange.endTime}`);
              endTime.setMinutes(endTime.getMinutes() + 30);
              currentRange.endTime = `${endTime.getHours().toString().padStart(2, '0')}:${endTime.getMinutes().toString().padStart(2, '0')}`;
              ranges.push(currentRange);
            }
            
            normalizedSchedule[day] = ranges;
          } else {
            normalizedSchedule[day] = [];
          }
        });

        return res.json({
          success: true,
          data: {
            appointmentDuration: scheduleConfig.appointmentDuration,
            bufferTime: scheduleConfig.bufferTime,
            weeklySchedule: normalizedSchedule
          }
        });
      }

      // Si no hay configuración, usar la del servicio (valores por defecto)
      const defaultConfig = await ScheduleService.getScheduleConfig(doctorId);
      
      if (defaultConfig) {
        return res.json({
          success: true,
          data: {
            appointmentDuration: defaultConfig.appointmentDuration,
            bufferTime: defaultConfig.bufferTime,
            weeklySchedule: defaultConfig.weeklySchedule
          }
        });
      }

      return res.status(500).json({ error: 'Error al obtener configuración' });
    } catch (error) {
      console.error('Error al obtener configuración de horarios:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  // Actualizar configuración de horarios del doctor
  static async updateScheduleConfig(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ success: false, error: 'No autorizado' });
      }

      const { appointmentDuration, bufferTime, weeklySchedule } = req.body;

      let doctorId: string;

      if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({
          where: { userId: req.user.userId },
          select: { id: true }
        });
        if (!doctor) {
          return res.status(404).json({ success: false, error: 'Perfil de doctor no encontrado' });
        }
        doctorId = doctor.id;
      } else if (req.user.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
          return res.status(400).json({ success: false, error: 'Doctor seleccionado requerido' });
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
          return res.status(403).json({ success: false, error: 'Asistente no vinculado a este doctor' });
        }
        doctorId = selectedDoctorId;
      } else {
        return res.status(403).json({ success: false, error: 'Solo doctores y asistentes pueden actualizar la configuración' });
      }

      // Validar datos
      if (appointmentDuration && (appointmentDuration < 15 || appointmentDuration > 120)) {
        return res.status(400).json({ success: false, error: 'La duración de cita debe estar entre 15 y 120 minutos' });
      }

      if (bufferTime && (bufferTime < 0 || bufferTime > 60)) {
        return res.status(400).json({ success: false, error: 'El tiempo de buffer debe estar entre 0 y 60 minutos' });
      }

      // Validar weeklySchedule
      if (weeklySchedule && typeof weeklySchedule !== 'object') {
        return res.status(400).json({ success: false, error: 'weeklySchedule debe ser un objeto válido' });
      }

      // Guardar o actualizar configuración
      const scheduleConfig = await prisma.doctorScheduleConfig.upsert({
        where: { doctorId },
        update: {
          appointmentDuration: appointmentDuration !== undefined ? appointmentDuration : 30,
          bufferTime: bufferTime !== undefined ? bufferTime : 15,
          weeklySchedule: weeklySchedule || {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: []
          },
          updatedAt: new Date()
        },
        create: {
          doctorId,
          appointmentDuration: appointmentDuration !== undefined ? appointmentDuration : 30,
          bufferTime: bufferTime !== undefined ? bufferTime : 15,
          weeklySchedule: weeklySchedule || {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: []
          }
        }
      });

      return res.json({
        success: true,
        data: {
          appointmentDuration: scheduleConfig.appointmentDuration,
          bufferTime: scheduleConfig.bufferTime,
          weeklySchedule: scheduleConfig.weeklySchedule
        }
      });
    } catch (error: any) {
      console.error('Error al actualizar configuración de horarios:', error);
      console.error('Error stack:', error.stack);
      console.error('Error code:', error.code);
      console.error('Error meta:', error.meta);
      
      // Asegurar que siempre devolvemos JSON
      if (error.code === 'P2002') {
        return res.status(400).json({ success: false, error: 'Ya existe una configuración para este doctor' });
      } else if (error.code === 'P2025') {
        return res.status(404).json({ success: false, error: 'Registro no encontrado' });
      } else if (error.code === 'P2003') {
        return res.status(400).json({ success: false, error: 'Error de referencia: El doctor no existe' });
      } else if (error.code === 'P2011') {
        return res.status(400).json({ success: false, error: 'Error: Campo requerido faltante' });
      } else {
        return res.status(500).json({ 
          success: false, 
          error: 'Error interno del servidor',
          details: process.env.NODE_ENV === 'development' ? {
            message: error.message,
            code: error.code,
            meta: error.meta
          } : undefined
        });
      }
    }
  }
}

