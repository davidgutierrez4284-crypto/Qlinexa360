import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { NotificationService } from '../services/notification.service';
import { securityLogger } from '../utils/logger.utils';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';
import {
  deleteStoredInvoiceFile,
  readInvoiceFile,
  resolveInvoiceDownloadTarget,
  uploadInvoiceFileToStorage,
} from '../utils/invoiceFile.utils';

const prisma = new PrismaClient();

const resolveDoctorId = async (req: AuthRequest): Promise<string> => {
  if (!req.user) {
    throw new AppError('Autenticación requerida', 401);
  }

  if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId: req.user.userId } });
    if (!doctor) {
      throw new AppError('Perfil de doctor no encontrado', 404);
    }
    return doctor.id;
  }

  if (req.user.role === 'ASISTENTE') {
    const selectedDoctorId = req.headers['x-selected-doctor-id'];
    if (!selectedDoctorId || Array.isArray(selectedDoctorId)) {
      throw new AppError('Doctor seleccionado requerido', 400);
    }

    const link = await prisma.asistenteDoctorVinculo.findFirst({
      where: {
        doctorId: selectedDoctorId,
        asistenteId: req.user.userId,
        activo: true
      }
    });

    if (!link) {
      throw new AppError('Asistente no vinculado a este doctor', 403);
    }

    return selectedDoctorId;
  }

  throw new AppError('No autorizado', 403);
};

// Subir factura (PDF + XML) asociada a un paciente
export const uploadInvoice = async (req: AuthRequest, res: Response) => {
  try {
    const { patientId, patientName, patientLastName, patientRFC, invoiceDate } = req.body;
    const doctorId = await resolveDoctorId(req);
    if (!patientId || !patientName || !patientLastName || !patientRFC || !invoiceDate) {
      return res.status(400).json({ message: 'Faltan datos obligatorios' });
    }
    
    const doctorPatient = await prisma.doctorPatient.findFirst({
      where: { doctorId, patientId }
    });

    if (!doctorPatient) {
      return res.status(403).json({ message: 'Paciente no asociado a este doctor' });
    }

    if (!req.files || !(req.files as any).pdf || !(req.files as any).xml) {
      return res.status(400).json({ message: 'Se requieren ambos archivos: PDF y XML' });
    }
    const pdfFile = (req.files as any).pdf[0];
    const xmlFile = (req.files as any).xml[0];

    const pdfUrl = await uploadInvoiceFileToStorage(pdfFile, doctorId, 'pdf');
    const xmlUrl = await uploadInvoiceFileToStorage(xmlFile, doctorId, 'xml');

    const invoice = await prisma.invoice.create({
      data: {
        doctorId,
        patientId,
        patientName,
        patientLastName,
        patientRFC,
        invoiceDate: new Date(invoiceDate),
        pdfUrl,
        xmlUrl
      }
    });
    res.status(201).json(invoice);
  } catch (error: any) {
    console.error('Error al subir factura:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al subir factura', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Obtener facturas (doctor ve todas, paciente solo las suyas)
export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Autenticación requerida', 401);
    }
    const user = req.user;
    console.log('=== getInvoices DEBUG ===');
    console.log('User from token:', user);
    console.log('User role:', user.role);
    console.log('User userId:', user.userId);
    
    let where: any = {};
    if (user.role?.toUpperCase() === 'DOCTOR' || user.role?.toUpperCase() === 'ASISTENTE') {
      const doctorId = await resolveDoctorId(req);
      where.doctorId = doctorId;
      console.log('Filtering by doctorId:', where.doctorId);
    } else if (user.role?.toUpperCase() === 'PATIENT') {
      // Obtener el patientId desde la base de datos usando el userId del token
      console.log('Looking for patient with userId:', user.userId);
      const patient = await prisma.patient.findUnique({
        where: { userId: user.userId }
      });
      console.log('Patient found:', patient ? { id: patient.id, userId: patient.userId } : 'NOT FOUND');
      if (!patient) {
        console.error('Patient profile not found for userId:', user.userId);
        return res.status(404).json({ message: 'Perfil de paciente no encontrado' });
      }
      where.patientId = patient.id;
      console.log('Filtering invoices by patientId:', where.patientId);
    } else {
      return res.status(403).json({ message: 'No autorizado' });
    }
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' }
    });
    console.log('Invoices found:', invoices.length);
    console.log('Invoices:', invoices.map(inv => ({ id: inv.id, patientId: inv.patientId, invoiceDate: inv.invoiceDate })));
    res.json(invoices);
  } catch (error: any) {
    console.error('Error al obtener facturas:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al obtener facturas', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Eliminar factura (solo doctor dueño)
export const deleteInvoice = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Autenticación requerida', 401);
    }
    const { id } = req.params;
    const user = req.user;
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' });
    
    // Verificar que el doctor sea el dueño de la factura
    const doctorId = user?.role === 'PATIENT' ? null : await resolveDoctorId(req);
    if (!doctorId || doctorId !== invoice.doctorId) {
      return res.status(403).json({ message: 'No tienes permiso para eliminar esta factura' });
    }
    
    try {
      await deleteStoredInvoiceFile(invoice.pdfUrl);
      await deleteStoredInvoiceFile(invoice.xmlUrl);
    } catch (e) {
      console.log('Error al eliminar archivos de factura:', e);
    }
    
    await prisma.invoice.delete({ where: { id } });
    res.json({ message: 'Factura eliminada' });
  } catch (error: any) {
    console.error('Error al eliminar factura:', error);
    const handled = error instanceof AppError ? error : new AppError('Error al eliminar factura', 500);
    res.status(handled.statusCode).json({ message: handled.message });
  }
};

