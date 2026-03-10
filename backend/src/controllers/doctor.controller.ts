import { Request, Response } from 'express';
import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/error.utils';
import { randomBytes, randomBytes as cryptoRandomBytes } from 'crypto';
import { UserRole, FileCategory } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { uploadToS3 } from '../utils/file.utils';
import { NotificationService } from '../services/notification.service';

// Función para mapear ClinicalEvolution a valores legibles
const mapClinicalEvolution = (evolution: string | null): string | null => {
  if (!evolution) return null;
  
  const evolutionMap: { [key: string]: string } = {
    'INITIAL_EVALUATION': 'Evaluación Inicial',
    'CONFIRMED_DIAGNOSIS': 'Diagnóstico',
    'TREATMENT_PLAN': 'Plan de Tratamiento',
    'FOLLOW_UP': 'Seguimiento',
    'STABILIZATION': 'Estabilización',
    'MEDICAL_DISCHARGE': 'Alta Médica',
    'READMISSION': 'Reingreso'
  };
  
  return evolutionMap[evolution] || evolution;
};

// Función para formatear fecha en formato dd-MMM-yy
const formatDate = (date: Date | null): string | null => {
  if (!date) return null;
  
  // Asegurar que la fecha se maneje correctamente
  let displayDate: Date;
  if (typeof date === 'string') {
    // Si es un string, convertirlo a Date
    displayDate = new Date(date);
  } else {
    // Si ya es un objeto Date
    displayDate = new Date(date);
  }
  
  // Verificar que la fecha sea válida
  if (isNaN(displayDate.getTime())) {
    console.error('Fecha inválida recibida:', date);
    return null;
  }
  
  const months = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];
  
  // Usar UTC para evitar problemas de zona horaria
  const day = displayDate.getUTCDate().toString().padStart(2, '0');
  const month = months[displayDate.getUTCMonth()];
  const year = displayDate.getUTCFullYear().toString().slice(-2);
  
  console.log('Fecha original:', date);
  console.log('Fecha procesada (UTC):', displayDate.toISOString());
  console.log('Día UTC:', day, 'Mes UTC:', month, 'Año UTC:', year);
  console.log('Fecha formateada:', `${day}-${month}-${year}`);
  
  return `${day}-${month}-${year}`;
};

