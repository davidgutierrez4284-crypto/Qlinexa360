import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';

const resolveDoctorId = async (req: AuthRequest): Promise<string> => {
  if (!req.user) throw new AppError('Autenticación requerida.', 401);

  if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      select: { id: true }
    });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);
    return doctor.id;
  }

  if (req.user.role === 'ASISTENTE') {
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
      throw new AppError('Doctor seleccionado requerido.', 400);
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
      throw new AppError('Asistente no vinculado a este doctor.', 403);
    }

    return selectedDoctorId;
  }

  throw new AppError('Acceso denegado.', 403);
};

const getDoctorAccessForPatient = async (doctorId: string, patientId: string, userId?: string) => {
  // Caso especial: doctor viendo su propio perfil de paciente
  if (userId) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { userId: true }
    });
    if (patient?.userId === userId) {
      return { isCollaborator: false, collaborativeCaseIds: [] as string[] };
    }
  }

  const doctorPatientLink = await prisma.doctorPatient.findUnique({
    where: { doctorId_patientId: { doctorId, patientId } }
  });

  if (doctorPatientLink) {
    return { isCollaborator: false, collaborativeCaseIds: [] as string[] };
  }

  const collaborations = await prisma.padecimientoDoctorColaborador.findMany({
    where: {
      doctorId,
      patientId
    },
    select: { padecimientoId: true }
  });

  if (collaborations.length === 0) {
    throw new AppError('No tienes acceso a los casos clínicos de este paciente.', 403);
  }

  return {
    isCollaborator: true,
    collaborativeCaseIds: collaborations.map(c => c.padecimientoId)
  };
};