// Enviar factura por email al paciente
export const sendInvoiceByEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      throw new AppError('Autenticación requerida', 401);
    }
    const { id } = req.params; // invoice id
    const user = req.user;
    
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            user: {
              select: {
                email: true
              }
            }
          }
        },
        doctor: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    // Verificar que el doctor sea el dueño de la factura
    const doctorId = user?.role === 'PATIENT' ? null : await resolveDoctorId(req);
    if (!doctorId || doctorId !== invoice.doctorId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para enviar esta factura' });
    }

    // Obtener email del paciente (del Patient o del User)
    const patientEmail = invoice.patient.email || invoice.patient.user?.email;
    
    if (!patientEmail) {
      return res.status(400).json({ success: false, message: 'El paciente no tiene email registrado' });
    }

    // Formatear fecha de factura
    const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const pdfFile = await readInvoiceFile(invoice.pdfUrl);
    const xmlFile = await readInvoiceFile(invoice.xmlUrl);

    if (!pdfFile) {
      return res.status(404).json({
        success: false,
        message:
          'El archivo PDF no se encuentra en el servidor. Vuelve a subir la factura (archivos antiguos en disco local no persisten en producción).',
      });
    }

    if (!xmlFile) {
      return res.status(404).json({
        success: false,
        message:
          'El archivo XML no se encuentra en el servidor. Vuelve a subir la factura (archivos antiguos en disco local no persisten en producción).',
      });
    }

    const notificationService = NotificationService.getInstance();
    const sent = await notificationService.sendInvoiceToPatientEmail({
      toEmail: patientEmail,
      patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      doctorName: `${invoice.doctor?.user?.firstName || ''} ${invoice.doctor?.user?.lastName || ''}`.trim(),
      invoiceDate,
      pdfAttachment: { filename: pdfFile.filename, content: pdfFile.buffer },
      xmlAttachment: { filename: xmlFile.filename, content: xmlFile.buffer },
    });

    if (!sent) {
      return res.status(500).json({ success: false, message: 'No se pudo enviar el correo' });
    }

    return res.json({ success: true, message: 'Factura enviada al paciente por correo' });
  } catch (error: any) {
    securityLogger.error('Error al enviar factura por email:', error);
    const handled = error instanceof AppError ? error : new AppError('Error interno del servidor', 500);
    res.status(handled.statusCode).json({ success: false, message: handled.message });
  }
};

async function assertInvoiceAccess(req: AuthRequest, invoice: { doctorId: string; patientId: string }) {
  if (!req.user) throw new AppError('Autenticación requerida', 401);

  if (req.user.role?.toUpperCase() === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId: req.user.userId } });
    if (!patient || patient.id !== invoice.patientId) {
      throw new AppError('No autorizado', 403);
    }
    return;
  }

  const doctorId = await resolveDoctorId(req);
  if (doctorId !== invoice.doctorId) {
    throw new AppError('No autorizado', 403);
  }
}

export const downloadInvoiceFile = async (req: AuthRequest, res: Response) => {
  try {
    const { id, type } = req.params;
    if (type !== 'pdf' && type !== 'xml') {
      return res.status(400).json({ success: false, message: 'Tipo de archivo inválido' });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Factura no encontrada' });
    }

    await assertInvoiceAccess(req, invoice);

    const storedUrl = type === 'pdf' ? invoice.pdfUrl : invoice.xmlUrl;
    const target = await resolveInvoiceDownloadTarget(storedUrl);
    if (!target) {
      return res.status(404).json({
        success: false,
        message:
          'Archivo no encontrado. Si la factura es antigua, vuelve a subir el PDF y XML (los archivos locales no se conservan en el servidor de producción).',
      });
    }

    if (target.type === 'redirect') {
      return res.redirect(302, target.url);
    }

    res.setHeader('Content-Type', target.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(target.path)}"`);
    return res.sendFile(target.path);
  } catch (error: any) {
    const handled = error instanceof AppError ? error : new AppError('Error al descargar factura', 500);
    res.status(handled.statusCode).json({ success: false, message: handled.message });
  }
}; 