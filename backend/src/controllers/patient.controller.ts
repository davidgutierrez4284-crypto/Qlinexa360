import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/password.utils";
import path from "path";
import fs from "fs";
import { uploadToS3, registerFileInDB, getS3SignedUrl, getS3SignedUrlIfExists } from "../utils/file.utils";
import { AuthRequest } from "../middlewares/auth.middleware";
import { NotificationService } from "../services/notification.service";
import { ConsentPdfService } from "../services/consentPdf.service";
import { AppError } from "../utils/error.utils";
import { formatAppointmentDate, formatAppointmentTime } from "../utils/date.utils";
import {
  finalizeTeleconsultationAfterPayment,
  getTeleconsultationPaymentContext,
  isTeleconsultationPaymentApproved,
} from "../payments/mercadopago/mercadopago.teleconsultation.service";
import {
  ensureInPersonCheckoutUrl,
  finalizeInPersonAfterPayment,
  getInPersonPaymentContext,
} from "../payments/mercadopago/mercadopago.inperson.service";
import { getRefundContextForAppointment } from "../payments/mercadopago/mercadopago.refund.service";
import {
  getVisibleDoctorPatientIdsForPatient,
  patientHasClinicalHistoryPortalAccess,
} from "../utils/patientPortal.utils";
import { RecipePdfService } from "../services/recipePdf.service";
import { securityLogger } from "../utils/logger.utils";

const prisma = new PrismaClient();

// =================================================================
// REGISTRO DE PACIENTE
// =================================================================
export const registerPatient = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, dateOfBirth } = req.body;

    // Validación de campos obligatorios (responde 400 en vez de fallar con 500)
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        message: "Faltan campos obligatorios: email, contraseña, nombre y apellidos son requeridos",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: "El email no es válido" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    // Encriptar la contraseña (login usa bcrypt.compare; almacenar en texto plano impedía iniciar sesión)
    const hashedPassword = await hashPassword(String(password));

    // Crear el nuevo usuario y perfil de paciente
    const newUser = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: 'PATIENT',
        patientProfile: {
          create: {
            firstName,
            lastName,
            email: normalizedEmail,
            phone: phone || null, // Guardar el teléfono en el modelo Patient
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
            gender: 'No especificado',
            dataConsent: true,
            dataConsentAt: new Date(),
          }
        }
      },
      include: {
        patientProfile: true
      }
    });

    res.status(201).json({
      message: "Paciente registrado exitosamente",
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error("Error al registrar paciente:", error);
    res.status(500).json({ message: "Error al registrar paciente" });
  }
};

// =================================================================
// OBTENER EXPEDIENTE DEL PACIENTE (mismos datos que registra el profesional; solo lectura en la app)
// =================================================================
export const getMyProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (req.user.role !== 'PATIENT') {
      return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
    }

    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.userId },
      include: {
        user: true,
        emergencyContacts: true
      }
    });

    if (!patient) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    const clinicalHistoryPortalEnabled = await patientHasClinicalHistoryPortalAccess(patient.id);

    res.json({
      ...patient,
      clinicalHistoryPortalEnabled,
    });
  } catch (error) {
    console.error('Error al obtener perfil del paciente:', error);
    res.status(500).json({ message: 'Error al obtener perfil' });
  }
};

