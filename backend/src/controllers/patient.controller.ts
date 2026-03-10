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

const prisma = new PrismaClient();

// =================================================================
// REGISTRO DE PACIENTE
// =================================================================
export const registerPatient = async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone, dateOfBirth } = req.body;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    // Crear el nuevo usuario y perfil de paciente
    const newUser = await prisma.user.create({
      data: {
        email,
        password,
        firstName,
        lastName,
        phone,
        role: 'PATIENT',
        patientProfile: {
          create: {
            firstName,
            lastName,
            email,
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
      include: {
        clinicalCases: {
          include: {
            medicalRecords: {
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

    if (!patient) {
      return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
    }

    // Procesar los casos clínicos para el paciente
    const processedCases = patient.clinicalCases.map(clinicalCase => {
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
    });

    res.json(processedCases);
  } catch (error) {
    console.error('Error al obtener casos clínicos del paciente:', error);
    res.status(500).json({ message: 'Error al obtener casos clínicos' });
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

    // Construir filtros
    const whereClause: any = { patientId: patient.id };
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

    // Construir la condición where para filtrar por caso clínico si se proporciona
    const whereClause: any = { patientId: patient.id };
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

// Registro de paciente desde el frontend (nuevo método)
export const registerPatientFromFrontend = async (req: Request, res: Response) => {
  try {
    console.log('=== INICIO REGISTRO PACIENTE FRONTEND ===');
    console.log('Body recibido:', req.body);
    console.log('Archivos recibidos:', req.files);
    
    const {
      firstName, lastName, email, password, phone, doctorId,
      // Contactos de emergencia 1
      emergencyContact1Name, emergencyContact1LastName, emergencyContact1Phone, 
      emergencyContact1Email, emergencyContact1Relationship,
      // Contactos de emergencia 2
      emergencyContact2Name, emergencyContact2LastName, emergencyContact2Phone, 
      emergencyContact2Email, emergencyContact2Relationship,
      gender, birthDate, bloodType, allergies, chronicDiseases,
      // Datos fiscales
      taxName, taxId, taxAddress,
      acceptPrivacy, acceptTerms, acceptContract, signature,
      // Seguro de Gastos Médicos
      insuranceCompany, insurancePolicyNumber, insurancePolicyHolder,
      insuranceStartDate, insuranceEndDate
    } = req.body;

    // Validaciones básicas
    console.log('Validando campos obligatorios...');
    console.log('firstName:', firstName);
    console.log('lastName:', lastName);
    console.log('email:', email);
    console.log('password:', password ? 'PROVIDED' : 'MISSING');
    console.log('phone:', phone);
    console.log('doctorId:', doctorId);
    
    if (!firstName || !lastName || !email || !password || !phone || !doctorId) {
      console.log('ERROR: Campos obligatorios faltantes');
      console.log('Campos faltantes:', { firstName, lastName, email, password: '***', phone, doctorId });
      return res.status(400).json({ message: 'Todos los campos obligatorios son requeridos' });
    }
    console.log('Validaciones básicas pasadas');

    // Validar consentimientos legales
    console.log('Validando consentimientos legales...');
    console.log('acceptPrivacy:', acceptPrivacy);
    console.log('acceptTerms:', acceptTerms);
    console.log('acceptContract:', acceptContract);
    console.log('signature:', signature ? 'PROVIDED' : 'MISSING');
    
    if (!acceptPrivacy || !acceptTerms || !acceptContract || !signature) {
      console.log('ERROR: Faltan consentimientos legales');
      return res.status(400).json({ message: 'Debes aceptar todos los consentimientos legales y firmar digitalmente' });
    }
    console.log('Consentimientos legales validados correctamente');

    // Verificar que el doctor existe
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } }
    });

    if (!doctor) {
      return res.status(404).json({ message: 'Profesional de la salud no encontrado' });
    }

    // Verificar si existe un usuario con ese email
    console.log('Verificando si existe usuario con email:', email.toLowerCase());
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { patientProfile: true }
    });
    console.log('Usuario existente encontrado:', existingUser ? 'SÍ' : 'NO');
    if (existingUser) {
      console.log('Rol del usuario existente:', existingUser.role);
      console.log('Tiene perfil de paciente:', existingUser.patientProfile ? 'SÍ' : 'NO');
    }

    // Verificar si existe una invitación válida para este email y doctor
    console.log('Verificando si existe invitación válida para este email y doctor...');
    const validInvitation = await prisma.patientInvitation.findFirst({
      where: {
        email: email.toLowerCase(),
        doctorId: doctorId,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });

    if (!validInvitation) {
      console.log('ERROR: No se encontró invitación válida para este email y doctor');
      return res.status(400).json({ 
        message: 'No tienes una invitación válida para registrarte con este profesional de la salud. Debes recibir una invitación por email antes de poder completar tu registro.' 
      });
    }

    console.log('Invitación válida encontrada:', validInvitation.id);
    console.log('Invitación expira:', validInvitation.expiresAt);

    let user;

    if (existingUser) {
      // Verificar si es un usuario pre-registrado por doctor que puede completar su registro
      console.log('Usuario existente encontrado, verificando si puede completar registro...');
      
      // Si ya tiene contraseña y perfil completo, no permitir registro duplicado
      if (existingUser.password && existingUser.patientProfile) {
        console.log('ERROR: Usuario ya tiene registro completo');
        return res.status(400).json({ 
          message: 'Ya existe un usuario registrado con ese email. Si olvidaste tu contraseña, puedes usar la opción "¿Olvidaste tu contraseña?"' 
        });
      }
      
      // Si es un usuario pre-registrado sin contraseña, permitir completar el registro
      if (!existingUser.password) {
        console.log('Usuario pre-registrado sin contraseña, permitiendo completar registro...');
        user = existingUser;
      } else {
        console.log('ERROR: Usuario existente con contraseña pero sin perfil completo');
        return res.status(400).json({ 
          message: 'Ya existe un usuario registrado con ese email. Si olvidaste tu contraseña, puedes usar la opción "¿Olvidaste tu contraseña?"' 
        });
      }
    } else {
      // Crear nuevo usuario paciente
      console.log('Creando nuevo usuario paciente...');
      const hashedPassword = await hashPassword(password);
      
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          password: hashedPassword,
          firstName,
          lastName,
          phone,
          role: 'PATIENT'
        }
      });
      console.log('Usuario paciente creado exitosamente:', user.id);
    }

    // Si es un usuario existente, actualizar con nueva contraseña
    if (existingUser && !existingUser.password) {
      console.log('Actualizando usuario existente con nueva contraseña...');
      const hashedPassword = await hashPassword(password);
      
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          firstName,
          lastName,
          phone
        }
      });
      console.log('Usuario existente actualizado exitosamente:', user.id);
    }

    // Crear el perfil de paciente
    console.log('Creando perfil de paciente...');
    const patient = await prisma.patient.create({
      data: {
        userId: user.id,
        gender: gender || '',
        dateOfBirth: birthDate ? new Date(birthDate) : new Date(),
        bloodType: bloodType || null,
        allergies: allergies || null,
        chronicDiseases: chronicDiseases || null,
        // Datos fiscales
        taxName: taxName || null,
        taxId: taxId || null,
        taxAddress: taxAddress || null,
        // Seguro de Gastos Médicos
        insuranceCompany: insuranceCompany || null,
        insurancePolicyNumber: insurancePolicyNumber || null,
        insurancePolicyHolder: insurancePolicyHolder || null,
        insuranceStartDate: insuranceStartDate ? new Date(insuranceStartDate) : null,
        insuranceEndDate: insuranceEndDate ? new Date(insuranceEndDate) : null,
        dataConsent: true,
        firstName,
        lastName,
        phone: phone || null, // Guardar el teléfono en el modelo Patient
        email: email || null, // También guardar el email en Patient para consistencia
      }
    });
    console.log('Perfil de paciente creado exitosamente:', patient.id);

    // Manejo de archivos
    console.log('Manejando archivos...');
    let taxCertificateUrl: string | null = null;
    let profilePhotoUrl: string | null = null;
    
    if (req.files) {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      // Manejar archivo de constancia fiscal
      if (files.taxCertificate && files.taxCertificate[0]) {
        console.log('Archivo de constancia fiscal encontrado, subiendo a S3...');
        try {
          const { url } = await uploadToS3(files.taxCertificate[0], 'patient-tax-certificates', user.id);
          taxCertificateUrl = url;
          console.log('Archivo de constancia fiscal subido exitosamente a S3:', url);
          
          // Actualizar el paciente con la URL del certificado
          await prisma.patient.update({
            where: { id: patient.id },
            data: { taxCertificateUrl }
          });
          console.log('Paciente actualizado con URL del certificado fiscal');
        } catch (error) {
          console.error('Error subiendo archivo de constancia fiscal a S3:', error);
          // Continuar sin el archivo
        }
      } else {
        console.log('No se recibió archivo de constancia fiscal');
      }
      
      // Manejar foto de perfil
      if (files.profilePhoto && files.profilePhoto[0]) {
        console.log('Foto de perfil encontrada, subiendo a S3...');
        try {
          const { url } = await uploadToS3(files.profilePhoto[0], 'patient-profile-photos', user.id);
          profilePhotoUrl = url;
          console.log('Foto de perfil subida exitosamente a S3:', url);
          
          // Actualizar el paciente con la URL de la foto de perfil
          await prisma.patient.update({
            where: { id: patient.id },
            data: { profilePictureUrl: profilePhotoUrl }
          });
          console.log('Paciente actualizado con URL de foto de perfil');
        } catch (error) {
          console.error('Error subiendo foto de perfil a S3:', error);
          // Continuar sin el archivo
        }
      } else {
        console.log('No se recibió foto de perfil');
      }
    } else {
      console.log('No se recibieron archivos');
    }

    // Crear contactos de emergencia si se proporcionan
    console.log('Creando contactos de emergencia...');
    if (emergencyContact1Name && emergencyContact1LastName && emergencyContact1Phone) {
      console.log('Creando contacto de emergencia 1...');
      await prisma.emergencyContact.create({
        data: {
          patientId: patient.id,
          firstName: emergencyContact1Name,
          lastName: emergencyContact1LastName,
          phone: emergencyContact1Phone,
          email: emergencyContact1Email || '',
          relationship: emergencyContact1Relationship || ''
        }
      });
      console.log('Contacto de emergencia 1 creado exitosamente');
    }

    if (emergencyContact2Name && emergencyContact2LastName && emergencyContact2Phone) {
      console.log('Creando contacto de emergencia 2...');
      await prisma.emergencyContact.create({
        data: {
          patientId: patient.id,
          firstName: emergencyContact2Name,
          lastName: emergencyContact2LastName,
          phone: emergencyContact2Phone,
          email: emergencyContact2Email || '',
          relationship: emergencyContact2Relationship || ''
        }
      });
      console.log('Contacto de emergencia 2 creado exitosamente');
    }

    // Crear el vínculo con el doctor
    console.log('Creando vínculo con el doctor...');
    await prisma.doctorPatient.create({
      data: {
        doctorId,
        patientId: patient.id,
        status: 'active',
        context: 'primary',
        specialization: 'general',
        startDate: new Date()
      }
    });
    console.log('Vínculo con el doctor creado exitosamente');

    // Generar PDFs de consentimiento, registrar en BD y enviar a legal y al doctor
    console.log('Generando PDFs de consentimiento y registrando...');
    const consentDate = new Date();
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    try {
      const pdfResults = await ConsentPdfService.generateConsentPdfs({
        userId: user.id,
        email: user.email,
        fullName,
        signature: signature.trim()
      });

      await prisma.consentHistory.createMany({
        data: [
          { userId: user.id, type: 'PRIVACY_POLICY', version: '1.0', content: 'Aviso de Privacidad de Qlinexa360', acceptedAt: consentDate, pdfUrl: pdfResults.PRIVACY_POLICY.url },
          { userId: user.id, type: 'TERMS_OF_SERVICE', version: '1.0', content: 'Términos de Uso de Qlinexa360', acceptedAt: consentDate, pdfUrl: pdfResults.TERMS_OF_SERVICE.url },
          { userId: user.id, type: 'PLATFORM_CONTRACT', version: '1.0', content: 'Contrato de Uso de Plataforma de Qlinexa360', acceptedAt: consentDate, pdfUrl: pdfResults.PLATFORM_CONTRACT.url },
          { userId: user.id, type: 'DIGITAL_SIGNATURE', version: '1.0', content: `Firma digital: ${signature}`, acceptedAt: consentDate }
        ]
      });
      console.log('Consentimientos legales registrados exitosamente');

      // Enviar 3 PDFs a legal@qlinexa360.com (igual que para DOCTOR y ASISTENTE)
      await NotificationService.sendNewUserConsentToLegal({
        fullName,
        email: user.email,
        role: 'PATIENT',
        pdfBuffers: {
          aviso: pdfResults.PRIVACY_POLICY.buffer,
          terminos: pdfResults.TERMS_OF_SERVICE.buffer,
          contrato: pdfResults.PLATFORM_CONTRACT.buffer
        }
      });

      // Enviar solo Aviso de Privacidad al doctor que registró al paciente
      const doctorEmail = doctor.user?.email;
      if (doctorEmail) {
        await NotificationService.sendPatientAvisoPrivacidadToDoctor({
          doctorEmail,
          patientName: fullName,
          patientEmail: user.email,
          avisoPdfBuffer: pdfResults.PRIVACY_POLICY.buffer
        });
      } else {
        console.warn('No se pudo enviar Aviso de Privacidad al doctor: email no encontrado');
      }
    } catch (consentError) {
      console.error('Error generando consentimientos o enviando emails:', consentError);
      // No fallar el registro si falla la generación de PDFs o envío de emails
    }

    // Marcar la invitación como completada
    console.log('Marcando invitación como completada...');
    await prisma.patientInvitation.update({
      where: { id: validInvitation.id },
      data: { 
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });
    console.log('Invitación marcada como completada');

    console.log(`Paciente registrado desde frontend: ${user.id} para doctor ${doctorId} con consentimientos legales`);
    console.log('=== REGISTRO COMPLETADO EXITOSAMENTE ===');

    // Enviar correo de bienvenida
    try {
      await NotificationService.sendWelcomeEmail(user.email, user.firstName, user.lastName, 'PATIENT');
    } catch (emailError) {
      console.error('Error enviando correo de bienvenida:', emailError);
      // No fallar el registro si el correo falla
    }

    res.status(201).json({
      message: 'Paciente registrado exitosamente',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('=== ERROR EN REGISTRO PACIENTE FRONTEND ===');
    console.error('Tipo de error:', typeof error);
    if (error instanceof Error) {
      console.error('Mensaje de error:', error.message);
      console.error('Stack trace:', error.stack);
    }
    console.error('Error completo:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
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
