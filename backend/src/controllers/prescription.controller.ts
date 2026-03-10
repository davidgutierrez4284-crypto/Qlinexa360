import { Request, Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { v4 as uuid } from 'uuid';

// CRUD para PrescriptionTemplate
export const getPrescriptionTemplates = async (req: AuthRequest, res: Response) => {
  console.log('getPrescriptionTemplates called');
  console.log('User from token:', req.user);
  
  const userId = req.user?.userId;
  console.log('userId:', userId);
  
  const doctor = await prisma.doctor.findUnique({ 
    where: { userId },
    include: { user: true }
  });
  console.log('Doctor found:', doctor ? `${doctor.user.firstName} ${doctor.user.lastName}` : 'Not found');
  
  if (!doctor) return res.status(404).json({ message: 'Doctor no encontrado' });
  
  const templates = await prisma.prescriptionTemplate.findMany({ where: { doctorId: doctor.id } });
  console.log('Templates found:', templates.length);
  console.log('Templates:', templates);
  
  res.json(templates);
};

export const createPrescriptionTemplate = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) return res.status(404).json({ message: 'Doctor no encontrado' });
  const { name, content } = req.body;
  const template = await prisma.prescriptionTemplate.create({
    data: { doctorId: doctor.id, name, content }
  });
  res.status(201).json(template);
};

export const updatePrescriptionTemplate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, content } = req.body;
  const template = await prisma.prescriptionTemplate.update({
    where: { id },
    data: { name, content }
  });
  res.json(template);
};

export const deletePrescriptionTemplate = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  await prisma.prescriptionTemplate.delete({ where: { id } });
  res.json({ message: 'Plantilla eliminada' });
};

// Asociar receta a consulta (crear Prescription)
export const createPrescription = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.userId;
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) return res.status(404).json({ message: 'Doctor no encontrado' });
  const { medicalRecordId } = req.params;
  const { patientId, fileId } = req.body;
  // fileId es el archivo PDF generado y subido previamente
  const prescription = await prisma.prescription.create({
    data: {
      medicalRecordId,
      doctorId: doctor.id,
      patientId,
      fileId
    }
  });
  res.status(201).json(prescription);
};

// Listar recetas asociadas a una consulta
export const getPrescriptionsByMedicalRecord = async (req: AuthRequest, res: Response) => {
  const { medicalRecordId } = req.params;
  const prescriptions = await prisma.prescription.findMany({
    where: { medicalRecordId },
    include: { file: true }
  });
  res.json(prescriptions);
}; 

// Generar PDF desde plantilla (simple, texto plano) y registrar receta
export const generatePdfFromTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const doctor = await prisma.doctor.findUnique({ 
      where: { userId },
      include: { user: true }
    });
    if (!doctor) return res.status(404).json({ message: 'Doctor no encontrado' });

    const { medicalRecordId } = req.params;
    const { patientId, templateId, variables } = req.body as {
      patientId: string;
      templateId: string;
      variables: Record<string, string>;
    };

    const template = await prisma.prescriptionTemplate.findUnique({ where: { id: templateId } });
    if (!template) return res.status(404).json({ message: 'Plantilla no encontrada' });

    // Render muy simple: reemplazo de {{clave}} en el contenido
    const render = (content: string, vars: Record<string, string>) =>
      content.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => (vars[k] ?? ''));

    const rendered = render(template.content, variables || {});

    // Generación de PDF minimalista: envolver texto en HTML sencillo y usar Buffer
    const html = `<html><head><meta charset="utf-8" /></head><body>
      <h1 style="text-align:center;">Receta médica</h1>
      <p><strong>Médico:</strong> ${doctor.user.firstName} ${doctor.user.lastName}</p>
      <p><strong>Paciente:</strong> ${variables?.patientName || ''}</p>
      <hr/>
      <pre style="white-space:pre-wrap;font-family:ui-monospace;">${rendered}</pre>
    </body></html>`;

    // Por simplicidad, almacenamos como HTML en la tabla File con mimeType text/html.
    // En producción, se recomienda usar un servicio para render a PDF (puppeteer) y subir a S3.
          const file = await prisma.file.create({
        data: {
          id: uuid(),
          url: '',
          fileName: `receta-${Date.now()}.html`,
          fileType: 'text/html',
          size: Buffer.byteLength(html, 'utf-8'),
          uploadedById: userId!,
          doctorId: doctor.id,
          patientId
        }
      });

    // Guardar el HTML en la columna url como data URI para visualización rápida
    const dataUri = `data:text/html;base64,${Buffer.from(html, 'utf-8').toString('base64')}`;
    await prisma.file.update({ where: { id: file.id }, data: { url: dataUri } });

    const prescription = await prisma.prescription.create({
      data: {
        medicalRecordId,
        doctorId: doctor.id,
        patientId,
        fileId: file.id
      },
      include: { file: true }
    });

    res.status(201).json(prescription);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar receta' });
  }
};