import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { securityLogger } from '../utils/logger.utils';

const prisma = new PrismaClient();

export class ConsultationController {
  static async createBasicConsultation(req: AuthRequest, res: Response) {
    try {
      const { patientId, clinicalCaseId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      if (!patientId) {
        throw new AppError('El ID del paciente es obligatorio', 400);
      }

      if (!clinicalCaseId) {
        throw new AppError('El caso clínico es obligatorio. Selecciona un padecimiento antes de crear la consulta.', 400);
      }

      // Validar doctor y vínculo doctor-paciente
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) {
        throw new AppError('Perfil de doctor no encontrado', 404);
      }

      // Buscar relación titular; si no existe, permitir si es colaborador del caso
      let doctorPatientLink = await prisma.doctorPatient.findUnique({
        where: { doctorId_patientId: { doctorId: doctor.id, patientId } }
      });

      if (!doctorPatientLink) {
        const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
          where: { doctorId: doctor.id, patientId, padecimientoId: clinicalCaseId }
        });
        if (!isCollaborator) {
          throw new AppError('No tienes acceso a este paciente. Verifica que seas el doctor titular o colaborador del caso clínico.', 403);
        }
        // Usar la relación doctorPatient del titular como vínculo para la consulta
        const titularLink = await prisma.doctorPatient.findFirst({ where: { patientId } });
        if (!titularLink) {
          throw new AppError('No se encontró vínculo titular para este paciente', 500);
        }
        doctorPatientLink = titularLink;
      }

      // Datos enviados desde el frontend (parte básica)
      const {
        date,
        reason,
        notes,
        isPublic,
        clinicalEvolution,
        tags = [],
        formData = {}
      } = req.body;

      // Crear la consulta básica
      const consultation = await prisma.medicalRecord.create({
        data: {
          patientId,
          clinicalCaseId,
          doctorPatientId: doctorPatientLink.id,
          userId,
          autorConsultaId: userId,
          realizadoPor: userId,
          vinculadoADoctor: doctor.id,
          diagnosis: notes,
          treatment: notes,
          notes,
          reason,
          tags,
          clinicalEvolution,
          formData,
          date: date ? new Date(date) : new Date(),
          isPublic: typeof isPublic === 'boolean' ? isPublic : true,
          isComplete: false,
          hasAttachments: false
        }
      });

      // Marcar notas anteriores del mismo caso clínico como no editables
      await prisma.medicalRecord.updateMany({
        where: { clinicalCaseId: clinicalCaseId, createdAt: { lt: consultation.createdAt } },
        data: { isEditable: false }
      });

      // Si es la primera consulta del paciente con este doctor, expirar cualquier pre-consulta pendiente
      const previousConsultations = await prisma.medicalRecord.count({
        where: {
          patientId,
          doctorPatient: {
            doctorId: doctor.id
          },
          id: { not: consultation.id },
          createdAt: { lt: consultation.createdAt }
        }
      });

      if (previousConsultations === 0) {
        // Es la primera consulta, expirar pre-consultas pendientes
        await prisma.preConsultation.updateMany({
          where: {
            patientId,
            doctorId: doctor.id,
            status: 'PENDING'
          },
          data: {
            status: 'EXPIRED',
            expiresAt: new Date() // Marcar como expirada ahora
          }
        });
        console.log('Pre-consultas expiradas al crear la primera consulta real');
      }

      securityLogger.info(`Consulta básica creada: ${consultation.id} para paciente: ${patientId}`);