// =================================================================
// OBTENER DETALLES DE UN PACIENTE
// =================================================================
export const getPatientDetails = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    let doctorId: string | null = null;

    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
      if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
      doctorId = doctor.id;
    } else if (req.user.role === 'ASISTENTE') {
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

    // Caso especial: doctor que también es paciente viendo su propio historial
    const patientForSelfView = await prisma.patient.findUnique({
      where: { id: req.params.patientId },
      select: { userId: true }
    });
    const isViewingOwnPatientProfile = patientForSelfView && patientForSelfView.userId === req.user!.userId;

    let doctorPatientLink = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId, patientId: req.params.patientId } }
    });
    let isCollaborator = false;
    let collaborativeCaseIds: string[] = [];

    if (!isViewingOwnPatientProfile && !doctorPatientLink) {
      const collaborationCheck = await prisma.padecimientoDoctorColaborador.findMany({
        where: {
          doctorId,
          patientId: req.params.patientId
        },
        select: {
          padecimientoId: true
        }
      });
      if (collaborationCheck.length === 0) {
        throw new AppError('Paciente no encontrado o no asociado a este doctor.', 404);
      }
      isCollaborator = true;
      collaborativeCaseIds = collaborationCheck.map(c => c.padecimientoId);
    }



    const patient = await prisma.patient.findUnique({
      where: { id: req.params.patientId },
      include: {
        user: true,
        emergencyContacts: true,
        clinicalCases: {
          where: isCollaborator ? { id: { in: collaborativeCaseIds } } : undefined,
          include: {
            medicalRecords: { 
              orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
              include: { 
                doctorPatient: { 
                  include: { 
                    doctor: { 
                      select: { 
                        user: { select: { firstName: true, lastName: true } } 
                      } 
                    } 
                  } 
                } 
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
      },
    });

    if (!patient) throw new AppError('Paciente no encontrado.', 404);
    
    res.json(patient);
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al obtener detalles del paciente.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};


// =================================================================
// BUSCAR PACIENTES ASIGNADOS AL DOCTOR
// =================================================================
export const searchMyPatients = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) throw new AppError('Autenticación requerida.', 401);
        const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
        if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
        // Debug minimal: doctor id
        console.log('searchMyPatients - doctor.id:', doctor.id);

        const searchTerm = req.query.term as string;
        if (!searchTerm || searchTerm.length < 2) return res.json([]);

        const patients = await prisma.patient.findMany({
            where: {
                doctors: { some: { doctorId: doctor.id } },
                OR: [
                    { user: {
                        OR: [
                            { firstName: { contains: searchTerm, mode: 'insensitive' } },
                            { lastName: { contains: searchTerm, mode: 'insensitive' } },
                            { email: { contains: searchTerm, mode: 'insensitive' } },
                        ]
                    }},
                    { medicalRecords: {
                        some: {
                            OR: [
                                { diagnosis: { contains: searchTerm, mode: 'insensitive' } },
                                { tags: { has: searchTerm.toLowerCase() } }
                            ]
                        }
                    }}
                ]
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    }
                }
            }
        });
        
        const results = patients.map(p => ({
            id: p.id,
            firstName: p.user.firstName,
            lastName: p.user.lastName,
            email: (p.user?.email && !String(p.user.email).startsWith(NO_EMAIL_PLACEHOLDER_PREFIX)) ? p.user.email : null,
            profilePictureUrl: p.profilePictureUrl,
        }));
        
        res.json(results);
    } catch (error: any) {
        console.error("Error en búsqueda de pacientes:", error);
        const handled = error instanceof AppError ? error : new AppError('Error al buscar pacientes.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
};


// =================================================================
// CREAR UN PACIENTE NUEVO (O VINCULAR UNO EXISTENTE)
// =================================================================
/** Email placeholder para pacientes sin correo. Cada paciente sin email recibe uno único para evitar cruce entre doctores. */
const NO_EMAIL_PLACEHOLDER_PREFIX = 'patient-no-email@';

export const createPatient = async (req: AuthRequest, res: Response) => {
  if (!(req as any).user) throw new AppError('Autenticación requerida.', 401);
  const { email, firstName, lastName, phone, dateOfBirth } = req.body;

  try {
    let doctorProfile: { id: string; specialization: string | null; taxName: string | null; user: { firstName: string; lastName: string } } | null = null;

    if (req.user!.role === 'DOCTOR') {
      doctorProfile = await prisma.doctor.findUnique({
        where: { userId: req.user!.userId },
        select: { id: true, specialization: true, taxName: true, user: { select: { firstName: true, lastName: true } } }
      });
    } else if (req.user!.role === 'ASISTENTE') {
      const selectedDoctorId = req.headers['x-selected-doctor-id'];
      if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
        throw new AppError('Doctor seleccionado requerido.', 400);
      }
      const link = await prisma.asistenteDoctorVinculo.findFirst({
        where: { doctorId: selectedDoctorId, asistenteId: req.user!.userId, activo: true }
      });
      if (!link) throw new AppError('Asistente no vinculado a este doctor.', 403);
      doctorProfile = await prisma.doctor.findUnique({
        where: { id: selectedDoctorId },
        select: { id: true, specialization: true, taxName: true, user: { select: { firstName: true, lastName: true } } }
      });
    }

    if (!doctorProfile) {
      throw new AppError('El perfil del doctor no fue encontrado.', 404);
    }

    // CRÍTICO: Si el email está vacío o es placeholder, NUNCA buscar usuario existente.
    // Cada doctor debe crear su propio paciente con email placeholder único.
    // Evita que un paciente de otro doctor aparezca en la lista por coincidencia de email vacío.
    const hasRealEmail = !!(email && typeof email === 'string' && email.trim() !== '' && !email.startsWith(NO_EMAIL_PLACEHOLDER_PREFIX));
    const effectiveEmail = hasRealEmail ? email.trim().toLowerCase() : `${NO_EMAIL_PLACEHOLDER_PREFIX}${randomBytes(12).toString('hex')}.qlinexa360.local`;

    let user = hasRealEmail ? await prisma.user.findUnique({ where: { email: effectiveEmail }, include: { doctorProfile: true, patientProfile: true } }) : null;
    if (user) {
      let patientProfile = user.patientProfile;

      // Opción A: Usuario existe pero NO tiene perfil de paciente (ej. es DOCTOR que se vuelve paciente)
      if (!patientProfile && user.doctorProfile) {
        const dob = dateOfBirth ? new Date(dateOfBirth) : new Date(); // Mismo fallback que paciente nuevo
        patientProfile = await prisma.patient.create({
          data: {
            userId: user.id,
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            email: effectiveEmail,
            phone: phone || user.phone || undefined,
            dateOfBirth: dob,
            gender: 'No especificado',
            dataConsent: true,
            dataConsentAt: new Date(),
          }
        });
        // No enviamos correo de configuración: el usuario ya tiene cuenta y contraseña
      } else if (!patientProfile) {
        throw new AppError('Un usuario con este email ya existe, pero no es un paciente.', 409);
      }

      const existingLink = await prisma.doctorPatient.findUnique({
        where: { doctorId_patientId: { doctorId: doctorProfile.id, patientId: patientProfile.id } }
      });
      if (existingLink) throw new AppError('Este paciente ya está asociado a tu cuenta.', 409);
      
      await prisma.doctorPatient.create({
        data: {
          doctorId: doctorProfile.id,
          patientId: patientProfile.id,
          status: 'activo',
          specialization: doctorProfile.specialization ?? 'General',
          context: `Vinculado por ${doctorProfile.taxName || ''}`,
        },
      });
      return res.status(200).json(patientProfile);

    } else {
      const temporalPassword = randomBytes(8).toString('hex');
      const hashedPassword = await bcrypt.hash(temporalPassword, 10);
      
      const newPatientUser = await prisma.user.create({
        data: {
          email: effectiveEmail,
          password: hashedPassword,
          firstName,
          lastName,
          role: UserRole.PATIENT,
          phone: phone || undefined,
          patientProfile: {
            create: {
              firstName,
              lastName,
              email: hasRealEmail ? effectiveEmail : null,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : new Date(),
              gender: 'No especificado',
              dataConsent: true,
              dataConsentAt: new Date(),
            }
          }
        },
        include: { patientProfile: true },
      });

      if (!newPatientUser.patientProfile) throw new AppError('Falló la creación del perfil de paciente.', 500);

      await prisma.doctorPatient.create({
        data: {
          doctorId: doctorProfile.id, patientId: newPatientUser.patientProfile.id,
          status: 'activo', specialization: doctorProfile.specialization ?? 'General',
          context: `Registrado por ${doctorProfile.taxName || ''}`,
        },
      });

      // Enviar correo de configuración de contraseña solo si el paciente tiene email real
      if (hasRealEmail && effectiveEmail) {
        try {
          const notificationService = NotificationService.getInstance();
          const doctorName = `${doctorProfile.user.firstName} ${doctorProfile.user.lastName}`;
          
          // Generar token de restablecimiento de contraseña (texto plano, igual que forgot-password)
          const token = cryptoRandomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
          
          // Guardar token en la base de datos (mismo formato que password-reset/request)
          await prisma.passwordResetToken.create({
            data: {
              token,
              userId: newPatientUser.id,
              email: effectiveEmail,
              expiresAt,
              purpose: 'patient_setup'
            }
          });
          
          // Construir URL de restablecimiento de contraseña
          const passwordResetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}&email=${encodeURIComponent(effectiveEmail)}`;
          
          // Enviar correo de configuración de contraseña
          const emailSent = await notificationService.sendPasswordSetupEmail(
            effectiveEmail,
            doctorName,
            passwordResetUrl
          );
          
          console.log(`Correo de configuración de contraseña enviado para paciente ${firstName} ${lastName}. Email: ${emailSent}`);
        } catch (emailError) {
          console.error('Error al enviar correo de configuración de contraseña:', emailError);
          // No fallar el registro si el email falla
        }
      }

      return res.status(201).json(newPatientUser.patientProfile);
    }
  } catch (error: any) {
    console.error("--- ERROR DETALLADO AL REGISTRAR PACIENTE ---");
    console.error("Timestamp:", new Date().toISOString());
    console.error("Datos recibidos (body):", JSON.stringify(req.body, null, 2));
    console.error("Error completo:", error);
    console.error("--- FIN DEL REPORTE DE ERROR ---");
    
    const handled = error instanceof AppError ? error : new AppError('No se pudo registrar al paciente.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};


// =================================================================
// CREAR UNA NUEVA CONSULTA
// =================================================================
export const createConsultation = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) throw new AppError('Autenticación requerida.', 401);
        const { patientId } = req.params;
        const { notes, fileIds, tags, links, clinicalEvolution, formData, date, clinicalCaseId, reason } = req.body;

        if (!clinicalCaseId) {
            throw new AppError('El ID del caso clínico (clinicalCaseId) es obligatorio.', 400);
        }
        if (!clinicalEvolution) {
            throw new AppError('La evolución clínica del paciente es obligatoria.', 400);
        }

        const diagnosis = req.body.diagnosis || notes;
        const treatment = req.body.treatment || notes;

        if (!diagnosis) {
            throw new AppError('El diagnóstico es un campo requerido.', 400);
        }

        const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
        if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

        // Verificar si el doctor es titular o colaborador del paciente
        const doctorPatientLink = await prisma.doctorPatient.findUnique({
            where: { doctorId_patientId: { doctorId: doctor.id, patientId } }
        });
        
        // Si no es titular, verificar si es colaborador del caso clínico específico
        if (!doctorPatientLink) {
            const isCollaborator = await prisma.padecimientoDoctorColaborador.findFirst({
                where: {
                    doctorId: doctor.id,
                    patientId: patientId,
                    padecimientoId: clinicalCaseId
                }
            });
            
            if (!isCollaborator) {
                throw new AppError('No tienes acceso a crear consultas para este paciente o caso clínico.', 403);
            }
        }

        // --- VALIDACIÓN DE ARCHIVOS ---
        let filesToConnect = [];
        if (fileIds && fileIds.length > 0) {
            const files = await prisma.file.findMany({ where: { id: { in: fileIds } } });
            if (files.length !== fileIds.length) {
                throw new AppError('Uno o más archivos no existen.', 400);
            }
            for (const file of files) {
                if (file.medicalRecordId) {
                    throw new AppError(`El archivo ${file.fileName} ya está asociado a otra consulta.`, 400);
                }
                if (
                  file.patientId !== patientId &&
                  file.doctorId !== doctor.id &&
                  file.uploadedById !== req.user.userId
                ) {
                    throw new AppError(`No tienes permiso para asociar el archivo ${file.fileName}.`, 403);
                }
                filesToConnect.push({ id: file.id });
            }
        }

        // --- VALIDACIÓN DE LINKS ---
        let linksToCreate = [];
        if (links && links.length > 0) {
            const urlRegex = /^(https?:\/\/)[\w\-]+(\.[\w\-]+)+[/#?]?.*$/;
            const seen = new Set();
            for (const link of links) {
                if (!link.url || !urlRegex.test(link.url)) {
                    throw new AppError(`El vínculo ${link.url} no es una URL válida.`, 400);
                }
                if (!link.description || link.description.length < 2) {
                    throw new AppError('Cada vínculo debe tener una descripción breve.', 400);
                }
                if (seen.has(link.url)) {
                    throw new AppError(`El vínculo ${link.url} está duplicado.`, 400);
                }
                seen.add(link.url);
                linksToCreate.push({ url: link.url, description: link.description });
            }
        }

        // Si es colaborador, necesitamos crear o usar una relación doctorPatient existente
        let finalDoctorPatientId = doctorPatientLink?.id;
        
        if (!finalDoctorPatientId) {
            // Buscar una relación doctorPatient existente para este paciente
            const existingDoctorPatient = await prisma.doctorPatient.findFirst({
                where: { patientId }
            });
            
            if (!existingDoctorPatient) {
                throw new AppError('No se encontró una relación válida para crear la consulta.', 500);
            }
            
            finalDoctorPatientId = existingDoctorPatient.id;
        }

        const medicalRecord = await prisma.medicalRecord.create({
            data: {
                clinicalCaseId,
                doctorPatientId: finalDoctorPatientId,
                patientId, 
                diagnosis, 
                treatment, 
                notes,
                reason,
                tags: tags || [],
                clinicalEvolution,
                formData: formData || {},
                userId: req.user.userId,
                autorConsultaId: req.user.userId, // ID del doctor que crea la consulta
                files: filesToConnect.length > 0 ? { connect: filesToConnect } : undefined,
                links: linksToCreate.length > 0 ? { create: linksToCreate } : undefined,
                date: date ? new Date(date) : undefined,
            },
            include: {
                files: true,
                links: true
            }
        });

        res.status(201).json(medicalRecord);
    } catch (error: any) {
        console.error("Error al crear la consulta:", error)
        const handled = error instanceof AppError ? error : new AppError('Error al crear la consulta.', 500);
        res.status(handled.statusCode).json({ message: handled.message });
    }
}


// =================================================================
// ACTUALIZAR DATOS DE UN PACIENTE
// =================================================================
export const updatePatient = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);

    let doctor: { id: string } | null = null;
    if (req.user.role === 'DOCTOR') {
      doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId }, select: { id: true } });
    } else if (req.user.role === 'ASISTENTE') {
      const selectedDoctorId = req.headers['x-selected-doctor-id'];
      if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
        throw new AppError('Doctor seleccionado requerido.', 400);
      }
      const link = await prisma.asistenteDoctorVinculo.findFirst({
        where: { doctorId: selectedDoctorId, asistenteId: req.user.userId, activo: true }
      });
      if (!link) throw new AppError('Asistente no vinculado a este doctor.', 403);
      doctor = await prisma.doctor.findUnique({ where: { id: selectedDoctorId }, select: { id: true } });
    }
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const { patientId } = req.params;
    const {
      phone,
      email,
      taxName,
      taxId,
      taxAddress,
      gender,
      birthDate,
      bloodType,
      allergies,
      chronicDiseases,
      taxCertificateUrl,
      emergencyContact // { firstName, lastName, email, phone, relationship }
    } = req.body;

    // Verifica que el paciente esté asociado a este doctor, o que sea el doctor actualizando su propio perfil de paciente
    let patient = await prisma.patient.findFirst({
      where: { id: patientId, doctors: { some: { doctorId: doctor.id } } },
      include: { user: true, emergencyContacts: true }
    });
    if (!patient) {
      const selfPatient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: { user: true, emergencyContacts: true }
      });
      if (selfPatient?.userId === req.user!.userId) patient = selfPatient;
    }
    if (!patient) throw new AppError('Paciente no encontrado o no asociado a este doctor.', 404);

    // Actualizar email del paciente (solo si se proporciona un correo real válido)
    const hasRealEmail = !!(email && typeof email === 'string' && email.trim() !== '' && !email.startsWith(NO_EMAIL_PLACEHOLDER_PREFIX));
    let newUserEmail: string | undefined;
    let newPatientEmail: string | null | undefined;

    if (hasRealEmail) {
      const trimmedEmail = email.trim().toLowerCase();
      const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
      if (existingUser && existingUser.id !== patient.userId) {
        throw new AppError('Este correo electrónico ya está registrado por otro usuario.', 409);
      }
      newUserEmail = trimmedEmail;
      newPatientEmail = trimmedEmail;
    }

    // Manejo de archivos
    let profilePictureUrl = patient.profilePictureUrl;
    let newTaxCertificateUrl = patient.taxCertificateUrl;
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (files.profilePicture && files.profilePicture[0]) {
        const uploadResult = await uploadToS3(files.profilePicture[0], 'profile_pictures', patient.userId);
        profilePictureUrl = uploadResult.url;
        // Registrar archivo en DB para permitir signed-url
        try {
          await prisma.file.create({
            data: {
              fileName: files.profilePicture[0].originalname,
              fileType: files.profilePicture[0].mimetype,
              size: files.profilePicture[0].size,
              url: profilePictureUrl,
              category: FileCategory.PATIENT_PHOTO,
              uploadedById: req.user!.userId,
              patientId: patient.id
            }
          });
        } catch (e: any) {
          console.warn('No se pudo registrar la foto de perfil en DB (puede existir ya):', e && e.message ? e.message : e);
        }
      }
      if (files.taxCertificate && files.taxCertificate[0]) {
        const uploadResult = await uploadToS3(files.taxCertificate[0], 'tax_certificates', patient.userId);
        newTaxCertificateUrl = uploadResult.url;
        // Registrar archivo en DB (sin categoría específica)
        try {
          await prisma.file.create({
            data: {
              fileName: files.taxCertificate[0].originalname,
              fileType: files.taxCertificate[0].mimetype,
              size: files.taxCertificate[0].size,
              url: newTaxCertificateUrl,
              uploadedById: req.user!.userId,
              patientId: patient.id
            }
          });
        } catch (e: any) {
          console.warn('No se pudo registrar la constancia fiscal en DB (puede existir ya):', e && e.message ? e.message : e);
        }
      }
    }

    // Actualiza el modelo Patient
    const updatedPatient = await prisma.patient.update({
      where: { id: patientId },
      data: {
        phone,
        ...(newPatientEmail !== undefined && { email: newPatientEmail }),
        taxName,
        taxId,
        taxAddress,
        gender,
        dateOfBirth: birthDate ? new Date(birthDate) : undefined,
        allergies,
        chronicDiseases,
        taxCertificateUrl: newTaxCertificateUrl,
        bloodType,
        profilePictureUrl
      }
    });

    // Actualiza el modelo User (phone y/o email si se agregó correo a paciente sin email)
    await prisma.user.update({
      where: { id: patient.userId },
      data: {
        phone,
        ...(newUserEmail && { email: newUserEmail })
      }
    });

    let parsedEmergencyContact = emergencyContact;
    if (typeof emergencyContact === 'string') {
      try {
        parsedEmergencyContact = JSON.parse(emergencyContact);
      } catch {
        parsedEmergencyContact = undefined;
      }
    }

    // Upsert del contacto de emergencia principal
    if (parsedEmergencyContact && parsedEmergencyContact.phone) {
      if (patient.emergencyContacts.length > 0) {
        // Actualiza el primero
        await prisma.emergencyContact.update({
          where: { id: patient.emergencyContacts[0].id },
          data: parsedEmergencyContact
        });
      } else {
        // Crea uno nuevo
        await prisma.emergencyContact.create({
          data: {
            ...parsedEmergencyContact,
            patientId: patient.id
          }
        });
      }
    }

    // Vuelve a obtener el paciente actualizado con contactos de emergencia
    const patientWithContacts = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { emergencyContacts: true }
    });

    res.json({ message: 'Datos del paciente actualizados correctamente', patient: patientWithContacts });
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al actualizar datos del paciente.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};


// =================================================================
// OBTENER TODOS LOS PACIENTES ASIGNADOS AL DOCTOR
// =================================================================
export const getAllMyPatients = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    let doctorId: string | null = null;

    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
      if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
      doctorId = doctor.id;
    } else if (req.user.role === 'ASISTENTE') {
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

    if (!doctorId) {
      throw new AppError('Doctor no encontrado.', 404);
    }

    console.log('=== DEBUG getAllMyPatients ===');
    console.log('Doctor ID:', doctorId);
    console.log('User role:', req.user.role);
    console.log('User ID:', req.user.userId);

    const { search, sortBy = 'firstName', sortOrder = 'asc' } = req.query;

    // Construir filtros de búsqueda
    const whereClause: any = {
      doctors: { some: { doctorId } }
    };

    if (search) {
      whereClause.OR = [
        { user: {
          OR: [
            { firstName: { contains: search as string, mode: 'insensitive' } },
            { lastName: { contains: search as string, mode: 'insensitive' } },
            { email: { contains: search as string, mode: 'insensitive' } },
          ]
        }},
        { clinicalCases: {
          some: {
            padecimiento: { contains: search as string, mode: 'insensitive' }
          }
        }}
      ];
    }

    // Obtener pacientes directamente asociados al doctor (TITULARES)
    const directPatients = await prisma.patient.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        clinicalCases: {
          include: {
            medicalRecords: {
              orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' }
              ],
              select: {
                id: true,
                clinicalEvolution: true,
                createdAt: true,
                date: true
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
        },
        doctors: {
          where: { doctorId },
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
      },
      orderBy: {
        user: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        }
      }
    });

    // Obtener pacientes con los que el doctor colabora (COLABORADORES)
    // Solo obtener pacientes donde el doctor es colaborador de casos clínicos específicos
    const collaborativePatients = await prisma.patient.findMany({
      where: {
        AND: [
          {
            clinicalCases: { 
              some: { 
                colaboradores: { 
                  some: { doctorId } 
                } 
              } 
            }
          },
          {
            // Excluir pacientes donde el doctor es titular
            doctors: {
              none: { doctorId }
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          }
        },
        clinicalCases: {
          where: {
            colaboradores: {
              some: { doctorId }
            }
          },
          include: {
            medicalRecords: {
              orderBy: [
                { date: 'desc' },
                { createdAt: 'desc' }
              ],
              select: {
                id: true,
                clinicalEvolution: true,
                createdAt: true,
                date: true
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
        },
        doctors: {
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
      },
      orderBy: {
        user: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        }
      }
    });

    // Determinar qué pacientes mostrar basado en el rol del doctor
    let patients: any[];
    
    if (directPatients.length > 0) {
      // Si el doctor es titular de algunos pacientes, mostrar todos sus pacientes titulares
      // Y también los pacientes donde es colaborador (pero solo los casos específicos)
      const allPatients: any[] = [...directPatients];
      const directPatientIds = new Set(directPatients.map(p => p.id));
      
      for (const collabPatient of collaborativePatients) {
        if (!directPatientIds.has(collabPatient.id)) {
          allPatients.push(collabPatient);
        }
      }
      patients = allPatients;
    } else {
      // Si el doctor NO es titular de ningún paciente, solo mostrar pacientes donde es colaborador
      // Y solo los casos clínicos específicos donde es colaborador
      patients = collaborativePatients;
    }

    console.log('Pacientes encontrados:', patients.length);
    console.log('Direct patients:', directPatients.length);
    console.log('Collaborative patients:', collaborativePatients.length);
    console.log('Where clause:', JSON.stringify(whereClause, null, 2));
    
    // Debug: mostrar qué pacientes se están obteniendo
    console.log('=== DEBUG PACIENTES ===');
    patients.forEach((patient, index) => {
      console.log(`Paciente ${index + 1}:`, {
        id: patient.id,
        name: `${patient.user.firstName} ${patient.user.lastName}`,
        email: patient.user.email,
        clinicalCasesCount: patient.clinicalCases.length,
        isTitular: patient.doctors.length > 0,
        doctorIds: patient.doctors.map((d: any) => d.doctorId)
      });
    });
    console.log('=== FIN DEBUG PACIENTES ===');

    // Transformar datos para la tabla
    const patientsData: any[] = [];
    
    for (const patient of patients) {
      // Determinar si el doctor es titular o colaborador de este paciente específico
      // Verificar si el doctor actual está en la lista de doctors de este paciente
      const isTitularOfThisPatient = patient.doctors.some((d: any) => d.doctorId === doctorId);
      const isCollaboratorOfThisPatient = !isTitularOfThisPatient;

      // Logs específicos de diagnóstico para el paciente@test.com
      if (patient.user?.email === 'paciente@test.com') {
        console.log('=== DIAGNÓSTICO PACIENTE@test.com ===');
        console.log('isTitularOfThisPatient:', isTitularOfThisPatient);
        console.log('isCollaboratorOfThisPatient:', isCollaboratorOfThisPatient);
        console.log('patient.doctors doctorIds:', (patient.doctors || []).map((d: any) => d.doctorId));
        console.log('clinicalCases count:', (patient.clinicalCases || []).length);
      }
      
      const displayEmail = (patient.user?.email && !String(patient.user.email).startsWith(NO_EMAIL_PLACEHOLDER_PREFIX))
        ? patient.user.email
        : null;
      const basePatientInfo = {
        id: patient.id,
        firstName: patient.user.firstName,
        lastName: patient.user.lastName,
        email: displayEmail,
        profilePictureUrl: patient.profilePictureUrl,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        doctorPatientId: patient.doctors.find((d: any) => d.doctorId === doctorId)?.id,
        status: patient.doctors.find((d: any) => d.doctorId === doctorId)?.status || 'activo',
        startDate: patient.doctors.find((d: any) => d.doctorId === doctorId)?.startDate,
        isTitular: isTitularOfThisPatient,
        isCollaborator: isCollaboratorOfThisPatient
      };

      // Si no tiene casos clínicos, crear una fila vacía
      if (patient.clinicalCases.length === 0) {
        patientsData.push({
          ...basePatientInfo,
          padecimiento: null,
          clinicalEvolution: null,
          clinicalCaseId: null,
          lastAppointment: null,
          nextAppointment: null,
          collaborationInfo: null
        });
      } else {
        // Crear una fila por cada caso clínico
        for (const clinicalCase of patient.clinicalCases) {
          // Verificar si el doctor es colaborador de este caso clínico específico
          const isCollaboratorInThisCase = clinicalCase.colaboradores.some((collab: any) => collab.doctorId === doctorId);
          
          // Si el doctor es colaborador de este paciente, solo mostrar casos clínicos donde es colaborador
          if (isCollaboratorOfThisPatient && !isCollaboratorInThisCase) {
            continue; // Saltar este caso clínico si no es colaborador
          }

          // Logs específicos de diagnóstico por caso clínico
          if (patient.user?.email === 'paciente@test.com') {
            console.log('Caso clínico considerado:', {
              id: clinicalCase.id,
              padecimiento: clinicalCase.padecimiento,
              isCollaboratorInThisCase
            });
          }
          
          // Obtener TODAS las consultas del caso clínico ordenadas por fecha más reciente
          const allRecords = clinicalCase.medicalRecords.filter((record: any) => 
            record.date || record.createdAt
          );
          
          // Ordenar por fecha real (date si existe, sino createdAt) - más reciente primero
          const sortedRecords = allRecords.sort((a: any, b: any) => {
            const dateA = a.date || a.createdAt;
            const dateB = b.date || b.createdAt;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
          
          // Tomar la consulta más reciente (primera después del ordenamiento)
          const mostRecentRecord = sortedRecords[0];
          
          // Debug de fechas
          if (mostRecentRecord) {
            console.log('=== DEBUG FECHAS PACIENTE ===');
            console.log('Paciente:', patient.user.firstName, patient.user.lastName);
            console.log('Padecimiento:', clinicalCase.padecimiento);
            console.log('Fecha del registro (date):', mostRecentRecord.date);
            console.log('Fecha del registro (createdAt):', mostRecentRecord.createdAt);
            console.log('Fecha del registro (createdAt ISO):', mostRecentRecord.createdAt?.toISOString());
            console.log('Fecha del registro (createdAt local):', mostRecentRecord.createdAt?.toLocaleDateString('es-ES'));
            
            // Usar la fecha que se guardó explícitamente (date) si existe, sino createdAt
            const lastAppointmentDate = mostRecentRecord.date || mostRecentRecord.createdAt;
            console.log('Fecha seleccionada para última cita:', lastAppointmentDate);
            console.log('Fecha formateada:', formatDate(lastAppointmentDate));
            console.log('=== FIN DEBUG FECHAS ===');
          }
          
          // Determinar información de colaboración
          let collaborationInfo = null;
          
          if (isTitularOfThisPatient) {
            // Si es titular de este paciente, mostrar información de colaboradores
            const collaboratorsInfo = clinicalCase.colaboradores.map((collab: any) => ({
              id: collab.doctorId,
              name: `${collab.doctor.user.firstName} ${collab.doctor.user.lastName}`,
              role: collab.rol
            }));
            
            if (collaboratorsInfo.length > 0) {
              // Mostrar nombres de colaboradores (máximo 3, luego "+")
              const displayNames = collaboratorsInfo.slice(0, 3).map((c: any) => c.name);
              if (collaboratorsInfo.length > 3) {
                displayNames.push(`+${collaboratorsInfo.length - 3} más`);
              }
              
              collaborationInfo = {
                type: 'titular',
                collaborators: collaboratorsInfo,
                displayText: displayNames.join(', ')
              };
            } else {
              collaborationInfo = {
                type: 'titular',
                collaborators: [],
                displayText: 'Sin colaboradores'
              };
            }
          } else if (isCollaboratorInThisCase) {
            // Si es colaborador de este caso clínico, mostrar información del doctor titular
            // Buscar el doctor titular del caso clínico
            const titularCollaborator = clinicalCase.colaboradores.find((collab: any) => 
              collab.rol === 'titular' || collab.rol === 'TITULAR'
            );
            
            if (titularCollaborator) {
              collaborationInfo = {
                type: 'colaborador',
                titularName: `${titularCollaborator.doctor.user.firstName} ${titularCollaborator.doctor.user.lastName}`,
                role: clinicalCase.colaboradores.find((collab: any) => collab.doctorId === doctorId)?.rol || 'Colaborador',
                displayText: `✓ Colabora con: ${titularCollaborator.doctor.user.firstName} ${titularCollaborator.doctor.user.lastName}`
              };
            } else {
              // Si no hay colaborador titular, buscar en la relación doctor-patient
              const titularDoctor = patient.doctors[0]?.doctor;
              if (titularDoctor) {
                collaborationInfo = {
                  type: 'colaborador',
                  titularName: `${titularDoctor.user.firstName} ${titularDoctor.user.lastName}`,
                  role: clinicalCase.colaboradores.find((collab: any) => collab.doctorId === doctorId)?.rol || 'Colaborador',
                  displayText: `✓ Colabora con: ${titularDoctor.user.firstName} ${titularDoctor.user.lastName}`
                };
              } else {
                // Si no se puede determinar el doctor titular, mostrar al menos que es colaboración
                collaborationInfo = {
                  type: 'colaborador',
                  titularName: 'Doctor titular',
                  role: clinicalCase.colaboradores.find((collab: any) => collab.doctorId === doctorId)?.rol || 'Colaborador',
                  displayText: '✓ Trabajo colaborativo'
                };
              }
            }
          }

          patientsData.push({
            ...basePatientInfo,
            padecimiento: clinicalCase.padecimiento,
            clinicalEvolution: mapClinicalEvolution(mostRecentRecord?.clinicalEvolution),
            clinicalCaseId: clinicalCase.id,
            lastAppointment: formatDate(mostRecentRecord?.date || mostRecentRecord?.createdAt),
            nextAppointment: null,  // TODO: Implementar cuando se desarrolle el calendario
            collaborationInfo: collaborationInfo
          });
        }
      }
    }

    res.json(patientsData);
  } catch (error: any) {
    console.error("Error al obtener pacientes:", error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener pacientes.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};


// =================================================================
// OBTENER TODAS LAS NOTAS CLÍNICAS DE UN PACIENTE
// =================================================================
export const getPatientMedicalRecords = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    const { patientId } = req.params;
    const { page = 1, limit = 10, search, clinicalEvolution, tags, clinicalCaseId } = req.query;
    
    // Logging para debuggear los parámetros recibidos
    console.log(`=== PARÁMETROS RECIBIDOS ===`);
    console.log(`patientId: ${patientId}`);
    console.log(`clinicalCaseId: ${clinicalCaseId}`);
    console.log(`Todos los query params:`, req.query);
    console.log(`=== FIN PARÁMETROS ===`);

    let doctorId: string | null = null;

    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
      if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
      doctorId = doctor.id;
    } else if (req.user.role === 'ASISTENTE') {
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

    if (!doctorId) {
      throw new AppError('Doctor no encontrado.', 404);
    }

    // Caso especial: doctor viendo su propio perfil de paciente
    const patientForSelf = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { userId: true }
    });
    const isViewingOwnPatientProfile = patientForSelf?.userId === req.user!.userId;

    let doctorPatientLink = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId, patientId } }
    });
    let isCollaborator = false;
    let collaborativeCaseIds: string[] = [];

    if (!isViewingOwnPatientProfile && !doctorPatientLink) {
      const collaborationCheck = await prisma.padecimientoDoctorColaborador.findMany({
        where: { doctorId, patientId },
        select: { padecimientoId: true }
      });
      if (collaborationCheck.length === 0) {
        throw new AppError('No tienes acceso a las notas clínicas de este paciente.', 403);
      }
      isCollaborator = true;
      collaborativeCaseIds = collaborationCheck.map(c => c.padecimientoId);
    }

     // Construir filtros de búsqueda
     const whereClause: any = {
       patientId
     };
     
     // Si es titular, filtrar por doctorPatientId específico
     if (doctorPatientLink) {
       whereClause.doctorPatientId = doctorPatientLink.id;
     }
     
     // Si es colaborador, filtrar solo por los casos clínicos donde es colaborador
     if (isCollaborator) {
       whereClause.clinicalCaseId = { in: collaborativeCaseIds };
     }

    if (search) {
      whereClause.OR = [
        { diagnosis: { contains: search as string, mode: 'insensitive' } },
        { treatment: { contains: search as string, mode: 'insensitive' } },
        { notes: { contains: search as string, mode: 'insensitive' } },
        { tags: { has: (search as string).toLowerCase() } }
      ];
    }

    if (clinicalEvolution) {
      whereClause.clinicalEvolution = clinicalEvolution;
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      whereClause.tags = { hasSome: tagArray };
    }

    // Filtrar por caso clínico si se proporciona
    console.log('=== BACKEND: Verificación del filtro clinicalCaseId ===');
    console.log('clinicalCaseId recibido:', clinicalCaseId);
    console.log('Tipo de clinicalCaseId:', typeof clinicalCaseId);
    console.log('clinicalCaseId es truthy:', !!clinicalCaseId);
    
    if (clinicalCaseId) {
      console.log('Aplicando filtro clinicalCaseId:', clinicalCaseId);
      whereClause.clinicalCaseId = clinicalCaseId;
    } else {
      console.log('NO se aplica filtro clinicalCaseId - es falsy');
    }
    console.log('=== FIN BACKEND ===');

    // Obtener TODAS las notas clínicas sin paginación para evitar inconsistencias
    const medicalRecords = await prisma.medicalRecord.findMany({
      where: whereClause,
              select: {
          id: true,
          clinicalCaseId: true,
          diagnosis: true,
          notes: true,
          tags: true,
          formData: true,
          treatment: true,
          clinicalEvolution: true,
          isPublic: true,
          isEditable: true,
          date: true,
          createdAt: true,
          updatedAt: true,
          reason: true,
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
        },
        prescriptions: {
          include: {
            file: {
              select: {
                id: true,
                fileName: true,
                url: true
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        doctorPatient: {
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
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }]
    });

    // Adaptar archivos para el frontend
    const recordsWithFiles = medicalRecords.map(record => ({
      ...record,
      files: record.files.map(file => ({
        id: file.id,
        fileName: file.fileName,
        fileType: file.fileType,
        url: file.url,
        size: file.size,
        category: file.category,
        date: file.createdAt,
        comment: '', // Puedes mapear aquí un campo de comentario si lo tienes
      })),
    }));

    // Logging para debuggear el número de consultas
    console.log(`=== CONSULTAS MÉDICAS PARA PACIENTE ${patientId} ===`);
    console.log(`Total de consultas encontradas: ${recordsWithFiles.length}`);
    console.log(`Filtros aplicados:`, {
      clinicalCaseId,
      search,
      clinicalEvolution,
      tags
    });
    console.log(`Where clause:`, whereClause);
    console.log(`Consultas:`, recordsWithFiles.map(r => ({
      id: r.id,
      clinicalCaseId: r.clinicalCaseId,
      notes: r.notes?.substring(0, 50) + '...',
      clinicalEvolution: r.clinicalEvolution,
      createdAt: r.createdAt
    })));
    console.log(`=== FIN DEBUG ===`);

    // Devolver directamente el array de registros médicos
    res.json(recordsWithFiles);
  } catch (error: any) {
    console.error("Error al obtener notas clínicas:", error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener notas clínicas.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// =================================================================
// OBTENER UNA NOTA CLÍNICA INDIVIDUAL
// =================================================================
export const getMedicalRecordById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    const { patientId, recordId } = req.params;

    let doctorId: string | null = null;

    if (req.user.role === 'DOCTOR') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
      if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
      doctorId = doctor.id;
    } else if (req.user.role === 'ASISTENTE') {
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

    const patientForSelf = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { userId: true }
    });
    const isViewingOwnPatientProfile = patientForSelf?.userId === req.user!.userId;

    const doctorPatientLink = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId, patientId } }
    });
    if (!isViewingOwnPatientProfile && !doctorPatientLink) {
      throw new AppError('No tienes acceso a las notas clínicas de este paciente.', 403);
    }

    // Obtener la nota clínica específica (en auto-visualización, cualquier record del paciente)
    const medicalRecord = await prisma.medicalRecord.findFirst({
      where: {
        id: recordId,
        patientId,
        ...(doctorPatientLink ? { doctorPatientId: doctorPatientLink.id } : {})
      },
      include: {
        files: {
          select: {
            id: true,
            fileName: true,
            fileType: true,
            url: true,
            size: true,
            createdAt: true
          }
        },
        links: {
          select: {
            id: true,
            url: true,
            description: true,
            createdAt: true
          }
        },
        prescriptions: {
          include: {
            file: {
              select: {
                id: true,
                fileName: true,
                url: true,
                size: true
              }
            }
          }
        },
        user: {
          select: {
            firstName: true,
            lastName: true
          }
          },
        doctorPatient: {
          include: {
            doctor: {
              select: {
                specialization: true,
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
    });

    if (!medicalRecord) {
      throw new AppError('Nota clínica no encontrada.', 404);
    }

    res.json(medicalRecord);
  } catch (error: any) {
    console.error("Error al obtener nota clínica:", error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener nota clínica.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// =================================================================
// ACTUALIZAR UNA NOTA CLÍNICA
// =================================================================
export const updateMedicalRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    const { patientId, recordId } = req.params;
    const { notes, diagnosis, treatment, tags, clinicalEvolution, formData, fileIds, links } = req.body;

    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    // Verificar que el paciente esté asociado a este doctor
    const doctorPatientLink = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId: doctor.id, patientId } }
    });
    if (!doctorPatientLink) throw new AppError('No tienes acceso a las notas clínicas de este paciente.', 403);

    // Verificar que la nota clínica existe y pertenece a esta relación
    const existingRecord = await prisma.medicalRecord.findFirst({
      where: {
        id: recordId,
        patientId,
        doctorPatientId: doctorPatientLink.id
      }
    });

    if (!existingRecord) {
      throw new AppError('Nota clínica no encontrada.', 404);
    }

    // Preparar datos de actualización
    const updateData: any = {};
    if (notes !== undefined) updateData.notes = notes;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (treatment !== undefined) updateData.treatment = treatment;
    if (tags !== undefined) updateData.tags = tags;
    if (clinicalEvolution !== undefined) updateData.clinicalEvolution = clinicalEvolution;
    if (formData !== undefined) updateData.formData = formData;

    // Actualizar archivos si se proporcionan
    if (fileIds && Array.isArray(fileIds)) {
      // Validar que los archivos existen y pertenecen al doctor/paciente
      const files = await prisma.file.findMany({ 
        where: { 
          id: { in: fileIds },
          OR: [
            { patientId },
            { doctorId: doctor.id },
            { uploadedById: req.user.userId }
          ]
        } 
      });
      
      if (files.length !== fileIds.length) {
        throw new AppError('Uno o más archivos no existen o no tienes permisos.', 400);
      }

      // Desconectar archivos actuales y conectar los nuevos
      await prisma.medicalRecord.update({
        where: { id: recordId },
        data: {
          files: {
            set: [], // Desconectar todos
            connect: fileIds.map(id => ({ id })) // Conectar los nuevos
          }
        }
      });
    }

    // Actualizar links si se proporcionan
    if (links && Array.isArray(links)) {
      // Eliminar links existentes
      await prisma.link.deleteMany({
        where: { medicalRecordId: recordId }
      });

      // Crear nuevos links
      if (links.length > 0) {
        await prisma.link.createMany({
          data: links.map(link => ({
            url: link.url,
            description: link.description,
            medicalRecordId: recordId
          }))
        });
      }
    }

    // Actualizar la nota clínica
    const updatedRecord = await prisma.medicalRecord.update({
      where: { id: recordId },
      data: updateData,
      include: {
        files: true,
        links: true,
        prescriptions: {
          include: {
            file: true
          }
        }
      }
    });

    res.json({
      message: 'Nota clínica actualizada correctamente',
      medicalRecord: updatedRecord
    });
  } catch (error: any) {
    console.error("Error al actualizar nota clínica:", error);
    const handled = error instanceof AppError ? error : new AppError('Error al actualizar nota clínica.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// =================================================================
// ELIMINAR UNA NOTA CLÍNICA
// =================================================================
export const deleteMedicalRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    const { patientId, recordId } = req.params;

    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    // Verificar que el paciente esté asociado a este doctor
    const doctorPatientLink = await prisma.doctorPatient.findUnique({
      where: { doctorId_patientId: { doctorId: doctor.id, patientId } }
    });
    if (!doctorPatientLink) throw new AppError('No tienes acceso a las notas clínicas de este paciente.', 403);

    // Verificar que la nota clínica existe y pertenece a esta relación
    const existingRecord = await prisma.medicalRecord.findFirst({
      where: {
        id: recordId,
        patientId,
        doctorPatientId: doctorPatientLink.id
      },
      include: {
        files: true,
        links: true,
        prescriptions: true
      }
    });

    if (!existingRecord) {
      throw new AppError('Nota clínica no encontrada.', 404);
    }

    // Eliminar la nota clínica (esto también eliminará los links por CASCADE)
    await prisma.medicalRecord.delete({
      where: { id: recordId }
    });

    res.json({ 
      message: 'Nota clínica eliminada correctamente',
      deletedRecord: {
        id: existingRecord.id,
        diagnosis: existingRecord.diagnosis,
        createdAt: existingRecord.createdAt
      }
    });
  } catch (error: any) {
    console.error("Error al eliminar nota clínica:", error);
    const handled = error instanceof AppError ? error : new AppError('Error al eliminar nota clínica.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// =================================================================
// OTRAS FUNCIONES (DEJAR COMO PLACEHOLDER SI NO SON NECESARIAS AHORA)
// =================================================================
// Obtener estadísticas del dashboard del doctor
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const doctorId = doctor.id;
    const now = new Date();
    
    // Obtener fecha de inicio y fin del día actual
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Obtener fecha de inicio y fin del mes actual
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Obtener fecha de inicio y fin de la semana actual (lunes a domingo)
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ajustar para que lunes sea el primer día
    const weekStart = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
    const weekEndDate = new Date(weekStart);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    // 1. Total de Pacientes: Contar pacientes únicos asociados al doctor
    // Usar groupBy para obtener pacientes únicos y luego contar
    const uniquePatients = await prisma.doctorPatient.groupBy({
      by: ['patientId'],
      where: {
        doctorId: doctorId
      }
    });

    const totalPatientsCount = uniquePatients.length;

    // 2. Citas de Hoy: Contar Appointment con date del día actual
    // Incluir todas las citas del día que no estén canceladas
    const todayAppointments = await prisma.appointment.count({
      where: {
        doctorId: doctorId,
        date: {
          gte: todayStart,
          lte: todayEnd
        },
        // Excluir solo las citas explícitamente canceladas
        confirmationStatus: {
          not: 'CANCELLED'
        }
      }
    });

    // 3. Consultas Pendientes: Citas agendadas para el futuro (esta semana o mes)
    // Incluir citas que:
    // - Tengan fecha futura (desde ahora)
    // - No estén canceladas
    // - Estén programadas o confirmadas
    const pendingConsultations = await prisma.appointment.count({
      where: {
        doctorId: doctorId,
        date: {
          gt: now // Solo citas futuras (después de ahora)
        },
        // Incluir citas programadas, confirmadas, o pendientes
        status: {
          in: ['SCHEDULED', 'CONFIRMED', 'PENDING']
        },
        // Excluir citas canceladas
        confirmationStatus: {
          not: 'CANCELLED'
        }
      }
    });

    // 4. Recetas del Mes: Contar recetas emitidas en el mes actual
    const monthlyRecipes = await prisma.recetaMedica.count({
      where: {
        doctorId: doctorId,
        fechaEmision: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    // 5. Total de Recetas: Contar todas las recetas del doctor
    const totalRecipes = await prisma.recetaMedica.count({
      where: {
        doctorId: doctorId
      }
    });

    // 6. Consultas Recientes: Contar consultas (MedicalRecord) del mes actual
    const recentConsultations = await prisma.medicalRecord.count({
      where: {
        clinicalCase: {
          patient: {
            doctors: {
              some: {
                doctorId: doctorId
              }
            }
          }
        },
        createdAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    res.json({
      success: true,
      data: {
        totalPatients: totalPatientsCount,
        todayAppointments,
        pendingConsultations,
        monthlyRecipes,
        totalRecipes,
        recentConsultations,
        activePatients: totalPatientsCount // Por ahora igual al total
      }
    });
  } catch (error: any) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener estadísticas del dashboard.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

export const getPatients = async (req: AuthRequest, res: Response) => { res.status(501).json({ message: 'No implementado' }); };
export const referPatient = async (req: AuthRequest, res: Response) => { res.status(501).json({ message: 'No implementado' }); };
export const registerDoctor = async (req: Request, res: Response) => { res.status(501).json({ message: 'No implementado' }); };

// =================================================================
// BUSCAR PROFESIONALES DE LA SALUD (SOLO DOCTORES PARA COLABORACIÓN)
// =================================================================
export const searchHealthProfessionals = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    
    const searchTerm = req.query.search as string;
    if (!searchTerm || searchTerm.length < 2) {
      return res.json([]);
    }

    // Buscar ÚNICAMENTE usuarios con rol DOCTOR (profesionales de la salud de paga o con promoción).
    // NUNCA incluir ASISTENTE ni PACIENTE en la búsqueda.
    const professionals = await prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      },
      take: 10
    });

    // Formatear los resultados para incluir información del perfil profesional
    const formattedResults = await Promise.all(
      professionals.map(async (user) => {
        let professionalInfo = null;
        
        if (user.role === 'DOCTOR') {
          professionalInfo = await prisma.doctor.findUnique({
            where: { userId: user.id },
            select: {
              id: true,
              specialization: true,
              professionalTitle: true
            }
          });
        }

        return {
          id: professionalInfo?.id || user.id, // Usar el ID del doctor, no del usuario
          userId: user.id, // Mantener el userId por si se necesita
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          specialization: professionalInfo?.specialization || null,
          professionalTitle: professionalInfo?.professionalTitle || null
        };
      })
    );

    res.json(formattedResults);
  } catch (error: any) {
    console.error('Error buscando profesionales de la salud:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al buscar profesionales de la salud.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// =================================================================
// BUSCAR DOCTORES PÚBLICAMENTE (PARA REGISTRO DE ASISTENTES)
// =================================================================
export const searchDoctorsPublic = async (req: Request, res: Response) => {
  try {
    const searchTerm = req.query.q as string;
    if (!searchTerm || searchTerm.length < 2) {
      return res.json({ doctors: [] });
    }

    // Buscar usuarios que sean doctores
    const doctors = await prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        OR: [
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true
      },
      take: 10
    });

    // Formatear los resultados para incluir información del perfil profesional
    const formattedResults = await Promise.all(
      doctors.map(async (user) => {
        const doctorInfo = await prisma.doctor.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            specialization: true,
            professionalTitle: true
          }
        });

        return {
          id: doctorInfo?.id || user.id,
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          specialty: doctorInfo?.specialization || null,
          professionalTitle: doctorInfo?.professionalTitle || null
        };
      })
    );

    res.json({ doctors: formattedResults });
  } catch (error: any) {
    console.error('Error buscando doctores:', error);
    res.status(500).json({ doctors: [], message: 'Error al buscar doctores' });
  }
};

// =================================================================
// OBTENER PERFIL DEL DOCTOR
// =================================================================
export const getDoctorProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    let doctorId: string | null = null;

    if (req.user.role === 'DOCTOR') {
      // Para doctores: obtener su propio perfil
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId }
      });
      if (doctor) {
        doctorId = doctor.id;
      }
         } else if (req.user.role === 'PATIENT') {
       // Para pacientes: obtener el perfil del doctor de su caso clínico
       const patient = await prisma.patient.findUnique({
         where: { userId: req.user.userId },
         include: {
           clinicalCases: {
             take: 1,
             include: {
               colaboradores: {
                 where: { rol: 'titular' },
                 take: 1,
                 include: {
                   doctor: true
                 }
               }
             }
           }
         }
       });
       
       if (patient?.clinicalCases?.[0]?.colaboradores?.[0]?.doctor) {
         doctorId = patient.clinicalCases[0].colaboradores[0].doctor.id;
       }
         } else if (req.user.role === 'ASISTENTE') {
       // Para asistentes: usar doctor seleccionado (X-Selected-Doctor-Id) o el primero vinculado
       const selectedDoctorId = req.headers['x-selected-doctor-id'];
       const doctorIdHeader = typeof selectedDoctorId === 'string' ? selectedDoctorId : null;
       
       if (doctorIdHeader) {
         const link = await prisma.asistenteDoctorVinculo.findFirst({
           where: {
             doctorId: doctorIdHeader,
             asistenteId: req.user.userId,
             activo: true
           }
         });
         if (link) doctorId = doctorIdHeader;
       }
       
       if (!doctorId) {
         const assistant = await prisma.asistenteDoctorVinculo.findFirst({
           where: { asistenteId: req.user.userId, activo: true },
           include: { doctor: true }
         });
         if (assistant?.doctor) doctorId = assistant.doctor.id;
       }
    }

    if (!doctorId) {
      return res.status(404).json({ message: 'No se encontró perfil de doctor asociado' });
    }

    // Obtener el perfil del doctor
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Doctor no encontrado' });
    }

    res.json({
      data: {
        id: doctor.id,
        firstName: doctor.user.firstName,
        lastName: doctor.user.lastName,
        email: doctor.user.email,
        specialization: doctor.specialization,
        professionalTitle: doctor.professionalTitle
      }
    });
  } catch (error: any) {
    console.error('Error al obtener perfil del doctor:', error);
    res.status(500).json({ message: 'Error al obtener perfil del doctor' });
  }
};

/**
 * Listar pacientes de un doctor (admin). Para obtener patientId y usarlo en unlink-incorrect-patient.
 * GET /api/admin/reports/doctor-patients?doctorEmail=xxx
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
export const listDoctorPatientsAdmin = async (req: Request, res: Response) => {
  try {
    const doctorEmail = (req.query.doctorEmail as string)?.trim();
    if (!doctorEmail) {
      return res.status(400).json({
        success: false,
        message: 'Query doctorEmail es requerido'
      });
    }

    const doctor = await prisma.doctor.findFirst({
      where: { user: { email: doctorEmail.toLowerCase() } },
      select: { id: true, user: { select: { firstName: true, lastName: true } } }
    });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: `No se encontró doctor con email ${doctorEmail}`
      });
    }

    const links = await prisma.doctorPatient.findMany({
      where: { doctorId: doctor.id },
      include: {
        patient: {
          include: {
            user: { select: { email: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    const patients = links.map((l) => ({
      patientId: l.patientId,
      firstName: l.patient.firstName,
      lastName: l.patient.lastName,
      email: l.patient.email || l.patient.user?.email || null,
      userEmail: l.patient.user?.email
    }));

    return res.json({
      success: true,
      doctor: `${doctor.user.firstName} ${doctor.user.lastName}`,
      doctorEmail,
      total: patients.length,
      patients
    });
  } catch (error: any) {
    console.error('Error en listDoctorPatientsAdmin:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al listar pacientes'
    });
  }
};

/**
 * Desvincular un paciente de un doctor (reparación de errores).
 * Para corregir casos donde un paciente fue vinculado incorrectamente a un doctor
 * (ej. bug de email vacío que vinculaba pacientes de otros doctores).
 * POST /api/admin/reports/unlink-incorrect-patient
 * Body: { doctorEmail: string, patientId?: string, patientFirstName?: string, patientLastName?: string }
 * Header: X-Admin-Report-Token o X-Seed-Token
 */
export const unlinkPatientFromDoctor = async (req: Request, res: Response) => {
  try {
    const { doctorEmail, patientId, patientFirstName, patientLastName } = req.body || {};

    if (!doctorEmail || typeof doctorEmail !== 'string' || !doctorEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'doctorEmail es requerido'
      });
    }

    const doctor = await prisma.doctor.findFirst({
      where: { user: { email: doctorEmail.trim().toLowerCase() } },
      include: { user: { select: { firstName: true, lastName: true } } }
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: `No se encontró doctor con email ${doctorEmail}`
      });
    }

    let targetPatientId: string | null = null;

    if (patientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { firstName: true, lastName: true } } }
      });
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: `No se encontró paciente con id ${patientId}`
        });
      }
      targetPatientId = patient.id;
    } else if (patientFirstName && patientLastName) {
      // Buscar por Patient.firstName/lastName (modelo Patient) o User.firstName/lastName
      const patients = await prisma.patient.findMany({
        where: {
          doctors: { some: { doctorId: doctor.id } },
          OR: [
            {
              firstName: { equals: patientFirstName.trim(), mode: 'insensitive' },
              lastName: { equals: patientLastName.trim(), mode: 'insensitive' }
            },
            {
              user: {
                firstName: { equals: patientFirstName.trim(), mode: 'insensitive' },
                lastName: { equals: patientLastName.trim(), mode: 'insensitive' }
              }
            }
          ]
        },
        include: { user: { select: { firstName: true, lastName: true } } }
      });
      if (patients.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No se encontró paciente "${patientFirstName} ${patientLastName}" en la lista del doctor ${doctorEmail}`
        });
      }
      if (patients.length > 1) {
        return res.status(400).json({
          success: false,
          message: `Hay ${patients.length} pacientes con ese nombre. Usa patientId para especificar.`,
          candidates: patients.map(p => ({ id: p.id, firstName: p.user.firstName, lastName: p.user.lastName }))
        });
      }
      targetPatientId = patients[0].id;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Proporciona patientId o (patientFirstName y patientLastName)'
      });
    }

    const link = await prisma.doctorPatient.findUnique({
      where: {
        doctorId_patientId: { doctorId: doctor.id, patientId: targetPatientId }
      },
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true } } } }
      }
    });

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'El vínculo doctor-paciente no existe (ya fue eliminado o nunca existió)'
      });
    }

    await prisma.doctorPatient.delete({
      where: { id: link.id }
    });

    return res.json({
      success: true,
      message: 'Vínculo eliminado correctamente',
      details: {
        doctor: `${doctor.user.firstName} ${doctor.user.lastName} (${doctorEmail})`,
        patient: `${link.patient.user.firstName} ${link.patient.user.lastName}`,
        patientId: link.patientId
      }
    });
  } catch (error: any) {
    console.error('Error en unlinkPatientFromDoctor:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al desvincular paciente'
    });
  }
};
