import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { formatAppointmentDate, formatAppointmentTime } from '../utils/date.utils';
import { TeleconsultationConsentPdfService } from '../services/teleconsultationConsentPdf.service';
import { sendEmailHtmlWithTextFallback, sendEmailHtml, fromAddresses, brandedEmailLayout, emailInfoCard, NO_REPLY_FOOTER } from '../utils/email.utils';
import { securityLogger } from '../utils/logger.utils';
import { AppointmentConfirmationController } from './appointmentConfirmation.controller';
import { ensureActiveConfirmationRequest } from '../utils/appointmentConfirmation.utils';
import {
  createTeleconsultationPreferenceForAppointment,
  ensureTeleconsultationCheckoutUrl,
  finalizeTeleconsultationAfterPayment,
  tryFinalizeTeleconsultationAfterConsent,
  getTeleconsultationPaymentContext,
  requiresTeleconsultationPayment,
  isTeleconsultationPaymentApproved,
} from '../payments/mercadopago/mercadopago.teleconsultation.service';
import {
  createRefundRequestByToken,
  getRefundRequestByToken,
  RefundRequestError,
} from '../payments/mercadopago/mercadopago.refund.service';

const prisma = new PrismaClient();

/**
 * Obtener información de teleconsulta por token (público)
 * El meetingUrl solo se devuelve si consentSigned === true
 */