      res.status(201).json({
        success: true,
        data: consultation,
        message: 'Consulta básica creada exitosamente. Las consultas anteriores han sido bloqueadas.'
      });

    } catch (error: any) {
      securityLogger.error('Error al crear consulta básica:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      // Errores de Prisma (FK, validación, etc.)
      if (error.code === 'P2003') {
        return res.status(400).json({
          message: 'Datos inválidos: el paciente o el caso clínico no existen. Verifica que hayas seleccionado un padecimiento.'
        });
      }
      if (error.code === 'P2025') {
        return res.status(404).json({ message: 'Registro no encontrado. Recarga la página e intenta de nuevo.' });
      }
      const message = error.message || 'Error al crear la consulta básica';
      res.status(500).json({ message });
    }
  }

  static async addAttachmentsToConsultation(req: AuthRequest, res: Response) {
    try {
      const { consultationId } = req.params;
      const { files: filesRaw, links } = req.body;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      // Verificar que la consulta existe y no está bloqueada
      const consultation = await prisma.medicalRecord.findUnique({ where: { id: consultationId } });

      if (!consultation) {
        throw new AppError('Consulta no encontrada', 404);
      }

      // Bloquear si la consulta no es editable (existe otra más reciente del mismo caso)
      if (!consultation.isEditable) {
        throw new AppError('Esta consulta está bloqueada (solo lectura) porque existe una consulta más reciente.', 403);
      }

      // Normalizar lista de archivos (aceptar arreglo o objeto indexado)
      // Si viene como objeto con categorías, convertirlo a array plano
      let files: any[] = [];
      if (Array.isArray(filesRaw)) {
        // Formato antiguo: array plano (mantener compatibilidad)
        // Validar categorías para pacientes si vienen en el array
        if (userRole === 'PATIENT') {
          for (const file of filesRaw) {
            const category = (file as any).category;
            if (category === 'PRESCRIPTION_REQUEST' || category === 'DOCTOR_PHOTO') {
              throw new AppError(`Los pacientes no pueden subir archivos en la categoría "${category}". Solo pueden subir en "Resultados de Estudios" y "Fotos Subidas por Paciente".`, 403);
            }
            // Solo permitir STUDY_RESULT y PATIENT_PHOTO
            if (category === 'STUDY_RESULT' || category === 'PATIENT_PHOTO') {
              files.push(file);
            }
          }
        } else {
          files = filesRaw;
        }
      } else if (filesRaw && typeof filesRaw === 'object') {
        // Si viene como objeto { PRESCRIPTION_REQUEST: [...], STUDY_RESULT: [...], etc. }
        // Convertir a array plano con la categoría incluida
        for (const [category, fileList] of Object.entries(filesRaw)) {
          if (Array.isArray(fileList)) {
            // Validar categorías permitidas para pacientes
            if (userRole === 'PATIENT') {
              if (category === 'PRESCRIPTION_REQUEST' || category === 'DOCTOR_PHOTO') {
                throw new AppError(`Los pacientes no pueden subir archivos en la categoría "${category}". Solo pueden subir en "Resultados de Estudios" y "Fotos Subidas por Paciente".`, 403);
              }
              // Solo permitir STUDY_RESULT y PATIENT_PHOTO
              if (category !== 'STUDY_RESULT' && category !== 'PATIENT_PHOTO') {
                continue; // Ignorar otras categorías
              }
            }
            // Agregar la categoría a cada archivo
            fileList.forEach((file: any) => {
              files.push({
                ...file,
                category: category
              });
            });
          }
        }
      }

      let filesProcessed = 0;

      // Asociar archivos si se proporcionaron (preferir id si viene del upload)
      if (files && files.length > 0) {
        for (const file of files) {
          try {
            if (file.id) {
              await prisma.file.update({
                where: { id: file.id },
                data: {
                  category: (file as any).category || undefined,
                  uploadedById: userId,
                  medicalRecordId: consultationId,
                  doctorId: (consultation as any).vinculadoADoctor || undefined,
                  patientId: consultation.patientId
                }
              });
              filesProcessed++;
            } else if (file.url) {
              await prisma.file.upsert({
                where: { url: file.url },
                update: {
                  fileName: file.fileName || undefined,
                  fileType: file.fileType || undefined,
                  size: file.size || undefined,
                  category: (file as any).category || undefined,
                  uploadedById: userId,
                  medicalRecordId: consultationId,
                  doctorId: (consultation as any).vinculadoADoctor || undefined,
                  patientId: consultation.patientId
                },
                create: {
                  fileName: file.fileName,
                  fileType: file.fileType,
                  size: file.size,
                  url: file.url,
                  category: (file as any).category,
                  uploadedById: userId,
                  medicalRecordId: consultationId,
                  doctorId: (consultation as any).vinculadoADoctor || undefined,
                  patientId: consultation.patientId
                }
              });
              filesProcessed++;
            }
          } catch (e) {
            securityLogger.error('No se pudo asociar archivo a la consulta', e);
          }
        }
      }

      // Crear enlaces si se proporcionaron
      if (links && links.length > 0) {
        const linkData = links.map((link: any) => ({
          url: link.url,
          description: link.description,
          medicalRecordId: consultationId
        }));

        await prisma.link.createMany({
          data: linkData
        });
      }

      // Actualizar el estado de la consulta
      const hasFiles = filesProcessed > 0;
      const hasLinks = links && links.length > 0;
      const hasAttachments = hasFiles || hasLinks;

      await prisma.medicalRecord.update({
        where: { id: consultationId },
        data: {
          hasAttachments: hasAttachments,
          isComplete: hasAttachments // Marcar como completa si tiene archivos
        }
      });

      // Obtener archivos y links actuales para confirmar asociación
      const updated = await prisma.medicalRecord.findUnique({
        where: { id: consultationId },
        include: {
          files: true,
          links: true
        }
      });

      securityLogger.info(`Archivos agregados a consulta: ${consultationId}`);

      res.status(200).json({
        success: true,
        message: 'Archivos agregados exitosamente',
        data: {
          consultationId,
          filesAdded: filesProcessed,
          linksAdded: links?.length || 0,
          files: updated?.files || [],
          links: updated?.links || []
        }
      });

    } catch (error: any) {
      securityLogger.error('Error al agregar archivos a consulta:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al agregar archivos', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  /**
   * Actualizar consulta (guardado parcial) - solo si isEditable.
   * Permite al doctor o colaborador añadir/editar notas, formData, etc. hasta que se cree una nueva consulta.
   */
  static async updateConsultation(req: AuthRequest, res: Response) {
    try {
      const { consultationId } = req.params;
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const consultation = await prisma.medicalRecord.findUnique({
        where: { id: consultationId },
        include: { clinicalCase: true }
      });

      if (!consultation) {
        throw new AppError('Consulta no encontrada', 404);
      }

      if (!consultation.isEditable) {
        throw new AppError('Esta consulta está cerrada. Solo se puede editar la consulta más reciente hasta que se cree una nueva.', 403);
      }

      // Verificar permiso: doctor titular, autor o colaborador del caso
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (!doctor) {
        throw new AppError('Perfil de doctor no encontrado', 404);
      }

      const isAuthor = consultation.autorConsultaId === userId;
      const isLinkedDoctor = consultation.vinculadoADoctor === doctor.id;
      const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
        where: {
          doctorId: doctor.id,
          patientId: consultation.patientId,
          padecimientoId: consultation.clinicalCaseId
        }
      });

      const canEdit = isAuthor || isLinkedDoctor || !!isCollaborator || userRole === 'ASISTENTE';
      if (!canEdit) {
        throw new AppError('No tienes permiso para editar esta consulta', 403);
      }

      const {
        notes,
        reason,
        date,
        tags,
        clinicalEvolution,
        formData,
        isPublic,
        diagnosis,
        treatment
      } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (notes !== undefined) updateData.notes = notes;
      if (reason !== undefined) updateData.reason = reason;
      if (date !== undefined) updateData.date = date ? new Date(date) : null;
      if (Array.isArray(tags)) updateData.tags = tags;
      if (clinicalEvolution !== undefined) updateData.clinicalEvolution = clinicalEvolution;
      if (formData !== undefined && typeof formData === 'object') updateData.formData = formData;
      if (typeof isPublic === 'boolean') updateData.isPublic = isPublic;
      if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
      if (treatment !== undefined) updateData.treatment = treatment;

      const updated = await prisma.medicalRecord.update({
        where: { id: consultationId },
        data: updateData
      });

      securityLogger.info(`Consulta actualizada (guardado parcial): ${consultationId}`);

      res.status(200).json({
        success: true,
        data: updated,
        message: 'Consulta actualizada'
      });
    } catch (error: any) {
      securityLogger.error('Error al actualizar consulta:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al actualizar consulta', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  static async markConsultationComplete(req: AuthRequest, res: Response) {
    try {
      const { consultationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const consultation = await prisma.medicalRecord.update({
        where: { id: consultationId },
        data: { isComplete: true }
      });

      securityLogger.info(`Consulta marcada como completa: ${consultationId}`);

      res.status(200).json({
        success: true,
        data: consultation,
        message: 'Consulta marcada como completa'
      });

    } catch (error: any) {
      securityLogger.error('Error al marcar consulta como completa:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al marcar consulta como completa', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  static async getPendingConsultations(req: AuthRequest, res: Response) {
    try {
      let { patientId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      // Paciente: solo puede consultar su propio historial ('self' o su UUID)
      if (req.user?.role === 'PATIENT') {
        const patient = await prisma.patient.findUnique({
          where: { userId },
          select: { id: true }
        });
        if (!patient) {
          throw new AppError('Perfil de paciente no encontrado', 404);
        }
        if (patientId === 'self') {
          patientId = patient.id;
        } else if (patientId !== patient.id) {
          throw new AppError('Acceso denegado', 403);
        }
      }

      const { clinicalCaseId } = req.query;
      const whereClause: any = { patientId, isComplete: false };
      if (clinicalCaseId && typeof clinicalCaseId === 'string') {
        whereClause.clinicalCaseId = clinicalCaseId;
      }

      const consultations = await prisma.medicalRecord.findMany({
        where: whereClause,
        include: {
          files: true,
          links: true
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
      });

      res.status(200).json({
        success: true,
        data: consultations
      });

    } catch (error: any) {
      securityLogger.error('Error al obtener consultas pendientes:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al obtener consultas pendientes', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  static async getConsultationStats(req: AuthRequest, res: Response) {
    try {
      let { patientId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      // Paciente: solo puede consultar sus propias estadísticas ('self' o su UUID)
      if (req.user?.role === 'PATIENT') {
        const patient = await prisma.patient.findUnique({
          where: { userId },
          select: { id: true }
        });
        if (!patient) {
          throw new AppError('Perfil de paciente no encontrado', 404);
        }
        if (patientId === 'self') {
          patientId = patient.id;
        } else if (patientId !== patient.id) {
          throw new AppError('Acceso denegado', 403);
        }
      }

      const { clinicalCaseId } = req.query;
      const statsWhere: any = { patientId };
      if (clinicalCaseId && typeof clinicalCaseId === 'string') {
        statsWhere.clinicalCaseId = clinicalCaseId;
      }

      const stats = await prisma.medicalRecord.groupBy({
        by: ['isComplete', 'hasAttachments'],
        where: statsWhere,
        _count: {
          id: true
        }
      });

      const total = await prisma.medicalRecord.count({
        where: statsWhere
      });

      const complete = stats.find(s => (s as any).isComplete)?._count.id || 0;
      const withAttachments = stats.find(s => (s as any).hasAttachments)?._count.id || 0;

      res.status(200).json({
        success: true,
        data: {
          total,
          complete,
          withAttachments,
          pending: total - complete
        }
      });

    } catch (error: any) {
      securityLogger.error('Error al obtener estadísticas de consultas:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al obtener estadísticas', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Nuevo método para obtener archivos por categoría
  static async getFilesByCategory(req: AuthRequest, res: Response) {
    try {
      const { consultationId } = req.params;
      const { category } = req.query;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const whereClause: any = {
        medicalRecordId: consultationId
      };

      if (category) {
        whereClause.category = category;
      }

      const files = await prisma.file.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: files
      });

    } catch (error: any) {
      securityLogger.error('Error al obtener archivos por categoría:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al obtener archivos', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Método para verificar si una consulta está bloqueada
  static async checkConsultationLock(req: AuthRequest, res: Response) {
    try {
      const { consultationId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      const consultation = await prisma.medicalRecord.findUnique({
        where: { id: consultationId },
        select: {
          id: true,
          isComplete: true,
          hasAttachments: true,
          createdAt: true
        }
      });

      if (!consultation) {
        throw new AppError('Consulta no encontrada', 404);
      }

      res.status(200).json({
        success: true,
        data: {
          isLocked: false,
          isComplete: consultation.isComplete,
          hasAttachments: consultation.hasAttachments,
          canEdit: true,
          createdAt: consultation.createdAt
        }
      });

    } catch (error: any) {
      securityLogger.error('Error al verificar bloqueo de consulta:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al verificar bloqueo', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }

  // Obtener consultas médicas de un paciente
  static async getPatientConsultations(req: AuthRequest, res: Response) {
    try {
      const { patientId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError('Usuario no autenticado', 401);
      }

      let doctorId: string | null = null;

      if (req.user?.role === 'DOCTOR') {
        const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { id: true } });
        doctorId = doctor?.id || null;
      } else if (req.user?.role === 'ASISTENTE') {
        const selectedDoctorId = req.headers['x-selected-doctor-id'];
        if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
          throw new AppError('Doctor seleccionado requerido', 400);
        }

        const link = await prisma.asistenteDoctorVinculo.findFirst({
          where: {
            doctorId: selectedDoctorId,
            asistenteId: userId,
            activo: true
          },
          select: { id: true }
        });

        if (!link) {
          throw new AppError('Asistente no vinculado a este doctor', 403);
        }

        doctorId = selectedDoctorId;
      }

      if (!doctorId) {
        throw new AppError('Perfil de doctor no encontrado', 404);
      }

      const doctorPatientLink = await prisma.doctorPatient.findUnique({
        where: { doctorId_patientId: { doctorId: doctorId, patientId } }
      });
      if (!doctorPatientLink) {
        throw new AppError('No tienes acceso a este paciente', 403);
      }

      // Obtener consultas médicas del paciente
      const consultations = await prisma.medicalRecord.findMany({
        where: {
          patientId: patientId,
          doctorPatientId: doctorPatientLink.id
        },
        include: {
          clinicalCase: {
            select: {
              id: true,
              padecimiento: true
            }
          }
        },
        orderBy: [
          { date: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      res.json(consultations);
    } catch (error: any) {
      securityLogger.error('Error al obtener consultas del paciente:', error);
      const handled = error instanceof AppError ? error : new AppError('Error al obtener consultas', 500);
      res.status(handled.statusCode).json({ message: handled.message });
    }
  }
} 