// Listar todos los casos clínicos de un paciente
export const listClinicalCases = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const doctorId = await resolveDoctorId(req);
    const { isCollaborator, collaborativeCaseIds } = await getDoctorAccessForPatient(doctorId, patientId, req.user?.userId);

    const cases = await prisma.clinicalCase.findMany({
      where: {
        patientId,
        ...(isCollaborator ? { id: { in: collaborativeCaseIds } } : {})
      },
      orderBy: { createdAt: 'desc' },
      include: {
        medicalRecords: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          select: { id: true, diagnosis: true, createdAt: true, date: true, clinicalEvolution: true }
        }
      }
    });

    res.json(cases.map(c => ({ ...c, padecimiento: c.padecimiento })));
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al obtener casos clínicos', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Crear un nuevo caso clínico
export const createClinicalCase = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const { padecimiento, status } = req.body;
    if (!padecimiento) throw new AppError('El padecimiento es obligatorio', 400);
    if (padecimiento.length > 20) throw new AppError('El padecimiento debe tener máximo 20 caracteres', 400);
    const clinicalCase = await prisma.clinicalCase.create({
      data: {
        patientId,
        padecimiento,
        status: status || 'abierto',
      }
    });
    res.status(201).json(clinicalCase);
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al crear caso clínico', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Obtener un caso clínico específico
export const getClinicalCase = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const doctorId = await resolveDoctorId(req);
    const clinicalCase = await prisma.clinicalCase.findUnique({
      where: { id: caseId },
      include: {
        medicalRecords: {
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        }
      }
    });
    if (!clinicalCase) return res.status(404).json({ message: 'Caso clínico no encontrado' });

    const { isCollaborator, collaborativeCaseIds } = await getDoctorAccessForPatient(doctorId, clinicalCase.patientId);
    if (isCollaborator && !collaborativeCaseIds.includes(clinicalCase.id)) {
      throw new AppError('No tienes acceso a este caso clínico.', 403);
    }

    res.json(clinicalCase);
  } catch (error) {
    const handled = error instanceof AppError ? error : new AppError('Error al obtener caso clínico', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Actualizar estado o padecimiento de un caso clínico
export const updateClinicalCase = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const { padecimiento, status } = req.body;
    if (typeof padecimiento === 'string') {
      const trimmed = padecimiento.trim();
      if (!trimmed) {
        throw new AppError('El padecimiento no puede estar vacío', 400);
      }
      if (trimmed.length > 20) {
        throw new AppError('El padecimiento debe tener máximo 20 caracteres', 400);
      }
    }
    const updated = await prisma.clinicalCase.update({
      where: { id: caseId },
      data: {
        ...(padecimiento && { padecimiento: padecimiento.trim() }),
        ...(status && { status })
      }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar caso clínico' });
  }
};

// Eliminar un caso clínico únicamente si no tiene consultas asociadas
export const deleteClinicalCase = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;

    const existing = await prisma.clinicalCase.findUnique({ where: { id: caseId } });
    if (!existing) {
      return res.status(404).json({ message: 'Caso clínico no encontrado' });
    }

    const recordsCount = await prisma.medicalRecord.count({ where: { clinicalCaseId: caseId } });
    if (recordsCount > 0) {
      throw new AppError('No se puede eliminar el caso clínico porque tiene consultas asociadas.', 400);
    }

    await prisma.clinicalCase.delete({ where: { id: caseId } });
    res.json({ success: true, message: 'Caso clínico eliminado correctamente.' });
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al eliminar caso clínico', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Listar notas clínicas de un caso
export const listCaseMedicalRecords = async (req: AuthRequest, res: Response) => {
  try {
    const { caseId } = req.params;
    const doctorId = await resolveDoctorId(req);
    const clinicalCase = await prisma.clinicalCase.findUnique({
      where: { id: caseId },
      select: { id: true, patientId: true }
    });

    if (!clinicalCase) {
      return res.status(404).json({ message: 'Caso clínico no encontrado' });
    }

    const { isCollaborator, collaborativeCaseIds } = await getDoctorAccessForPatient(doctorId, clinicalCase.patientId);
    if (isCollaborator && !collaborativeCaseIds.includes(clinicalCase.id)) {
      throw new AppError('No tienes acceso a este caso clínico.', 403);
    }

    const records = await prisma.medicalRecord.findMany({
      where: { clinicalCaseId: caseId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        files: true,
        links: true,
        prescriptions: true,
        user: { select: { firstName: true, lastName: true } }
      }
    });
    
    // Agregar logs para debug
    console.log('Registros médicos encontrados:', records.length);
    records.forEach((record, index) => {
      console.log(`Registro ${index + 1}:`, {
        id: record.id,
        diagnosis: record.diagnosis,
        formData: record.formData,
        reason: record.reason,
        tags: record.tags,
        createdAt: record.createdAt,
        createdAtISO: record.createdAt.toISOString(),
        createdAtLocal: record.createdAt.toLocaleDateString('es-ES'),
        date: record.date,
        dateISO: record.date?.toISOString(),
        dateLocal: record.date?.toLocaleDateString('es-ES')
      });
    });
    
    res.json(records);
  } catch (error) {
    const handled = error instanceof AppError ? error : new AppError('Error al obtener notas clínicas del caso', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Crear una nota clínica dentro de un caso
export const createCaseMedicalRecord = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) throw new AppError('Autenticación requerida.', 401);
    const { caseId } = req.params;
    const { doctorPatientId, patientId, diagnosis, treatment, notes, tags, clinicalEvolution, formData, fileIds, links, date } = req.body;
    if (!diagnosis || !clinicalEvolution) throw new AppError('Diagnóstico y evolución clínica son obligatorios', 400);
    
    // Manejar la fecha correctamente
    let createdAt = new Date();
    if (date) {
      // Si se proporciona una fecha, convertirla a objeto Date
      // La fecha viene en formato YYYY-MM-DD desde el frontend
      const [year, month, day] = date.split('-').map(Number);
      
      // Crear la fecha usando UTC para evitar problemas de zona horaria
      // Usar UTC asegura que la fecha se guarde exactamente como se especifica
      createdAt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      
      console.log('Fecha recibida del frontend:', date);
      console.log('Año:', year, 'Mes:', month, 'Día:', day);
      console.log('Fecha creada (UTC):', createdAt.toISOString());
      console.log('Fecha en zona local:', createdAt.toLocaleDateString('es-ES'));
      console.log('Fecha en UTC string:', createdAt.toUTCString());
    } else {
      console.log('No se proporcionó fecha, usando fecha actual');
    }
    
    // Validar doctor-paciente, archivos, etc. según tu lógica
    const record = await prisma.medicalRecord.create({
      data: {
        clinicalCaseId: caseId,
        doctorPatientId,
        patientId,
        diagnosis,
        treatment,
        notes,
        tags: tags || [],
        clinicalEvolution,
        formData: formData || {},
        userId: req.user.userId,
        autorConsultaId: req.user.userId, // ID del doctor que crea la consulta
        files: fileIds && fileIds.length > 0 ? { connect: fileIds.map((id: string) => ({ id })) } : undefined,
        links: links && links.length > 0 ? { create: links } : undefined,
        createdAt: createdAt,
        date: createdAt, // Guardar también en el campo date explícitamente
      },
      include: {
        files: true,
        links: true
      }
    });
    
    // Bloquear edición colaborativa de consultas anteriores del mismo padecimiento
    await prisma.medicalRecord.updateMany({
      where: {
        clinicalCaseId: caseId,
        autorConsultaId: { not: req.user.userId },
        isEditable: true
      },
      data: {
        isEditable: false
      }
    });

    console.log('Registro médico creado con fecha:', record.createdAt);
    console.log('Fecha del registro en ISO:', record.createdAt.toISOString());
    console.log('Fecha del registro en local:', record.createdAt.toLocaleDateString('es-ES'));
    res.status(201).json(record);
  } catch (error: any) {
    console.error('Error al crear nota clínica:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al crear nota clínica en el caso', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
}; 