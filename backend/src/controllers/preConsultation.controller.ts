import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import { randomBytes } from 'crypto';
import { NotificationService } from '../services/notification.service';
import { uploadToS3 } from '../utils/file.utils';
import { FileCategory } from '@prisma/client';
import { validateFile } from '../middlewares/upload.middleware';

const prisma = new PrismaClient();

// Generar token único para pre-consulta
const generatePreConsultationToken = (): string => {
  return randomBytes(32).toString('hex');
};

/**
 * Función auxiliar para crear automáticamente una pre-consulta cuando se crea una cita
 * Solo se crea si es la primera cita del paciente con ese doctor
 */
export const createPreConsultationForAppointment = async (appointmentId: string): Promise<string | null> => {
  try {
    console.log('=== INICIO createPreConsultationForAppointment ===');
    console.log('Appointment ID:', appointmentId);
    
    // Verificar que la cita existe
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!appointment) {
      console.error('Cita no encontrada para crear pre-consulta:', appointmentId);
      return null;
    }
    
    console.log('Cita encontrada:', {
      id: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      date: appointment.date
    });

    // Verificar si ya existe una pre-consulta para esta cita
    const existingPreConsultation = await prisma.preConsultation.findUnique({
      where: { appointmentId }
    });

    if (existingPreConsultation) {
      // Si ya existe y no está expirada, retornar el token existente
      if (existingPreConsultation.status !== 'EXPIRED' && new Date() <= existingPreConsultation.expiresAt) {
        return existingPreConsultation.token;
      }
      // Si está expirada, eliminarla y crear una nueva
      await prisma.preConsultation.delete({
        where: { id: existingPreConsultation.id }
      });
    }

    // Verificar si es la primera cita del paciente con este doctor
    // IMPORTANTE: Contar citas anteriores EXCLUYENDO la actual y solo las que son ANTES de la fecha actual
    // No contar citas en el mismo día o futuras
    const previousAppointments = await prisma.appointment.findMany({
      where: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        id: { not: appointmentId },
        date: { lt: appointment.date }
      },
      select: { id: true, date: true, status: true }
    });

    // Solo crear pre-consulta si es la primera cita
    console.log(`📊 Verificación de citas anteriores:`);
    console.log(`   Total citas anteriores encontradas: ${previousAppointments.length}`);
    if (previousAppointments.length > 0) {
      console.log(`   Detalles de citas anteriores:`);
      previousAppointments.forEach((apt, idx) => {
        console.log(`     ${idx + 1}. ID: ${apt.id}, Fecha: ${apt.date}, Status: ${apt.status}`);
      });
      console.log(`❌ No se crea pre-consulta: el paciente ya tiene ${previousAppointments.length} citas anteriores con este doctor`);
      return null;
    }
    console.log(`✅ No hay citas anteriores - es la primera cita del paciente con este doctor`);

    // Verificar si ya existe una consulta médica para este paciente con este doctor
    // Si ya existe, no crear pre-consulta (ya pasó la primera consulta)
    const existingConsultations = await prisma.medicalRecord.findMany({
      where: {
        patientId: appointment.patientId,
        doctorPatient: {
          doctorId: appointment.doctorId
        }
      },
      select: { id: true, createdAt: true }
    });

    console.log(`📊 Verificación de consultas médicas previas:`);
    console.log(`   Total consultas médicas encontradas: ${existingConsultations.length}`);
    if (existingConsultations.length > 0) {
      console.log(`   Detalles de consultas médicas:`);
      existingConsultations.forEach((consult, idx) => {
        console.log(`     ${idx + 1}. ID: ${consult.id}, Creada: ${consult.createdAt}`);
      });
      console.log(`❌ No se crea pre-consulta: ya existe ${existingConsultations.length} consulta(s) médica(s) previa(s)`);
      return null;
    }
    console.log(`✅ No hay consultas médicas previas`);
    
    console.log('Condiciones cumplidas: se procederá a crear la pre-consulta');

    // Crear nueva pre-consulta
    // La expiración será cuando se cree la primera consulta real, pero por ahora ponemos una fecha lejana
    // Se actualizará cuando se cree la primera consulta
    const token = generatePreConsultationToken();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Fecha lejana por defecto, se actualizará cuando se cree la consulta

    const preConsultation = await prisma.preConsultation.create({
      data: {
        token,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: 'PENDING',
        expiresAt
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/pre-consulta/${token}`;

    // Enviar email automático al paciente
    const notificationService = NotificationService.getInstance();
    
    // Obtener el nombre del doctor (puede que no esté incluido en el appointment)
    let doctorName = 'Dr.';
    // Verificar de manera segura si doctor.user existe usando type assertion
    const doctor = appointment.doctor as any;
    if (doctor?.user && typeof doctor.user === 'object' && 'firstName' in doctor.user && 'lastName' in doctor.user) {
      doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
    } else if (appointment.doctor?.userId) {
      // Si no está incluido, obtenerlo de la base de datos
      const doctorUser = await prisma.user.findUnique({
        where: { id: appointment.doctor.userId },
        select: { firstName: true, lastName: true }
      });
      if (doctorUser) {
        doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`;
      }
    }
    
    const appointmentDate = new Date(appointment.date).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    try {
      console.log('Enviando email de pre-consulta a:', {
        email: appointment.patient.user.email,
        phone: appointment.patient.user.phone,
        link: link,
        doctorName: doctorName,
        appointmentDate: appointmentDate
      });
      
      const result = await notificationService.sendPreConsultationLink(
        appointment.patient.user.email || '',
        appointment.patient.user.phone || '',
        link,
        doctorName,
        appointmentDate
      );
      
      console.log('Resultado del envío de pre-consulta:', result);
      console.log('Email de pre-consulta enviado exitosamente al paciente');
    } catch (notificationError: any) {
      console.error('Error enviando email de pre-consulta:', notificationError);
      if (notificationError?.stack) {
        console.error('Stack trace:', notificationError.stack);
      }
      // No fallar si el email falla
    }
    
    console.log('=== FIN createPreConsultationForAppointment (éxito) ===');

    console.log('=== FIN createPreConsultationForAppointment (éxito) ===');
    return token;
  } catch (error: any) {
    console.error('=== ERROR en createPreConsultationForAppointment ===');
    console.error('Error creando pre-consulta automática:', error);
    if (error?.stack) {
      console.error('Stack trace:', error.stack);
    }
    return null;
  }
};