// =================================================================
// OBTENER CASOS CLÍNICOS DEL PACIENTE (VISTA DEL PACIENTE)
// =================================================================
export const getMyClinicalCases = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (req.user.role !== 'PATIENT') {
      return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
    }

    // Buscar el paciente
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    const visibleDoctorPatientIds = await getVisibleDoctorPatientIdsForPatient(patient.id);
    if (visibleDoctorPatientIds.length === 0) {
      return res.json([]);
    }

    const patientWithCases = await prisma.patient.findUnique({
      where: { userId: req.user.userId },
      include: {
        clinicalCases: {
          include: {
            medicalRecords: {
              where: { doctorPatientId: { in: visibleDoctorPatientIds } },
              orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
              select: {
                id: true,
                diagnosis: true,
                notes: true,
                isPublic: true,
                clinicalEvolution: true,
                createdAt: true,
                date: true,
                reason: true,
                tags: true,
                formData: true,
                treatment: true
              }
            },
            colaboradores: {
              include: {
                doctor: {
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
            }
          }
        }
      }
    });

    if (!patientWithCases) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    // Procesar los casos clínicos para el paciente
    const processedCases = patientWithCases.clinicalCases
      .map(clinicalCase => {
      // Procesar las consultas según la visibilidad
      const processedConsultations = clinicalCase.medicalRecords.map(consultation => {
        const baseConsultation = {
          id: consultation.id,
          clinicalEvolution: consultation.clinicalEvolution,
          createdAt: consultation.createdAt,
          date: consultation.date,
          reason: consultation.reason,
          tags: consultation.tags,
          formData: consultation.formData
        };

        // Si la consulta es pública, mostrar todo el contenido
        if (consultation.isPublic) {
          return {
            ...baseConsultation,
            diagnosis: consultation.diagnosis,
            notes: consultation.notes,
            treatment: consultation.treatment,
            isContentVisible: true
          };
        } else {
          // Si es privada, mostrar que existe pero ocultar contenido
          return {
            ...baseConsultation,
            diagnosis: 'Contenido privado',
            notes: 'Contenido privado',
            treatment: 'Contenido privado',
            isContentVisible: false
          };
        }
      });

      return {
        id: clinicalCase.id,
        padecimiento: clinicalCase.padecimiento,
        createdAt: clinicalCase.createdAt,
        updatedAt: clinicalCase.updatedAt,
        consultations: processedConsultations,
        collaborators: clinicalCase.colaboradores.map(colab => ({
          id: colab.doctor.id,
          name: `${colab.doctor.user.firstName} ${colab.doctor.user.lastName}`,
          role: colab.rol
        }))
      };
    })
      .filter((clinicalCase) => clinicalCase.consultations.length > 0);

    res.json(processedCases);
  } catch (error) {
    console.error('Error al obtener casos clínicos del paciente:', error);
    res.status(500).json({ message: 'Error al obtener casos clínicos' });
  }
};

