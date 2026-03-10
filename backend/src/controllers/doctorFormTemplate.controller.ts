import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../config/database';
import { AppError } from '../utils/error.utils';

/**
 * Obtener plantillas personalizadas del doctor autenticado
 */
export const getDoctorTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Autenticación requerida.', 401);

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const templates = await prisma.doctorFormTemplate.findMany({
      where: { doctorId: doctor.id },
      include: {
        fields: { orderBy: { position: 'asc' } },
      },
    });

    res.status(200).json(templates);
  } catch (error: any) {
    console.error('Error al obtener plantillas del doctor:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener plantillas.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

/**
 * Crear plantilla personalizada
 */
export const createDoctorTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Autenticación requerida.', 401);

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const { name, fields } = req.body as { name: string; fields: { fieldType: 'numeric' | 'text'; label: string }[] };

    if (!name || !name.trim()) throw new AppError('El nombre es requerido.', 400);

    const maxNumeric = 10;
    const maxText = 10;
    const numericFields = (fields || []).filter((f: any) => f.fieldType === 'numeric').slice(0, maxNumeric);
    const textFields = (fields || []).filter((f: any) => f.fieldType === 'text').slice(0, maxText);
    const allFields = [...numericFields, ...textFields];

    if (allFields.length === 0) throw new AppError('Debe al menos un campo.', 400);

    const template = await prisma.doctorFormTemplate.create({
      data: {
        doctorId: doctor.id,
        name: name.trim(),
        fields: {
          create: allFields.map((f: any, idx: number) => ({
            fieldType: f.fieldType,
            label: (f.label || `Campo ${idx + 1}`).trim(),
            position: idx + 1,
          })),
        },
      },
      include: { fields: { orderBy: { position: 'asc' } } },
    });

    res.status(201).json(template);
  } catch (error: any) {
    console.error('Error al crear plantilla:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al crear plantilla.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

/**
 * Actualizar plantilla personalizada
 */
export const updateDoctorTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Autenticación requerida.', 401);

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const { id } = req.params;
    const { name, fields } = req.body as { name?: string; fields?: { fieldType: 'numeric' | 'text'; label: string }[] };

    const existing = await prisma.doctorFormTemplate.findFirst({
      where: { id, doctorId: doctor.id },
      include: { fields: true },
    });

    if (!existing) throw new AppError('Plantilla no encontrada.', 404);

    if (fields) {
      await prisma.doctorFormTemplateField.deleteMany({ where: { templateId: id } });

      const maxNumeric = 10;
      const maxText = 10;
      const numericFields = fields.filter((f: any) => f.fieldType === 'numeric').slice(0, maxNumeric);
      const textFields = fields.filter((f: any) => f.fieldType === 'text').slice(0, maxText);
      const allFields = [...numericFields, ...textFields];

      await prisma.doctorFormTemplateField.createMany({
        data: allFields.map((f: any, idx: number) => ({
          templateId: id,
          fieldType: f.fieldType,
          label: (f.label || `Campo ${idx + 1}`).trim(),
          position: idx + 1,
        })),
      });
    }

    const template = await prisma.doctorFormTemplate.update({
      where: { id },
      data: name !== undefined ? { name: name.trim() } : {},
      include: { fields: { orderBy: { position: 'asc' } } },
    });

    res.status(200).json(template);
  } catch (error: any) {
    console.error('Error al actualizar plantilla:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al actualizar plantilla.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

/**
 * Eliminar plantilla personalizada
 */
export const deleteDoctorTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Autenticación requerida.', 401);

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const { id } = req.params;

    const existing = await prisma.doctorFormTemplate.findFirst({
      where: { id, doctorId: doctor.id },
    });

    if (!existing) throw new AppError('Plantilla no encontrada.', 404);

    await prisma.doctorFormTemplate.delete({ where: { id } });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error al eliminar plantilla:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al eliminar plantilla.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

/**
 * Guardar datos de formulario personalizado
 */
export const saveDoctorFormData = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Autenticación requerida.', 401);

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const { medicalRecordId, templateId, patientId, data } = req.body as {
      medicalRecordId: string;
      templateId: string;
      patientId: string;
      data: Record<string, string | number>;
    };

    if (!medicalRecordId || !templateId || !patientId || !data) {
      throw new AppError('Faltan campos requeridos.', 400);
    }

    const template = await prisma.doctorFormTemplate.findFirst({
      where: { id: templateId, doctorId: doctor.id },
    });

    if (!template) throw new AppError('Plantilla no encontrada.', 404);

    const existing = await prisma.doctorFormData.findFirst({
      where: { medicalRecordId, templateId },
    });

    const payload = {
      medicalRecordId,
      templateId,
      patientId,
      doctorId: doctor.id,
      data: data as object,
    };

    // Upsert: crear o actualizar
    const result = existing
      ? await prisma.doctorFormData.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.doctorFormData.create({
          data: payload,
        });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error al guardar datos:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al guardar datos.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

/**
 * Obtener datos de formulario para gráficas (por paciente y template)
 */
export const getDoctorFormDataForCharts = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) throw new AppError('Autenticación requerida.', 401);

    const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId } });
    if (!doctor) throw new AppError('Perfil de doctor no encontrado.', 404);

    const { patientId, templateId } = req.query as { patientId?: string; templateId?: string };

    if (!patientId || !templateId) {
      throw new AppError('patientId y templateId son requeridos.', 400);
    }

    const template = await prisma.doctorFormTemplate.findFirst({
      where: { id: templateId, doctorId: doctor.id },
      include: { fields: true },
    });

    if (!template) throw new AppError('Plantilla no encontrada.', 404);

    const records = await prisma.doctorFormData.findMany({
      where: { patientId, templateId, doctorId: doctor.id },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json(records);
  } catch (error: any) {
    console.error('Error al obtener datos para gráficas:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener datos.', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};
