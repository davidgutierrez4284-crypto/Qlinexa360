/**
 * Enriquece req.user con doctorId cuando falta (tokens antiguos sin doctorId).
 * Evita errores "Usuario no es un doctor" en toda la plataforma.
 */
import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AuthRequest } from './auth.middleware';

export const enrichDoctorId = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return next();
  if (req.user.doctorId) return next();
  if (req.user.role !== 'DOCTOR') return next();

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      select: { id: true }
    });
    if (doctor) {
      req.user.doctorId = doctor.id;
    }
  } catch (err) {
    console.error('[enrichDoctorId] Error:', err);
  }
  next();
};
