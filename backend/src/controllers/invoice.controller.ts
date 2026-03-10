import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { NotificationService } from '../services/notification.service';
import { securityLogger } from '../utils/logger.utils';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error.utils';

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

    // Guardar archivos localmente (puedes adaptar a S3 si lo usas)
    const uploadsDir = path.join(__dirname, '../../uploads/invoices');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const pdfPath = path.join(uploadsDir, `${Date.now()}-${pdfFile.originalname}`);
    const xmlPath = path.join(uploadsDir, `${Date.now()}-${xmlFile.originalname}`);
    fs.writeFileSync(pdfPath, pdfFile.buffer);
    fs.writeFileSync(xmlPath, xmlFile.buffer);
    const pdfUrl = `/uploads/invoices/${path.basename(pdfPath)}`;
    const xmlUrl = `/uploads/invoices/${path.basename(xmlPath)}`;

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
    
    // Elimina archivos locales (opcional)
    try {
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith('/uploads/')) {
        fs.unlinkSync(path.join(__dirname, '../../', invoice.pdfUrl));
      }
      if (invoice.xmlUrl && invoice.xmlUrl.startsWith('/uploads/')) {
        fs.unlinkSync(path.join(__dirname, '../../', invoice.xmlUrl));
      }
    } catch (e) { 
      console.log('Error al eliminar archivos locales:', e);
      // Continuar aunque falle la eliminación de archivos
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

    // Construir rutas completas de los archivos
    const pdfPath = invoice.pdfUrl.startsWith('/uploads/')
      ? path.join(__dirname, '../../', invoice.pdfUrl)
      : invoice.pdfUrl;
    
    const xmlPath = invoice.xmlUrl.startsWith('/uploads/')
      ? path.join(__dirname, '../../', invoice.xmlUrl)
      : invoice.xmlUrl;

    // Verificar que los archivos existan
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ success: false, message: 'El archivo PDF no se encuentra en el servidor' });
    }
    
    if (!fs.existsSync(xmlPath)) {
      return res.status(404).json({ success: false, message: 'El archivo XML no se encuentra en el servidor' });
    }

    // Enviar correo con archivos adjuntos
    const notificationService = NotificationService.getInstance();
    const sent = await notificationService.sendInvoiceToPatientEmail({
      toEmail: patientEmail,
      patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      doctorName: `${invoice.doctor?.user?.firstName || ''} ${invoice.doctor?.user?.lastName || ''}`.trim(),
      invoiceDate,
      pdfPath,
      xmlPath
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