// =================================================================
// CITAS DEL PACIENTE (agenda / mis citas)
// =================================================================
export const getMyAppointments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }
    if (req.user.role !== 'PATIENT') {
      return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { email: true },
    });
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.userId }
    });
    if (!patient && !user?.email) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    const normalizedEmail = user?.email?.trim().toLowerCase();
    const relatedPatients = await prisma.patient.findMany({
      where: {
        OR: [
          { userId: req.user.userId },
          ...(normalizedEmail
            ? [{ email: { equals: normalizedEmail, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      select: { id: true },
    });
    const patientIds = [...new Set(relatedPatients.map((p) => p.id))];
    if (patient?.id && !patientIds.includes(patient.id)) {
      patientIds.push(patient.id);
    }

    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    to.setDate(to.getDate() + 365);

    const appointments = await prisma.appointment.findMany({
      where: {
        date: { gte: from, lte: to },
        OR: [
          { userId: req.user.userId },
          ...(patientIds.length > 0 ? [{ patientId: { in: patientIds } }] : []),
          { patient: { userId: req.user.userId } },
          ...(normalizedEmail
            ? [{ patient: { email: { equals: normalizedEmail, mode: 'insensitive' as const } } }]
            : []),
        ],
        AND: [
          {
            OR: [
              { confirmationStatus: { in: ['PENDING', 'CONFIRMED', 'RESCHEDULED'] } },
              {
                confirmationStatus: 'CANCELLED',
                mercadoPagoRefundRequests: { some: { status: { in: ['pending', 'completed', 'failed'] } } },
              },
            ],
          },
        ],
      },
      include: {
        doctor: { include: { user: true } },
        teleconsultation: {
          select: { meetingUrl: true, consentSigned: true }
        }
      },
      orderBy: { date: 'asc' },
      take: 100
    });

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const data = await Promise.all(
      appointments.map(async (apt) => {
        const pendingReq = await prisma.appointmentConfirmationRequest.findFirst({
          where: {
            appointmentId: apt.id,
            status: 'PENDING',
            expiresAt: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' }
        });
        const fallbackReq =
          pendingReq ||
          (await prisma.appointmentConfirmationRequest.findFirst({
            where: { appointmentId: apt.id },
            orderBy: { createdAt: 'desc' }
          }));

        const tz = apt.doctor.timezone || 'America/Mexico_City';
        const doctorName = apt.doctor.user
          ? `${apt.doctor.professionalTitle || ''} ${apt.doctor.user.firstName} ${apt.doctor.user.lastName}`.trim()
          : apt.doctor.professionalTitle || 'Profesional';

        const confirmationLabels: Record<string, string> = {
          PENDING: 'Pendiente de confirmación',
          CONFIRMED: 'Confirmada',
          RESCHEDULED: 'Reprogramada',
          CANCELLED: 'Cancelada'
        };

        const token = fallbackReq?.confirmationToken;
        const manageLink = token
          ? apt.appointmentType === 'teleconsulta'
            ? `${baseUrl}/teleconsulta/${token}`
            : `${baseUrl}/confirm-appointment/${token}`
          : null;

        let paymentCtx = await getTeleconsultationPaymentContext(apt.doctorId, apt.id);
        let inPersonCtx =
          apt.appointmentType === 'presencial'
            ? await getInPersonPaymentContext(apt.doctorId, apt.id)
            : null;

        if (
          inPersonCtx?.paymentOffered &&
          inPersonCtx.paymentStatus === 'pending' &&
          !inPersonCtx.checkoutUrl &&
          token
        ) {
          try {
            const checkoutUrl = await ensureInPersonCheckoutUrl(apt.id, token);
            if (checkoutUrl) {
              inPersonCtx = { ...inPersonCtx, checkoutUrl };
            }
          } catch {
            /* checkout opcional */
          }
        } else if (
          apt.appointmentType === 'presencial' &&
          inPersonCtx?.paymentOffered &&
          inPersonCtx.paymentStatus === 'approved'
        ) {
          try {
            await finalizeInPersonAfterPayment(apt.id);
          } catch (syncErr) {
            securityLogger.warn('getMyAppointments: no se pudo reconciliar calendario presencial MP', {
              appointmentId: apt.id,
              syncErr,
            });
          }
        }

        const refundCtx = await getRefundContextForAppointment(apt.id);

        let meetingUrl = apt.teleconsultation?.meetingUrl ?? null;
        if (
          apt.appointmentType === 'teleconsulta' &&
          apt.teleconsultation?.consentSigned &&
          paymentCtx.paymentRequired &&
          paymentCtx.paymentStatus === 'approved' &&
          !meetingUrl
        ) {
          try {
            await finalizeTeleconsultationAfterPayment(apt.id);
            const refreshedTc = await prisma.teleconsultation.findUnique({
              where: { appointmentId: apt.id },
              select: { meetingUrl: true },
            });
            meetingUrl = refreshedTc?.meetingUrl ?? null;
          } catch (syncErr) {
            securityLogger.warn('getMyAppointments: no se pudo reconciliar enlace teleconsulta', {
              appointmentId: apt.id,
              syncErr,
            });
          }
        } else if (
          apt.appointmentType === 'teleconsulta' &&
          paymentCtx.paymentRequired &&
          paymentCtx.paymentStatus !== 'approved' &&
          (await isTeleconsultationPaymentApproved(apt.id))
        ) {
          paymentCtx = {
            ...paymentCtx,
            paymentStatus: 'approved',
            checkoutUrl: null,
          };
        }

        return {
          id: apt.id,
          date: apt.date,
          dateLabel: formatAppointmentDate(apt.date, tz),
          timeLabel: formatAppointmentTime(apt.date, tz),
          status: apt.status,
          confirmationStatus: apt.confirmationStatus,
          confirmationLabel: confirmationLabels[apt.confirmationStatus] || apt.confirmationStatus,
          appointmentType: apt.appointmentType,
          notes: apt.notes,
          doctorName,
          manageLink,
          meetingUrl:
            !paymentCtx.paymentRequired || paymentCtx.paymentStatus === 'approved'
              ? meetingUrl
              : null,
          consentSigned: apt.teleconsultation?.consentSigned ?? false,
          paymentRequired: paymentCtx.paymentRequired,
          paymentStatus: paymentCtx.paymentStatus,
          checkoutUrl:
            apt.teleconsultation?.consentSigned &&
            paymentCtx.paymentRequired &&
            paymentCtx.paymentStatus === 'pending'
              ? paymentCtx.checkoutUrl
              : null,
          inPersonPaymentOffered: inPersonCtx?.paymentOffered ?? false,
          inPersonPaymentStatus: inPersonCtx?.paymentStatus ?? 'not_required',
          inPersonCheckoutUrl: inPersonCtx?.checkoutUrl ?? null,
          inPersonPaymentAmount: inPersonCtx?.amount ?? 0,
          canRequestRefund: refundCtx.canRequestRefund,
          refundableAmount: refundCtx.refundableAmount,
          refundRequest: refundCtx.refundRequest,
          rescheduledFrom: apt.rescheduledFrom,
          rescheduledTo: apt.rescheduledTo
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error al obtener citas del paciente:', error);
    res.status(500).json({ message: 'Error al obtener citas' });
  }
};

// =================================================================
// OBTENER CONSULTAS DEL PACIENTE (VISTA DEL PACIENTE)
// =================================================================
export const getMyConsultations = async (req: AuthRequest, res: Response) => {
  try {
    console.log('=== getMyConsultations DEBUG ===');
    console.log('req.user:', req.user);
    console.log('req.user?.role:', req.user?.role);
    console.log('req.user?.userId:', req.user?.userId);
    console.log('Headers:', req.headers);
    
    if (!req.user) {
      console.log('ERROR: Usuario no autenticado');
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (req.user.role !== 'PATIENT') {
      console.log('ERROR: Rol incorrecto. Esperado: PATIENT, Recibido:', req.user.role);
      return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
    }

    const { clinicalCaseId } = req.query;

    // Buscar el paciente
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.userId }
    });

    if (!patient) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    const visibleDoctorPatientIds = await getVisibleDoctorPatientIdsForPatient(patient.id);
    if (visibleDoctorPatientIds.length === 0) {
      return res.json([]);
    }

    // Construir filtros
    const whereClause: any = {
      patientId: patient.id,
      doctorPatientId: { in: visibleDoctorPatientIds },
    };
    if (clinicalCaseId) {
      whereClause.clinicalCaseId = clinicalCaseId;
    }

    // Obtener todas las consultas del paciente
    const consultations = await prisma.medicalRecord.findMany({
      where: whereClause,
      include: {
        clinicalCase: {
          select: {
            id: true,
            padecimiento: true
          }
        },
        files: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            url: true,
            size: true,
            category: true,
            createdAt: true
          }
        },
        links: {
          select: {
            id: true,
            url: true,
            description: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Procesar consultas según visibilidad
    const processedConsultations = consultations.map(consultation => {
      const baseConsultation = {
        id: consultation.id,
        clinicalCaseId: consultation.clinicalCaseId,
        clinicalCase: consultation.clinicalCase,
        clinicalEvolution: consultation.clinicalEvolution,
        createdAt: consultation.createdAt,
        date: consultation.date,
        reason: consultation.reason,
        tags: consultation.tags,
        formData: consultation.formData,
        files: consultation.files,
        links: consultation.links,
        isEditable: consultation.isEditable // Incluir isEditable para que el frontend sepa si la consulta está abierta
      };

      // Si la consulta es pública, mostrar todo el contenido
      if (consultation.isPublic) {
        return {
          ...baseConsultation,
          diagnosis: consultation.diagnosis,
          notes: consultation.notes,
          treatment: consultation.treatment,
          isContentVisible: true
        };
      } else {
        // Si es privada, mostrar que existe pero ocultar contenido
        return {
          ...baseConsultation,
          diagnosis: 'Contenido privado',
          notes: 'Contenido privado',
          treatment: 'Contenido privado',
          isContentVisible: false
        };
      }
    });

    res.json(processedConsultations);
  } catch (error) {
    console.error('Error al obtener consultas del paciente:', error);
    res.status(500).json({ message: 'Error al obtener consultas' });
  }
};

// Endpoint: Obtener historial fotográfico del paciente autenticado (solo para pacientes)
export const getMyPhotoHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (req.user.role !== 'PATIENT') {
      return res.status(403).json({ message: 'Acceso denegado. Solo para pacientes.' });
    }

    const { clinicalCaseId } = req.query; // Parámetro opcional para filtrar por caso clínico
    
    // Buscar el paciente
    const patient = await prisma.patient.findUnique({
      where: { userId: req.user.userId }
    });

    if (!patient) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    const visibleDoctorPatientIds = await getVisibleDoctorPatientIdsForPatient(patient.id);
    if (visibleDoctorPatientIds.length === 0) {
      return res.json([]);
    }

    // Construir la condición where para filtrar por caso clínico si se proporciona
    const whereClause: any = {
      patientId: patient.id,
      doctorPatientId: { in: visibleDoctorPatientIds },
    };
    if (clinicalCaseId) {
      whereClause.clinicalCaseId = clinicalCaseId;
    }

    const medicalRecords = await prisma.medicalRecord.findMany({
      where: whereClause,
      include: {
        files: true,
        clinicalCase: {
          select: {
            id: true,
            padecimiento: true
          }
        }
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const photoHistory = [];
    for (const record of medicalRecords) {
      const imageFiles = record.files.filter(f => f.fileType && f.fileType.startsWith('image/'));
      if (imageFiles.length > 0) {
        const images = [];
        for (const file of imageFiles) {
          const url = await getS3SignedUrlIfExists(file.url);
          if (url) images.push({ id: file.id, url, fileName: file.fileName, fileType: file.fileType });
        }
        if (images.length > 0) {
          photoHistory.push({
            medicalRecordId: record.id,
            clinicalCaseId: record.clinicalCaseId,
            clinicalCasePadecimiento: record.clinicalCase?.padecimiento,
            date: record.date || record.createdAt,
            comment: record.notes || record.diagnosis || '',
            images,
          });
        }
      }
    }
    res.json(photoHistory);
  } catch (error) {
    console.error('Error al obtener historial fotográfico del paciente:', error);
    res.status(500).json({ message: "Error al obtener historial fotográfico" });
  }
};

// Endpoint: Obtener historial fotográfico del paciente
export const getPhotoHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { clinicalCaseId } = req.query; // Nuevo parámetro opcional
    console.log('PhotoHistory: patientId recibido:', patientId);
    console.log('PhotoHistory: clinicalCaseId recibido:', clinicalCaseId);

    if (!req.user) {
      throw new AppError('Autenticación requerida.', 401);
    }

    if (req.user.role === 'DOCTOR' || req.user.role === 'ASISTENTE') {
      let doctorId: string | null = null;

      if (req.user.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
        if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
        doctorId = doctor.id;
      } else {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
          throw new AppError('Doctor seleccionado requerido.', 400);
        }

        const link = await prisma.asistenteDoctorVinculo.findFirst({
          where: {
            doctorId: selectedDoctorId,
            asistenteId: req.user.userId,
            activo: true
          }
        });

        if (!link) {
          throw new AppError('Asistente no vinculado a este doctor.', 403);
        }

        doctorId = selectedDoctorId;
      }

      if (!doctorId) throw new AppError('Doctor no encontrado.', 404);

      const doctorPatientLink = await prisma.doctorPatient.findUnique({
        where: { doctorId_patientId: { doctorId, patientId } }
      });

      if (!doctorPatientLink) {
        const collaborationCheck = await prisma.padecimientoDoctorColaborador.findMany({
          where: {
            doctorId,
            patientId
          },
          select: {
            padecimientoId: true
          }
        });

        if (collaborationCheck.length === 0) {
          throw new AppError('No tienes acceso al historial fotográfico de este paciente.', 403);
        }
      }
    }

    // Construir la condición where para filtrar por caso clínico si se proporciona
    const whereClause: any = { patientId };
    if (clinicalCaseId) {
      whereClause.clinicalCaseId = clinicalCaseId;
    }

    const medicalRecords = await prisma.medicalRecord.findMany({
      where: whereClause,
      include: {
        files: true,
        clinicalCase: {
          select: {
            id: true,
            padecimiento: true
          }
        }
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    console.log('PhotoHistory: registros médicos encontrados:', medicalRecords.length);

    const photoHistory = [];
    for (const record of medicalRecords) {
      const imageFiles = record.files.filter(f => f.fileType && f.fileType.startsWith('image/'));
      if (imageFiles.length > 0) {
        console.log(`PhotoHistory: registro ${record.id} tiene ${imageFiles.length} imágenes`);
        const images = [];
        for (const file of imageFiles) {
          const url = await getS3SignedUrlIfExists(file.url);
          if (url) images.push({ id: file.id, url, fileName: file.fileName, fileType: file.fileType });
        }
        if (images.length > 0) {
          photoHistory.push({
            medicalRecordId: record.id,
            clinicalCaseId: record.clinicalCaseId,
            clinicalCasePadecimiento: record.clinicalCase?.padecimiento,
            date: record.date || record.createdAt,
            comment: record.notes || record.diagnosis || '',
            images,
          });
        }
      }
    }
    res.json(photoHistory);
  } catch (error: any) {
    console.error('Error al obtener historial fotográfico:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener historial fotográfico', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Endpoint: Obtener pacientes de un doctor
export const getDoctorPatients = async (req: AuthRequest, res: Response) => {
  try {
    const doctorId = req.user?.doctorId;
    
    if (!doctorId) {
      return res.status(400).json({ message: "ID de doctor requerido" });
    }

    const patients = await prisma.patient.findMany({
      where: {
        doctors: {
          some: {
            doctorId: doctorId
          }
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: [
        { user: { firstName: 'asc' } },
        { user: { lastName: 'asc' } }
      ]
    });

    res.json(patients);
  } catch (error) {
    console.error('Error fetching doctor patients:', error);
    res.status(500).json({ message: "Error al obtener pacientes" });
  }
};

// Obtener datos completos del paciente para doctores/asistentes
export const getPatientCompleteData = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: 'ID de paciente requerido' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            createdAt: true
          }
        },
        emergencyContacts: true,
        doctors: {
          include: {
            doctor: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // Formatear la respuesta con todos los datos
    const patientData = {
      id: patient.id,
      user: patient.user,
      // Datos personales
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      chronicDiseases: patient.chronicDiseases,
      // Contactos de emergencia
      emergencyContacts: patient.emergencyContacts.map(contact => ({
        id: contact.id,
        name: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        email: contact.email,
        relationship: contact.relationship
      })),
      // Datos fiscales
      taxName: patient.taxName,
      taxId: patient.taxId,
      taxAddress: patient.taxAddress,
      taxPostalCode: patient.taxPostalCode,
      taxRegime: patient.taxRegime,
      taxCertificateUrl: patient.taxCertificateUrl,
      // Doctores vinculados
      doctors: patient.doctors.map(dv => ({
        id: dv.doctor.id,
        name: `${dv.doctor.user.firstName} ${dv.doctor.user.lastName}`,
        email: dv.doctor.user.email,
        status: dv.status,
        context: dv.context,
        specialization: dv.specialization,
        startDate: dv.startDate
      })),
      createdAt: patient.createdAt,
      updatedAt: patient.updatedAt
    };

    res.json(patientData);
  } catch (error) {
    console.error('Error obteniendo datos completos del paciente:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}; 

// Obtener pólizas de seguro de un paciente
export const getPatientInsurancePolicies = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const insurancePolicies = await prisma.patientInsurance.findMany({
      where: { 
        patientId,
        isActive: true 
      },
      orderBy: { 
        endDate: 'desc' // La más reciente primero
      }
    });

    res.json(insurancePolicies);
  } catch (error) {
    console.error('Error obteniendo pólizas de seguro:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Agregar nueva póliza de seguro
export const addPatientInsurancePolicy = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { 
      insuranceCompany, 
      policyNumber, 
      policyHolder, 
      startDate, 
      endDate 
    } = req.body;

    // Validaciones
    if (!insuranceCompany || !policyNumber || !policyHolder || !startDate || !endDate) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' });
    }

    // Verificar que el paciente existe
    const patient = await prisma.patient.findUnique({
      where: { id: patientId }
    });

    if (!patient) {
      return res.status(404).json({ message: 'Paciente no encontrado' });
    }

    // Desactivar pólizas anteriores si la nueva es más reciente
    if (new Date(endDate) > new Date()) {
      await prisma.patientInsurance.updateMany({
        where: { 
          patientId,
          isActive: true 
        },
        data: { isActive: false }
      });
    }

    // Crear nueva póliza
    const newPolicy = await prisma.patientInsurance.create({
      data: {
        patientId,
        insuranceCompany,
        policyNumber,
        policyHolder,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: true
      }
    });

    res.status(201).json(newPolicy);
  } catch (error) {
    console.error('Error agregando póliza de seguro:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Actualizar póliza de seguro
export const updatePatientInsurancePolicy = async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;
    const { 
      insuranceCompany, 
      policyNumber, 
      policyHolder, 
      startDate, 
      endDate 
    } = req.body;

    const updatedPolicy = await prisma.patientInsurance.update({
      where: { id: policyId },
      data: {
        insuranceCompany,
        policyNumber,
        policyHolder,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      }
    });

    res.json(updatedPolicy);
  } catch (error) {
    console.error('Error actualizando póliza de seguro:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

// Desactivar póliza de seguro
export const deactivatePatientInsurancePolicy = async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;

    const deactivatedPolicy = await prisma.patientInsurance.update({
      where: { id: policyId },
      data: { isActive: false }
    });

    res.json(deactivatedPolicy);
  } catch (error) {
    console.error('Error desactivando póliza de seguro:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

const myRecipeInclude = {
  detalleMedicamentos: true,
  estudiosSolicitados: true,
  doctor: {
    select: {
      id: true,
      professionalTitle: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  },
  consulta: {
    select: {
      id: true,
      createdAt: true,
      clinicalCase: {
        select: {
          padecimiento: true,
        },
      },
    },
  },
} as const;

async function getAuthenticatedPatientProfile(req: AuthRequest) {
  if (!req.user || req.user.role !== 'PATIENT') {
    return null;
  }
  return prisma.patient.findUnique({ where: { userId: req.user.userId } });
}

// =================================================================
// RECETAS DEL PACIENTE (solo lectura, solo las propias)
// =================================================================
export const getMyRecipes = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para pacientes.' });
    }

    const patient = await getAuthenticatedPatientProfile(req);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
    }

    const { limit = 100, offset = 0 } = req.query;

    const recetas = await prisma.recetaMedica.findMany({
      where: { pacienteId: patient.id },
      include: myRecipeInclude,
      orderBy: { fechaEmision: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.recetaMedica.count({
      where: { pacienteId: patient.id },
    });

    res.json({
      success: true,
      data: recetas.map((r) => ({
        ...r,
        padecimiento: r.consulta?.clinicalCase?.padecimiento || '',
      })),
      pagination: { total, limit: Number(limit), offset: Number(offset) },
    });
  } catch (error) {
    console.error('Error al obtener recetas del paciente autenticado:', error);
    res.status(500).json({ success: false, message: 'Error al obtener recetas' });
  }
};

export const getMyRecipeById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para pacientes.' });
    }

    const patient = await getAuthenticatedPatientProfile(req);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
    }

    const receta = await prisma.recetaMedica.findFirst({
      where: { id: req.params.id, pacienteId: patient.id },
      include: myRecipeInclude,
    });

    if (!receta) {
      return res.status(404).json({ success: false, message: 'Receta no encontrada' });
    }

    res.json({
      success: true,
      data: {
        ...receta,
        padecimiento: receta.consulta?.clinicalCase?.padecimiento || '',
      },
    });
  } catch (error) {
    console.error('Error al obtener receta del paciente:', error);
    res.status(500).json({ success: false, message: 'Error al obtener receta' });
  }
};

export const getMyRecipePdfViewUrl = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role !== 'PATIENT') {
      return res.status(403).json({ success: false, message: 'Acceso denegado. Solo para pacientes.' });
    }

    const patient = await getAuthenticatedPatientProfile(req);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Perfil de paciente no encontrado' });
    }

    const receta = await prisma.recetaMedica.findFirst({
      where: { id: req.params.id, pacienteId: patient.id },
      select: {
        id: true,
        archivoPdf: true,
        doctorId: true,
        pacienteId: true,
        fechaEmision: true,
      },
    });

    if (!receta || !receta.archivoPdf) {
      return res.status(404).json({ success: false, message: 'Receta no encontrada' });
    }

    const emissionDate = receta.fechaEmision || new Date('2025-08-11');
    const viewUrl = RecipePdfService.buildPdfViewUrl(receta.id, receta.doctorId, emissionDate);

    res.json({
      success: true,
      data: {
        viewUrl,
        expiresIn: 'permanente (enlace con verificación segura)',
      },
    });
  } catch (error) {
    securityLogger.error('Error al generar URL de receta para paciente:', error);
    res.status(500).json({ success: false, message: 'Error al abrir la receta' });
  }
};