/**
 * Generar link de pre-consulta para una cita
 * Solo doctores pueden generar estos links
 */
export const generatePreConsultationLink = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const user = req.user;

    if (!user || (user.role !== 'DOCTOR' && user.role !== 'ASISTENTE')) {
      throw new AppError('Solo profesionales de la salud pueden generar links de pre-consulta', 403);
    }

    // Verificar que la cita existe y pertenece al doctor
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true
      }
    });

    if (!appointment) {
      throw new AppError('Cita no encontrada', 404);
    }

    // Verificar que el doctor tiene acceso a esta cita
    if (user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: user.userId }
      });
      if (!doctor || doctor.id !== appointment.doctorId) {
        throw new AppError('No tienes permisos para acceder a esta cita', 403);
      }
    }

    // Verificar si ya existe una pre-consulta para esta cita
    let preConsultation = await prisma.preConsultation.findUnique({
      where: { appointmentId }
    });

    if (preConsultation) {
      // Si ya existe y está expirada, crear una nueva
      if (preConsultation.status === 'EXPIRED' || new Date() > preConsultation.expiresAt) {
        await prisma.preConsultation.delete({
          where: { id: preConsultation.id }
        });
        preConsultation = null;
      } else {
        // Retornar el link existente
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = `${frontendUrl}/pre-consulta/${preConsultation.token}`;
        
        return res.json({
          success: true,
          link,
          token: preConsultation.token,
          expiresAt: preConsultation.expiresAt,
          status: preConsultation.status
        });
      }
    }

    // Crear nueva pre-consulta
    const token = generatePreConsultationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expira en 7 días

    preConsultation = await prisma.preConsultation.create({
      data: {
        token,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: 'PENDING',
        expiresAt
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/pre-consulta/${token}`;

    // Enviar notificación al paciente con el link
    const notificationService = NotificationService.getInstance();
    
    // Obtener el nombre del doctor (puede que no esté incluido en el appointment)
    let doctorName = 'Dr.';
    // Verificar de manera segura si doctor.user existe usando type assertion
    const doctor = appointment.doctor as any;
    if (doctor?.user && typeof doctor.user === 'object' && 'firstName' in doctor.user && 'lastName' in doctor.user) {
      doctorName = `${doctor.user.firstName} ${doctor.user.lastName}`;
    } else if (appointment.doctor?.userId) {
      // Si no está incluido, obtenerlo de la base de datos
      const doctorUser = await prisma.user.findUnique({
        where: { id: appointment.doctor.userId },
        select: { firstName: true, lastName: true }
      });
      if (doctorUser) {
        doctorName = `${doctorUser.firstName} ${doctorUser.lastName}`;
      }
    }
    
    const appointmentDate = new Date(appointment.date).toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    try {
      await notificationService.sendPreConsultationLink(
        appointment.patient.email || '',
        appointment.patient.phone || '',
        link,
        doctorName,
        appointmentDate
      );
    } catch (notificationError) {
      console.error('Error enviando notificación de pre-consulta:', notificationError);
      // No fallar si la notificación falla, el link se puede compartir manualmente
    }

    res.json({
      success: true,
      link,
      token,
      expiresAt: preConsultation.expiresAt,
      status: preConsultation.status,
      message: 'Link de pre-consulta generado exitosamente. Se ha enviado al paciente por email y WhatsApp.'
    });
  } catch (error: any) {
    console.error('Error generando link de pre-consulta:', error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al generar link de pre-consulta'
    });
  }
};

/**
 * Obtener información de pre-consulta con token (sin autenticación)
 * Para que el paciente pueda acceder al formulario
 */
export const getPreConsultationByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const preConsultation = await prisma.preConsultation.findUnique({
      where: { token },
      include: {
        appointment: {
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
            },
            patient: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!preConsultation) {
      return res.status(404).json({
        success: false,
        message: 'Link de pre-consulta no válido o no encontrado'
      });
    }

    // Verificar si está expirado
    if (new Date() > preConsultation.expiresAt) {
      await prisma.preConsultation.update({
        where: { id: preConsultation.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(410).json({
        success: false,
        message: 'Este link de pre-consulta ha expirado. Por favor, contacta a tu profesional de la salud para obtener un nuevo link.'
      });
    }

    // Verificar si ya está completado
    if (preConsultation.status === 'COMPLETED') {
      return res.json({
        success: true,
        preConsultation: {
          id: preConsultation.id,
          status: preConsultation.status,
          completedAt: preConsultation.completedAt,
          formData: preConsultation.formData,
          appointment: {
            date: preConsultation.appointment.date,
            doctor: {
              firstName: preConsultation.appointment.doctor.user.firstName,
              lastName: preConsultation.appointment.doctor.user.lastName
            }
          }
        },
        message: 'Esta pre-consulta ya ha sido completada'
      });
    }

    res.json({
      success: true,
      preConsultation: {
        id: preConsultation.id,
        token: preConsultation.token,
        status: preConsultation.status,
        expiresAt: preConsultation.expiresAt,
        formData: preConsultation.formData || {},
        appointment: {
          id: preConsultation.appointment.id,
          date: preConsultation.appointment.date,
          doctor: {
            firstName: preConsultation.appointment.doctor.user.firstName,
            lastName: preConsultation.appointment.doctor.user.lastName,
            specialization: preConsultation.appointment.doctor.specialization
          },
          patient: {
            firstName: preConsultation.appointment.patient.user.firstName,
            lastName: preConsultation.appointment.patient.user.lastName,
            email: preConsultation.appointment.patient.user.email
          }
        }
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo pre-consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de pre-consulta'
    });
  }
};

/**
 * Guardar datos de pre-consulta (el paciente llena el formulario)
 */
export const savePreConsultationData = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { formData } = req.body;

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere formData con los datos de la pre-consulta'
      });
    }

    const preConsultation = await prisma.preConsultation.findUnique({
      where: { token }
    });

    if (!preConsultation) {
      return res.status(404).json({
        success: false,
        message: 'Link de pre-consulta no válido'
      });
    }

    // Verificar si está expirado
    if (new Date() > preConsultation.expiresAt) {
      await prisma.preConsultation.update({
        where: { id: preConsultation.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(410).json({
        success: false,
        message: 'Este link ha expirado. Por favor, contacta a tu profesional de la salud.'
      });
    }

    // Verificar si ya está completado
    if (preConsultation.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Esta pre-consulta ya ha sido completada'
      });
    }

    // Actualizar con los datos del formulario
    const updated = await prisma.preConsultation.update({
      where: { id: preConsultation.id },
      data: {
        formData: formData,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: 'Datos guardados exitosamente. Puedes continuar completando el formulario más tarde.',
      preConsultation: {
        id: updated.id,
        status: updated.status
      }
    });
  } catch (error: any) {
    console.error('Error guardando datos de pre-consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar datos de pre-consulta'
    });
  }
};

/**
 * Marcar pre-consulta como completada
 */
export const completePreConsultation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { formData } = req.body;

    if (!formData || typeof formData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Se requiere formData con los datos de la pre-consulta'
      });
    }

    const preConsultation = await prisma.preConsultation.findUnique({
      where: { token },
      include: {
        appointment: {
          include: {
            doctor: {
              include: {
                user: true
              }
            },
            patient: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (!preConsultation) {
      return res.status(404).json({
        success: false,
        message: 'Link de pre-consulta no válido'
      });
    }

    // Verificar si está expirado
    if (new Date() > preConsultation.expiresAt) {
      await prisma.preConsultation.update({
        where: { id: preConsultation.id },
        data: { status: 'EXPIRED' }
      });
      return res.status(410).json({
        success: false,
        message: 'Este link ha expirado'
      });
    }

    // Verificar si ya está completado
    if (preConsultation.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Esta pre-consulta ya ha sido completada'
      });
    }

    // Marcar como completada
    const updated = await prisma.preConsultation.update({
      where: { id: preConsultation.id },
      data: {
        formData: formData,
        status: 'COMPLETED',
        completedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Guardar pre-consulta en el historial clínico del paciente
    try {
      const appointment = preConsultation.appointment;
      const patient = appointment.patient;
      const doctor = appointment.doctor;

      // Obtener o crear la relación doctor-paciente
      let doctorPatient = await prisma.doctorPatient.findUnique({
        where: {
          doctorId_patientId: {
            doctorId: doctor.id,
            patientId: patient.id
          }
        }
      });

      if (!doctorPatient) {
        // Crear relación doctor-paciente si no existe
        doctorPatient = await prisma.doctorPatient.create({
          data: {
            doctorId: doctor.id,
            patientId: patient.id,
            status: 'active',
            context: 'Pre-consulta inicial',
            specialization: doctor.specialization || 'general',
            startDate: new Date()
          }
        });
      }

      // Obtener o crear un caso clínico para "Pre-consulta inicial"
      let clinicalCase = await prisma.clinicalCase.findFirst({
        where: {
          patientId: patient.id,
          padecimiento: 'Pre-consulta inicial'
        }
      });

      if (!clinicalCase) {
        clinicalCase = await prisma.clinicalCase.create({
          data: {
            patientId: patient.id,
            padecimiento: 'Pre-consulta inicial',
            status: 'ACTIVO'
          }
        });
      }

      // Extraer las notas reales del paciente
      const patientNotes = formData?.notes || '';
      const notesText = patientNotes.trim() 
        ? `${patientNotes}\n\n[Pre-consulta completada el ${new Date().toLocaleDateString('es-MX')}]`
        : `Pre-consulta completada el ${new Date().toLocaleDateString('es-MX')}. El paciente proporcionó información previa a la consulta médica.`;

      // Verificar si hay archivos adjuntos
      const hasFiles = formData?.files && (
        (Array.isArray(formData.files.PATIENT_PHOTO) && formData.files.PATIENT_PHOTO.length > 0) ||
        (Array.isArray(formData.files.STUDY_RESULT) && formData.files.STUDY_RESULT.length > 0) ||
        (Array.isArray(formData.files.PRESCRIPTION_REQUEST) && formData.files.PRESCRIPTION_REQUEST.length > 0) ||
        (Array.isArray(formData.files.DOCTOR_PHOTO) && formData.files.DOCTOR_PHOTO.length > 0)
      );

      // Crear registro médico con los datos de la pre-consulta
      const medicalRecord = await prisma.medicalRecord.create({
        data: {
          patientId: patient.id,
          clinicalCaseId: clinicalCase.id,
          doctorPatientId: doctorPatient.id,
          userId: patient.userId,
          autorConsultaId: patient.userId, // El paciente completó la pre-consulta
          realizadoPor: patient.userId,
          vinculadoADoctor: doctor.id,
          diagnosis: 'Pre-consulta completada',
          treatment: 'Pendiente de evaluación médica',
          notes: notesText, // Usar las notas reales del paciente
          reason: formData?.reason || 'Pre-consulta inicial',
          tags: formData?.tags && Array.isArray(formData.tags) ? formData.tags : ['pre-consulta', 'evaluación-inicial'],
          clinicalEvolution: formData?.clinicalEvolution || 'INITIAL_EVALUATION',
          formData: formData, // Guardar todos los datos del formulario
          date: preConsultation.completedAt || new Date(),
          isPublic: formData?.isPublic !== undefined ? formData.isPublic : true,
          isComplete: false,
          hasAttachments: !!hasFiles,
          isEditable: true
        }
      });

      // Asociar archivos al registro médico si existen
      if (hasFiles && formData.files) {
        try {
          let filesAssociated = 0;
          
          // Procesar archivos de cada categoría
          const processFiles = async (files: any[], category: string) => {
            if (Array.isArray(files)) {
              for (const fileData of files) {
                if (!fileData.url) continue;
                
                try {
                  // Buscar si el archivo ya existe en la base de datos
                  let existingFile = await prisma.file.findUnique({
                    where: { url: fileData.url }
                  });

                  if (existingFile) {
                    // Actualizar archivo existente para asociarlo al registro médico
                    await prisma.file.update({
                      where: { id: existingFile.id },
                      data: {
                        medicalRecordId: medicalRecord.id,
                        category: category as any,
                        patientId: patient.id,
                        doctorPatientId: doctorPatient.id,
                        fileType: fileData.type || existingFile.fileType
                      }
                    });
                    filesAssociated++;
                  } else {
                    // Crear nuevo registro de archivo
                    await prisma.file.create({
                      data: {
                        fileName: fileData.fileName || fileData.url.split('/').pop() || 'archivo',
                        fileType: fileData.type || fileData.fileType || 'image/jpeg',
                        size: fileData.size || 0,
                        url: fileData.url,
                        category: category as any,
                        uploadedById: patient.userId,
                        medicalRecordId: medicalRecord.id,
                        patientId: patient.id,
                        doctorPatientId: doctorPatient.id
                      }
                    });
                    filesAssociated++;
                  }
                } catch (fileError: any) {
                  console.error('Error asociando archivo individual:', fileError);
                  // Continuar con el siguiente archivo
                }
              }
            }
          };

          if (formData.files.PATIENT_PHOTO) {
            await processFiles(formData.files.PATIENT_PHOTO, 'PATIENT_PHOTO');
          }
          if (formData.files.STUDY_RESULT) {
            await processFiles(formData.files.STUDY_RESULT, 'STUDY_RESULT');
          }
          if (formData.files.PRESCRIPTION_REQUEST) {
            await processFiles(formData.files.PRESCRIPTION_REQUEST, 'PRESCRIPTION_REQUEST');
          }
          if (formData.files.DOCTOR_PHOTO) {
            await processFiles(formData.files.DOCTOR_PHOTO, 'DOCTOR_PHOTO');
          }

          // Actualizar hasAttachments si se asociaron archivos
          if (filesAssociated > 0) {
            await prisma.medicalRecord.update({
              where: { id: medicalRecord.id },
              data: { hasAttachments: true }
            });
            console.log(`✅ ${filesAssociated} archivo(s) asociado(s) al registro médico`);
          }
        } catch (filesError: any) {
          console.error('⚠️  Error asociando archivos al registro médico:', filesError);
          // No fallar la operación si hay error al asociar archivos
        }
      }

      console.log('✅ Pre-consulta guardada en historial clínico del paciente');
    } catch (historyError: any) {
      console.error('⚠️  Error guardando pre-consulta en historial clínico:', historyError);
      // No fallar la operación si hay error al guardar en historial, pero registrar el error
    }

    // Notificar al doctor que la pre-consulta está completa
    const notificationService = NotificationService.getInstance();
    try {
      await notificationService.sendPreConsultationCompletedNotification(
        preConsultation.appointment.doctor.user.email || '',
        preConsultation.appointment.doctor.user.phone || '',
        preConsultation.appointment.patient.user.firstName + ' ' + preConsultation.appointment.patient.user.lastName,
        preConsultation.appointment.date
      );
    } catch (notificationError) {
      console.error('Error enviando notificación al doctor:', notificationError);
    }

    res.json({
      success: true,
      message: 'Pre-consulta completada exitosamente. Tu profesional de la salud revisará esta información antes de tu cita.',
      preConsultation: {
        id: updated.id,
        status: updated.status,
        completedAt: updated.completedAt
      }
    });
  } catch (error: any) {
    console.error('Error completando pre-consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar pre-consulta'
    });
  }
};

/**
 * Obtener pre-consultas de una cita (para el doctor)
 */
export const getPreConsultationByAppointment = async (req: AuthRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const user = req.user;

    if (!user || (user.role !== 'DOCTOR' && user.role !== 'ASISTENTE')) {
      throw new AppError('Solo profesionales de la salud pueden ver pre-consultas', 403);
    }

    const preConsultation = await prisma.preConsultation.findUnique({
      where: { appointmentId },
      include: {
        appointment: {
          include: {
            patient: {
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

    if (!preConsultation) {
      return res.json({
        success: true,
        preConsultation: null,
        message: 'No hay pre-consulta para esta cita'
      });
    }

    res.json({
      success: true,
      preConsultation: {
        id: preConsultation.id,
        status: preConsultation.status,
        formData: preConsultation.formData,
        completedAt: preConsultation.completedAt,
        createdAt: preConsultation.createdAt,
        expiresAt: preConsultation.expiresAt,
        appointment: {
          date: preConsultation.appointment.date,
          patient: {
            firstName: preConsultation.appointment.patient.user.firstName,
            lastName: preConsultation.appointment.patient.user.lastName,
            email: preConsultation.appointment.patient.user.email
          }
        }
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo pre-consulta:', error);
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Error al obtener pre-consulta'
    });
  }
};

/**
 * Middleware: validar token de pre-consulta y adjuntar preConsultation al request
 */
export const validatePreConsultationToken = async (req: Request, res: Response, next: Function) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token de pre-consulta requerido' });
    }

    const preConsultation = await prisma.preConsultation.findUnique({
      where: { token },
      include: {
        appointment: {
          include: {
            patient: { include: { user: { select: { id: true } } } }
          }
        }
      }
    });

    if (!preConsultation) {
      return res.status(404).json({ success: false, message: 'Link de pre-consulta no válido' });
    }
    if (new Date() > preConsultation.expiresAt) {
      return res.status(410).json({ success: false, message: 'Este link ha expirado' });
    }
    if (preConsultation.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Esta pre-consulta ya fue completada' });
    }

    (req as any).preConsultation = preConsultation;
    next();
  } catch (error: any) {
    console.error('Error validando token de pre-consulta:', error);
    res.status(500).json({ success: false, message: 'Error al validar el link' });
  }
};

/**
 * Subir archivo en pre-consulta (sin autenticación JWT - usa token de pre-consulta)
 */
export const uploadFileForPreConsultation = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const preConsultation = (req as any).preConsultation;
    const { category } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No se ha subido ningún archivo' });
    }
    if (!preConsultation) {
      return res.status(401).json({ success: false, message: 'Token de pre-consulta inválido' });
    }
    if (!category || !Object.values(FileCategory).includes(category)) {
      return res.status(400).json({ success: false, message: 'Categoría de archivo inválida' });
    }

    const validation = validateFile(file);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const patientUserId = preConsultation.appointment.patient.user.id;
    const { url } = await uploadToS3(file, category, patientUserId);

    res.status(201).json({
      message: 'Archivo subido exitosamente',
      file: {
        fileName: file.originalname,
        url,
        type: file.mimetype,
        size: file.size
      }
    });
  } catch (error: any) {
    console.error('Error subiendo archivo en pre-consulta:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al subir el archivo'
    });
  }
};

