import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth.middleware';
import { NotificationService } from '../services/notification.service';
import { securityLogger } from '../utils/logger.utils';

/**
 * Relación de facturación del ADMIN: Qlinexa factura la SUSCRIPCIÓN a los doctores
 * (los únicos usuarios de paga). Solo se factura cuando hay pago real; los meses
 * gratis/promoción se registran con importe 0 (sin archivos) para llevar la relación completa.
 */

const UPLOADS_SUBDIR = '../../uploads/subscription-invoices';

function fullPathFromUrl(url: string): string {
  return url.startsWith('/uploads/') ? path.join(__dirname, '../../', url) : url;
}

function parseAmount(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export class AdminBillingController {
  /** Lista de doctores (clientes de paga) con datos fiscales y estado de suscripción. */
  static async listDoctors(_req: AuthRequest, res: Response) {
    const doctors = await prisma.doctor.findMany({
      orderBy: { user: { firstName: 'asc' } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        subscription: { select: { status: true, startDate: true, endDate: true } },
        _count: { select: { subscriptionInvoices: true } }
      }
    });

    const data = doctors.map((d) => ({
      id: d.id,
      firstName: d.user?.firstName || '',
      lastName: d.user?.lastName || '',
      email: d.user?.email || '',
      specialization: d.specialization,
      licenseNumber: d.licenseNumber,
      tax: {
        taxName: d.taxName || '',
        taxId: d.taxId || '',
        taxAddress: d.taxAddress || '',
        taxPostalCode: d.taxPostalCode || '',
        taxRegime: d.taxRegime || ''
      },
      subscriptionStatus: d.subscription?.status || null,
      subscriptionStart: d.subscription?.startDate || null,
      subscriptionEnd: d.subscription?.endDate || null,
      invoicesCount: d._count.subscriptionInvoices
    }));

    return res.json({ success: true, data });
  }

  /** Actualiza los datos fiscales del doctor (receptor de la factura). */
  static async updateDoctorTax(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { taxName, taxId, taxAddress, taxPostalCode, taxRegime } = req.body as Record<string, string>;
    const doctor = await prisma.doctor.findUnique({ where: { id } });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor no encontrado' });

    const updated = await prisma.doctor.update({
      where: { id },
      data: {
        ...(taxName !== undefined ? { taxName: taxName || '' } : {}),
        ...(taxId !== undefined ? { taxId: taxId || '' } : {}),
        ...(taxAddress !== undefined ? { taxAddress: taxAddress || '' } : {}),
        ...(taxPostalCode !== undefined ? { taxPostalCode: taxPostalCode || null } : {}),
        ...(taxRegime !== undefined ? { taxRegime: taxRegime || null } : {})
      }
    });
    return res.json({
      success: true,
      message: 'Datos fiscales actualizados',
      data: {
        taxName: updated.taxName || '',
        taxId: updated.taxId || '',
        taxAddress: updated.taxAddress || '',
        taxPostalCode: updated.taxPostalCode || '',
        taxRegime: updated.taxRegime || ''
      }
    });
  }

  /** Facturas de suscripción de un doctor. */
  static async getDoctorInvoices(req: AuthRequest, res: Response) {
    const { doctorId } = req.params;
    const invoices = await prisma.subscriptionInvoice.findMany({
      where: { doctorId },
      orderBy: { invoiceDate: 'desc' }
    });
    return res.json({
      success: true,
      data: invoices.map((i) => ({ ...i, amount: Number(i.amount) }))
    });
  }

  /** Crea una factura de suscripción para un doctor (PDF/XML opcionales; importe 0 = mes sin cobro). */
  static async uploadInvoice(req: AuthRequest, res: Response) {
    try {
      const { doctorId, invoiceDate, currency, notes } = req.body as Record<string, string>;
      if (!doctorId || !invoiceDate) {
        return res.status(400).json({ success: false, message: 'Faltan datos: doctorId y fecha de factura' });
      }
      const amount = parseAmount(req.body.amount);
      if (amount === null) {
        return res.status(400).json({ success: false, message: 'El importe debe ser un número mayor o igual a 0' });
      }

      const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
      if (!doctor) {
        return res.status(404).json({ success: false, message: 'Doctor no encontrado' });
      }

      const files = (req.files as any) || {};
      const pdfFile = files.pdf?.[0];
      const xmlFile = files.xml?.[0];

      // Cuando hay cobro real (importe > 0) exigimos el PDF de la factura.
      if (amount > 0 && !pdfFile) {
        return res.status(400).json({ success: false, message: 'Sube el PDF de la factura cuando el importe es mayor a 0' });
      }

      let pdfUrl: string | null = null;
      let xmlUrl: string | null = null;
      if (pdfFile || xmlFile) {
        const uploadsDir = path.join(__dirname, UPLOADS_SUBDIR);
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
        if (pdfFile) {
          const pdfPath = path.join(uploadsDir, `${Date.now()}-${pdfFile.originalname}`);
          fs.writeFileSync(pdfPath, pdfFile.buffer);
          pdfUrl = `/uploads/subscription-invoices/${path.basename(pdfPath)}`;
        }
        if (xmlFile) {
          const xmlPath = path.join(uploadsDir, `${Date.now()}-${xmlFile.originalname}`);
          fs.writeFileSync(xmlPath, xmlFile.buffer);
          xmlUrl = `/uploads/subscription-invoices/${path.basename(xmlPath)}`;
        }
      }

      const invoice = await prisma.subscriptionInvoice.create({
        data: {
          doctorId,
          invoiceDate: new Date(invoiceDate),
          amount,
          currency: (currency || 'MXN').toUpperCase(),
          pdfUrl,
          xmlUrl,
          notes: notes || null,
          createdByAdminUserId: req.user?.userId || null
        }
      });
      return res.status(201).json({ success: true, data: { ...invoice, amount: Number(invoice.amount) } });
    } catch (error: any) {
      console.error('Error al subir factura de suscripción:', error);
      return res.status(500).json({ success: false, message: 'Error al subir la factura' });
    }
  }

  /** Elimina una factura de suscripción y sus archivos. */
  static async deleteInvoice(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id } });
    if (!invoice) return res.status(404).json({ success: false, message: 'Factura no encontrada' });

    try {
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith('/uploads/')) fs.unlinkSync(fullPathFromUrl(invoice.pdfUrl));
      if (invoice.xmlUrl && invoice.xmlUrl.startsWith('/uploads/')) fs.unlinkSync(fullPathFromUrl(invoice.xmlUrl));
    } catch (e) {
      console.log('No se pudieron borrar los archivos locales de la factura:', e);
    }

    await prisma.subscriptionInvoice.delete({ where: { id } });
    return res.json({ success: true, message: 'Factura eliminada' });
  }

  /** Envía la factura al doctor por correo, con PDF/XML adjuntos. */
  static async sendInvoiceEmail(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const invoice = await prisma.subscriptionInvoice.findUnique({
        where: { id },
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } }
        }
      });
      if (!invoice) return res.status(404).json({ success: false, message: 'Factura no encontrada' });

      const toEmail = invoice.doctor?.user?.email;
      if (!toEmail) return res.status(400).json({ success: false, message: 'El doctor no tiene correo registrado' });
      if (!invoice.pdfUrl) {
        return res.status(400).json({ success: false, message: 'Sube primero el PDF de la factura para poder enviarla' });
      }

      const pdfPath = fullPathFromUrl(invoice.pdfUrl);
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ success: false, message: 'El archivo PDF no se encuentra en el servidor' });
      }
      const xmlPath = invoice.xmlUrl ? fullPathFromUrl(invoice.xmlUrl) : undefined;

      const invoiceDateLabel = new Date(invoice.invoiceDate).toLocaleDateString('es-MX', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      const amountLabel = `$${Number(invoice.amount).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency}`;

      const sent = await NotificationService.getInstance().sendSubscriptionInvoiceToDoctorEmail({
        toEmail,
        doctorName: `${invoice.doctor?.user?.firstName || ''} ${invoice.doctor?.user?.lastName || ''}`.trim(),
        invoiceDate: invoiceDateLabel,
        amountLabel,
        pdfPath,
        xmlPath: xmlPath && fs.existsSync(xmlPath) ? xmlPath : undefined
      });

      if (!sent) return res.status(500).json({ success: false, message: 'No se pudo enviar el correo' });

      await prisma.subscriptionInvoice.update({ where: { id }, data: { sentAt: new Date() } });
      return res.json({ success: true, message: 'Factura enviada al doctor por correo' });
    } catch (error: any) {
      securityLogger.error('Error al enviar factura de suscripción por email:', error);
      return res.status(500).json({ success: false, message: 'Error interno al enviar la factura' });
    }
  }
}