export const getTeleconsultationInfoByToken = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
      where: { confirmationToken: token },
      include: {
        appointment: {
          include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } }
          }
        }
      }
    });

    if (!confirmationRequest) {
      return res.status(404).json({ error: 'Enlace no encontrado o expirado' });
    }

    try {
      await ensureActiveConfirmationRequest(confirmationRequest);
    } catch (tokenErr: any) {
      return res.status(tokenErr.statusCode || 400).json({
        error: tokenErr.message || 'Este enlace ha expirado',
      });
    }

    const appointment = confirmationRequest.appointment;

    if (appointment.appointmentType !== 'teleconsulta') {
      return res.status(400).json({ error: 'Esta cita no es una teleconsulta' });
    }

    const teleconsultation = await prisma.teleconsultation.findUnique({
      where: { appointmentId: appointment.id }
    });

    if (!teleconsultation) {
      return res.status(404).json({ error: 'No se encontró información de teleconsulta' });
    }

    const doctorTimezone = (appointment.doctor as { timezone?: string | null })?.timezone ?? 'America/Mexico_City';
    const patientName = `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim()
      || `${appointment.patient.user?.firstName || ''} ${appointment.patient.user?.lastName || ''}`.trim();
    const doctorName = `${appointment.doctor.user?.firstName || ''} ${appointment.doctor.user?.lastName || ''}`.trim();

    const response: any = {
      success: true,
      appointmentId: appointment.id,
      patientName,
      doctorName: `${appointment.doctor.professionalTitle || ''} ${doctorName}`.trim(),
      appointmentDate: formatAppointmentDate(appointment.date, doctorTimezone),
      appointmentTime: formatAppointmentTime(appointment.date, doctorTimezone),
      consentSigned: teleconsultation.consentSigned
    };

    const paymentCtx = await getTeleconsultationPaymentContext(appointment.doctorId, appointment.id);
    response.paymentRequired = paymentCtx.paymentRequired;
    response.paymentStatus = paymentCtx.paymentStatus;
    response.paymentAmount = paymentCtx.amount;
    response.paymentCurrency = paymentCtx.currency;
    response.refundPolicyText = paymentCtx.refundPolicyText;
    response.canRequestRefund = paymentCtx.canRequestRefund;
    response.refundableAmount = paymentCtx.refundableAmount;
    response.refundRequest = paymentCtx.refundRequest;

    let teleconsultationForMeeting = teleconsultation;

    const paymentApprovedForFinalize =
      paymentCtx.paymentRequired && paymentCtx.paymentStatus === 'approved';
    const needsPostPaymentFinalize =
      teleconsultation.consentSigned &&
      paymentApprovedForFinalize &&
      !teleconsultationForMeeting.meetingUrl;

    if (needsPostPaymentFinalize) {
      try {
        await finalizeTeleconsultationAfterPayment(appointment.id);
        const refreshed = await prisma.teleconsultation.findUnique({
          where: { appointmentId: appointment.id },
        });
        if (refreshed) teleconsultationForMeeting = refreshed;
      } catch (finalizeErr) {
        securityLogger.error('Error finalizando teleconsulta tras pago aprobado:', finalizeErr);
      }
    }

    if (teleconsultation.consentSigned) {
      const canShowMeeting =
        !paymentCtx.paymentRequired || paymentCtx.paymentStatus === 'approved';
      if (canShowMeeting && teleconsultationForMeeting?.meetingUrl) {
        response.meetingUrl = teleconsultationForMeeting.meetingUrl;
      }
      if (paymentCtx.paymentRequired && paymentCtx.paymentStatus === 'pending') {
        const forceRefresh =
          req.query.refreshCheckout === '1' || req.query.refreshCheckout === 'true';
        try {
          response.checkoutUrl = forceRefresh
            ? await ensureTeleconsultationCheckoutUrl(appointment.id, token, { forceNew: true })
            : paymentCtx.checkoutUrl ||
              (await ensureTeleconsultationCheckoutUrl(appointment.id, token));
        } catch (checkoutErr) {
          securityLogger.error('Error al asegurar checkout MP en info teleconsulta:', checkoutErr);
          response.paymentError =
            'No se pudo generar el enlace de pago. Pulsa «Reintentar enlace de pago» o contacta al consultorio.';
        }
      }
    }

    res.json(response);
  } catch (error) {
    securityLogger.error('Error en getTeleconsultationInfoByToken:', error);
    res.status(500).json({ error: 'Error al obtener información' });
  }
};

/**
 * Firmar consentimiento de teleconsulta (público, requiere token)
 */
export const signTeleconsultationConsent = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { signature } = req.body;

    if (!signature || typeof signature !== 'string' || signature.trim().length < 3) {
      return res.status(400).json({ error: 'Debes ingresar tu nombre completo (mínimo 3 caracteres)' });
    }

    const confirmationRequest = await prisma.appointmentConfirmationRequest.findUnique({
      where: { confirmationToken: token },
      include: {
        appointment: {
          include: {
            patient: { include: { user: true } },
            doctor: { include: { user: true } }
          }
        }
      }
    });

    if (!confirmationRequest) {
      return res.status(404).json({ error: 'Enlace no encontrado o expirado' });
    }

    try {
      await ensureActiveConfirmationRequest(confirmationRequest);
    } catch (tokenErr: any) {
      return res.status(tokenErr.statusCode || 400).json({
        error: tokenErr.message || 'Este enlace ha expirado',
      });
    }

    const appointment = confirmationRequest.appointment;

    if (appointment.appointmentType !== 'teleconsulta') {
      return res.status(400).json({ error: 'Esta cita no es una teleconsulta' });
    }

    const teleconsultation = await prisma.teleconsultation.findUnique({
      where: { appointmentId: appointment.id }
    });

    if (!teleconsultation) {
      return res.status(404).json({ error: 'No se encontró información de teleconsulta' });
    }

    if (teleconsultation.consentSigned) {
      const paymentCtx = await getTeleconsultationPaymentContext(appointment.doctorId, appointment.id);
      let checkoutUrlResolved: string | null = paymentCtx.checkoutUrl;
      if (paymentCtx.paymentRequired && paymentCtx.paymentStatus === 'pending') {
        try {
          checkoutUrlResolved =
            checkoutUrlResolved ||
            (await ensureTeleconsultationCheckoutUrl(appointment.id, token));
        } catch {
          checkoutUrlResolved = null;
        }
      }
      return res.json({
        success: true,
        message: 'Consentimiento ya firmado',
        meetingUrl:
          !paymentCtx.paymentRequired || paymentCtx.paymentStatus === 'approved'
            ? teleconsultation.meetingUrl
            : null,
        paymentRequired: paymentCtx.paymentRequired,
        paymentStatus: paymentCtx.paymentStatus,
        checkoutUrl: checkoutUrlResolved,
        paymentAmount: paymentCtx.amount,
        paymentCurrency: paymentCtx.currency,
        refundPolicyText: paymentCtx.refundPolicyText,
      });
    }

    const patientEmail = appointment.patient.email || appointment.patient.user?.email || '';
    const patientPhone = appointment.patient.phone || appointment.patient.user?.phone || '';
    const patientFullName = `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim()
      || signature.trim();
    const doctorFullName = `${appointment.doctor.user?.firstName || ''} ${appointment.doctor.user?.lastName || ''}`.trim();
    const doctorTimezone = (appointment.doctor as { timezone?: string | null })?.timezone ?? 'America/Mexico_City';

    const { url: pdfUrl, hash, buffer: pdfBuffer } = await TeleconsultationConsentPdfService.generateAndUpload(
      appointment.id,
      {
        patientFullName: patientFullName || signature.trim(),
        patientEmail: patientEmail || 'No especificado',
        patientPhone: patientPhone || 'No especificado',
        doctorFullName: doctorFullName || 'Profesional de salud',
        doctorTitle: appointment.doctor.professionalTitle || 'Dr.',
        appointmentDate: formatAppointmentDate(appointment.date, doctorTimezone),
        appointmentTime: formatAppointmentTime(appointment.date, doctorTimezone),
        signature: signature.trim(),
        consentIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'N/A'
      }
    );

    await prisma.teleconsultation.update({
      where: { id: teleconsultation.id },
      data: {
        consentSigned: true,
        consentPdfUrl: pdfUrl,
        consentDocumentHash: hash,
        consentSignedAt: new Date(),
        consentIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null
      }
    });

    // Firmar el consentimiento confirma la asistencia a la teleconsulta (equivale a confirmAppointment).
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: 'SCHEDULED',
        confirmationStatus: 'CONFIRMED',
        confirmedAt: new Date(),
        cancelledAt: null,
        cancellationReason: null
      }
    });

    // Marcar la solicitud de confirmación como respondida (confirmada) por el paciente.
    await prisma.appointmentConfirmationRequest.update({
      where: { id: confirmationRequest.id },
      data: {
        status: 'RESPONDED',
        patientResponse: 'CONFIRMED',
        respondedAt: new Date()
      }
    });

    let paymentCtx = await getTeleconsultationPaymentContext(appointment.doctorId, appointment.id);
    let checkoutUrl: string | null = paymentCtx.checkoutUrl;
    let paymentRequired = paymentCtx.paymentRequired;
    let paymentStatus = paymentCtx.paymentStatus;
    let finalizeResult: { finalized?: boolean; reason?: string; paymentNotRequired?: boolean } = {};

    try {
      finalizeResult = await tryFinalizeTeleconsultationAfterConsent(appointment.id);
      paymentCtx = await getTeleconsultationPaymentContext(appointment.doctorId, appointment.id);
      checkoutUrl = paymentCtx.checkoutUrl;
      paymentRequired = paymentCtx.paymentRequired;
      paymentStatus = paymentCtx.paymentStatus;
    } catch (syncErr) {
      securityLogger.error('Error sincronizando calendario tras firmar consentimiento de teleconsulta:', syncErr);
    }

    const paymentApproved =
      !paymentRequired ||
      paymentStatus === 'approved' ||
      (await isTeleconsultationPaymentApproved(appointment.id));

    if (paymentApproved) {
      checkoutUrl = null;
      if (paymentRequired) {
        paymentStatus = 'approved';
      }
    } else if (paymentRequired && paymentStatus === 'pending') {
      try {
        checkoutUrl =
          checkoutUrl || (await ensureTeleconsultationCheckoutUrl(appointment.id, token));
      } catch (prefErr) {
        securityLogger.error('Error creando preferencia MP tras consentimiento:', prefErr);
        return res.status(502).json({
          error:
            'Consentimiento firmado, pero no se pudo generar el enlace de pago. Recarga la pagina o contacta al consultorio.',
        });
      }
    }
    await prisma.teleconsultationAuditLog.create({
      data: {
        teleconsultationId: teleconsultation.id,
        action: 'CONSENT_SIGNED',
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
        metadata: { patientEmail }
      }
    });

    let teleconsultationUpdated = await prisma.teleconsultation.findUnique({
      where: { id: teleconsultation.id }
    });

    if (paymentApproved && paymentRequired && !teleconsultationUpdated?.meetingUrl) {
      try {
        await finalizeTeleconsultationAfterPayment(appointment.id);
        teleconsultationUpdated = await prisma.teleconsultation.findUnique({
          where: { id: teleconsultation.id },
        });
      } catch (finalizeErr) {
        securityLogger.error('Error finalizando teleconsulta tras pago ya aprobado:', finalizeErr);
      }
    }

    const canShowMeeting = !paymentRequired || paymentApproved;
    const meetingUrlForResponse =
      canShowMeeting ? teleconsultationUpdated?.meetingUrl ?? null : null;

    const doctorEmail =
      appointment.doctor.user?.email ||
      (
        await prisma.user.findUnique({
          where: { id: appointment.doctor.userId },
          select: { email: true }
        })
      )?.email;

    let doctorEmailSent = false;
    let patientEmailSent = false;
    let pdfAttachedToDoctorEmail = false;
    let pdfAttachedToPatientEmail = false;

    const consentDateLabel = `${formatAppointmentDate(appointment.date, doctorTimezone)} - ${formatAppointmentTime(appointment.date, doctorTimezone)}`;
    const buildConsentHtml = (extraNote?: string) => brandedEmailLayout({
      subtitle: 'Consentimiento de teleconsulta',
      bodyHtml: `
        <h2 style="color:#0f172a; margin-top:0; font-size:20px;">Consentimiento de teleconsulta firmado</h2>
        <p style="font-size:16px; color:#334155;">El paciente <strong>${patientFullName || 'Paciente'}</strong> ha firmado el consentimiento informado para la teleconsulta programada.</p>
        ${emailInfoCard(`<p style="margin:0; color:#64748b; font-size:13px;">Fecha de la cita</p>
          <p style="margin:4px 0 0 0; color:#0f172a; font-size:16px; font-weight:600;">${consentDateLabel}</p>`)}
        <p style="font-size:15px; color:#334155;">Se adjunta el PDF del consentimiento firmado con aviso de privacidad.</p>
        ${extraNote ? `<p style="color:#b45309; font-size:13px; background:#fffbeb; padding:12px 14px; border-radius:8px; border-left:4px solid #f59e0b; margin-top:18px;">${extraNote}</p>` : ''}
      `,
      footerNote: NO_REPLY_FOOTER
    });

    if (!doctorEmail || !doctorEmail.trim()) {
      securityLogger.warn(
        `Consentimiento teleconsulta firmado pero el doctor no tiene email en User (appointmentId=${appointment.id}, doctorId=${appointment.doctorId})`
      );
      await prisma.teleconsultationAuditLog.create({
        data: {
          teleconsultationId: teleconsultation.id,
          action: 'DOCTOR_EMAIL_MISSING',
          metadata: { appointmentId: appointment.id, doctorId: appointment.doctorId }
        }
      });
    } else {
      const subject = `[Qlinexa360] Consentimiento teleconsulta - ${patientFullName || 'Paciente'}`;
      const htmlContent = buildConsentHtml();
      const plainText = [
        'Consentimiento de teleconsulta firmado',
        '',
        `El paciente ${patientFullName || 'Paciente'} ha firmado el consentimiento informado para la teleconsulta programada.`,
        `Fecha de la cita: ${formatAppointmentDate(appointment.date, doctorTimezone)} - ${formatAppointmentTime(appointment.date, doctorTimezone)}`,
        '',
        'Se adjunta el PDF del consentimiento firmado con aviso de privacidad.',
        '',
        'Saludos,',
        'Qlinexa360'
      ].join('\n');

      const attachments = [
        { filename: `Consentimiento_teleconsulta_${patientFullName?.replace(/\s+/g, '_') || 'paciente'}.pdf`, content: pdfBuffer, contentType: 'application/pdf' as const }
      ];

      doctorEmailSent = await sendEmailHtmlWithTextFallback(
        doctorEmail.trim(),
        subject,
        htmlContent,
        plainText,
        fromAddresses.noReply,
        attachments
      );
      if (doctorEmailSent) {
        pdfAttachedToDoctorEmail = true;
      }

      if (!doctorEmailSent) {
        securityLogger.warn(
          `Reintentando envío de consentimiento al doctor sin adjunto (appointmentId=${appointment.id}) por posible rechazo SMTP del PDF.`
        );
        const htmlNoAttach = buildConsentHtml('Nota: el PDF no pudo adjuntarse por correo. Descárgalo desde el panel de Qlinexa360 o contacta soporte.');
        const textNoAttach = `${plainText}\n\nNota: el PDF no pudo adjuntarse por correo. Descárgalo desde el panel de Qlinexa360 o contacta soporte.`;
        doctorEmailSent = await sendEmailHtmlWithTextFallback(
          doctorEmail.trim(),
          subject,
          htmlNoAttach,
          textNoAttach,
          fromAddresses.noReply
        );
        if (!doctorEmailSent) {
          doctorEmailSent = await sendEmailHtml(
            doctorEmail.trim(),
            subject,
            htmlNoAttach,
            fromAddresses.noReply
          );
        }
      }

      if (doctorEmailSent) {
        await prisma.teleconsultationAuditLog.create({
          data: {
            teleconsultationId: teleconsultation.id,
            action: 'PDF_SENT',
            metadata: { to: doctorEmail, pdfAttached: pdfAttachedToDoctorEmail, recipientType: 'doctor' }
          }
        });
      } else {
        securityLogger.error(
          `Fallo SMTP al enviar PDF de consentimiento teleconsulta al doctor (to=${doctorEmail}, appointmentId=${appointment.id}). Revisar SMTP_HOST / credenciales y logs del servidor.`
        );
        await prisma.teleconsultationAuditLog.create({
          data: {
            teleconsultationId: teleconsultation.id,
            action: 'PDF_EMAIL_FAILED',
            metadata: { to: doctorEmail, appointmentId: appointment.id, recipientType: 'doctor' }
          }
        });
      }
    }

    // Enviar copia independiente al paciente (correo separado)
    if (!patientEmail || !patientEmail.trim()) {
      securityLogger.warn(
        `Consentimiento teleconsulta firmado pero el paciente no tiene email (appointmentId=${appointment.id}, patientId=${appointment.patientId})`
      );
      await prisma.teleconsultationAuditLog.create({
        data: {
          teleconsultationId: teleconsultation.id,
          action: 'PATIENT_EMAIL_MISSING',
          metadata: { appointmentId: appointment.id, patientId: appointment.patientId }
        }
      });
    } else {
      const patientSubject = `[Qlinexa360] Consentimiento teleconsulta - ${patientFullName || 'Paciente'}`;
      const showPaymentCta =
        paymentRequired && !paymentApproved && paymentStatus === 'pending' && checkoutUrl;
      const paymentNoteHtml = showPaymentCta
          ? `<div style="background:#eff6ff;border:2px solid #0ea5e9;border-radius:10px;padding:16px;margin:18px 0;">
              <p style="margin:0 0 8px 0;color:#0c4a6e;font-size:15px;font-weight:600;">Pago de teleconsulta</p>
              <p style="margin:0 0 12px 0;color:#0369a1;font-size:14px;">
                Monto: <strong>$${Number(paymentCtx.amount).toFixed(2)} ${paymentCtx.currency}</strong>.
                Completa el pago para recibir el enlace de videollamada en tu calendario.
              </p>
              <a href="${checkoutUrl}" style="background:#0284c7;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">
                Pagar con Mercado Pago
              </a>
            </div>`
          : paymentRequired && paymentStatus === 'approved'
            ? `<p style="color:#166534;font-size:14px;background:#ecfdf5;padding:12px 14px;border-radius:8px;border-left:4px solid #22c55e;margin:18px 0;">
                Tu pago de teleconsulta ya está confirmado. El enlace de videollamada está disponible en tu calendario y en Mis citas.
              </p>`
          : '';
      const patientHtmlContent = buildConsentHtml() + paymentNoteHtml;
      const patientPlainText = [
        'Consentimiento de teleconsulta firmado',
        '',
        `El paciente ${patientFullName || 'Paciente'} ha firmado el consentimiento informado para la teleconsulta programada.`,
        `Fecha de la cita: ${formatAppointmentDate(appointment.date, doctorTimezone)} - ${formatAppointmentTime(appointment.date, doctorTimezone)}`,
        '',
        showPaymentCta
          ? `Pago pendiente: $${Number(paymentCtx.amount).toFixed(2)} ${paymentCtx.currency}. Enlace: ${checkoutUrl}`
          : paymentRequired && paymentStatus === 'approved'
            ? 'Pago de teleconsulta confirmado.'
          : '',
        'Se adjunta el PDF del consentimiento firmado con aviso de privacidad.',
        '',
        'Saludos,',
        'Qlinexa360'
      ]
        .filter(Boolean)
        .join('\n');
      const patientAttachments = [
        { filename: `Consentimiento_teleconsulta_${patientFullName?.replace(/\s+/g, '_') || 'paciente'}.pdf`, content: pdfBuffer, contentType: 'application/pdf' as const }
      ];

      patientEmailSent = await sendEmailHtmlWithTextFallback(
        patientEmail.trim(),
        patientSubject,
        patientHtmlContent,
        patientPlainText,
        fromAddresses.noReply,
        patientAttachments
      );
      if (patientEmailSent) {
        pdfAttachedToPatientEmail = true;
      }

      if (!patientEmailSent) {
        const patientHtmlNoAttach = buildConsentHtml('Nota: el PDF no pudo adjuntarse por correo. Solicita tu copia al profesional de salud o a soporte.');
        const patientTextNoAttach = `${patientPlainText}\n\nNota: el PDF no pudo adjuntarse por correo. Solicita tu copia al profesional de salud o a soporte.`;
        patientEmailSent = await sendEmailHtmlWithTextFallback(
          patientEmail.trim(),
          patientSubject,
          patientHtmlNoAttach,
          patientTextNoAttach,
          fromAddresses.noReply
        );
        if (!patientEmailSent) {
          patientEmailSent = await sendEmailHtml(
            patientEmail.trim(),
            patientSubject,
            patientHtmlNoAttach,
            fromAddresses.noReply
          );
        }
      }

      if (patientEmailSent) {
        await prisma.teleconsultationAuditLog.create({
          data: {
            teleconsultationId: teleconsultation.id,
            action: 'PDF_SENT',
            metadata: { to: patientEmail, pdfAttached: pdfAttachedToPatientEmail, recipientType: 'patient' }
          }
        });
      } else {
        await prisma.teleconsultationAuditLog.create({
          data: {
            teleconsultationId: teleconsultation.id,
            action: 'PDF_EMAIL_FAILED',
            metadata: { to: patientEmail, appointmentId: appointment.id, recipientType: 'patient' }
          }
        });
      }
    }

    res.json({
      success: true,
      message:
        paymentRequired && paymentStatus === 'pending'
          ? 'Consentimiento firmado. Completa el pago para recibir el enlace de videollamada.'
          : paymentRequired && paymentStatus === 'approved'
            ? 'Consentimiento firmado y pago confirmado. El enlace de videollamada ya está disponible.'
          : !doctorEmail || !doctorEmail.trim()
            ? 'Consentimiento firmado correctamente. No hay correo registrado para el profesional; el PDF quedó guardado en el sistema.'
            : doctorEmailSent
              ? pdfAttachedToDoctorEmail
                ? 'Consentimiento firmado correctamente. El profesional de salud ha recibido el correo con el PDF adjunto.'
                : 'Consentimiento firmado correctamente. El profesional recibió un aviso por correo; el PDF no pudo adjuntarse (revisa bandeja o configuración SMTP).'
              : 'Consentimiento firmado correctamente. No se pudo enviar el correo al profesional; el PDF quedó registrado en el sistema. Revisa SMTP en el servidor.',
      doctorEmailSent,
      patientEmailSent,
      meetingUrl: meetingUrlForResponse,
      paymentRequired,
      paymentStatus,
      checkoutUrl,
      paymentAmount: paymentCtx.amount,
      paymentCurrency: paymentCtx.currency,
      refundPolicyText: paymentCtx.refundPolicyText,
    });
  } catch (error) {
    securityLogger.error('Error en signTeleconsultationConsent:', error);
    res.status(500).json({ error: 'Error al firmar el consentimiento' });
  }
};

export const getTeleconsultationRefundContext = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const data = await getRefundRequestByToken(token);
    return res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof RefundRequestError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    securityLogger.error('getTeleconsultationRefundContext failed', error);
    return res.status(500).json({ error: 'Error al obtener solicitud de reembolso' });
  }
};

export const createTeleconsultationRefundRequest = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { reason, requestedAmount } = req.body || {};
    const data = await createRefundRequestByToken(token, { reason, requestedAmount });
    return res.json({ success: true, data });
  } catch (error) {
    if (error instanceof RefundRequestError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    securityLogger.error('createTeleconsultationRefundRequest failed', error);
    return res.status(500).json({ error: 'Error al solicitar reembolso' });
  }
};
