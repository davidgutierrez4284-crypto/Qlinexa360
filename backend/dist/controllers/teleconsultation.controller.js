"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTeleconsultationRefundRequest = exports.getTeleconsultationRefundContext = exports.signTeleconsultationConsent = exports.getTeleconsultationInfoByToken = void 0;
const client_1 = require("@prisma/client");
const date_utils_1 = require("../utils/date.utils");
const teleconsultationConsentPdf_service_1 = require("../services/teleconsultationConsentPdf.service");
const email_utils_1 = require("../utils/email.utils");
const logger_utils_1 = require("../utils/logger.utils");
const appointmentConfirmation_utils_1 = require("../utils/appointmentConfirmation.utils");
const mercadopago_teleconsultation_service_1 = require("../payments/mercadopago/mercadopago.teleconsultation.service");
const mercadopago_refund_service_1 = require("../payments/mercadopago/mercadopago.refund.service");
const prisma = new client_1.PrismaClient();
/**
 * Obtener información de teleconsulta por token (público)
 * El meetingUrl solo se devuelve si consentSigned === true
 */
const getTeleconsultationInfoByToken = async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
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
            await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
        }
        catch (tokenErr) {
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
        const doctorTimezone = (_b = (_a = appointment.doctor) === null || _a === void 0 ? void 0 : _a.timezone) !== null && _b !== void 0 ? _b : 'America/Mexico_City';
        const patientName = `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim()
            || `${((_c = appointment.patient.user) === null || _c === void 0 ? void 0 : _c.firstName) || ''} ${((_d = appointment.patient.user) === null || _d === void 0 ? void 0 : _d.lastName) || ''}`.trim();
        const doctorName = `${((_e = appointment.doctor.user) === null || _e === void 0 ? void 0 : _e.firstName) || ''} ${((_f = appointment.doctor.user) === null || _f === void 0 ? void 0 : _f.lastName) || ''}`.trim();
        const response = {
            success: true,
            appointmentId: appointment.id,
            patientName,
            doctorName: `${appointment.doctor.professionalTitle || ''} ${doctorName}`.trim(),
            appointmentDate: (0, date_utils_1.formatAppointmentDate)(appointment.date, doctorTimezone),
            appointmentTime: (0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone),
            consentSigned: teleconsultation.consentSigned
        };
        const paymentCtx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(appointment.doctorId, appointment.id);
        response.paymentRequired = paymentCtx.paymentRequired;
        response.paymentStatus = paymentCtx.paymentStatus;
        response.paymentAmount = paymentCtx.amount;
        response.paymentCurrency = paymentCtx.currency;
        response.refundPolicyText = paymentCtx.refundPolicyText;
        response.canRequestRefund = paymentCtx.canRequestRefund;
        response.refundableAmount = paymentCtx.refundableAmount;
        response.refundRequest = paymentCtx.refundRequest;
        let teleconsultationForMeeting = teleconsultation;
        const paymentApprovedForFinalize = paymentCtx.paymentRequired && paymentCtx.paymentStatus === 'approved';
        const needsPostPaymentFinalize = teleconsultation.consentSigned &&
            paymentApprovedForFinalize &&
            !teleconsultationForMeeting.meetingUrl;
        if (needsPostPaymentFinalize) {
            try {
                await (0, mercadopago_teleconsultation_service_1.finalizeTeleconsultationAfterPayment)(appointment.id);
                const refreshed = await prisma.teleconsultation.findUnique({
                    where: { appointmentId: appointment.id },
                });
                if (refreshed)
                    teleconsultationForMeeting = refreshed;
            }
            catch (finalizeErr) {
                logger_utils_1.securityLogger.error('Error finalizando teleconsulta tras pago aprobado:', finalizeErr);
            }
        }
        if (teleconsultation.consentSigned) {
            const canShowMeeting = !paymentCtx.paymentRequired || paymentCtx.paymentStatus === 'approved';
            if (canShowMeeting && (teleconsultationForMeeting === null || teleconsultationForMeeting === void 0 ? void 0 : teleconsultationForMeeting.meetingUrl)) {
                response.meetingUrl = teleconsultationForMeeting.meetingUrl;
            }
            if (paymentCtx.paymentRequired && paymentCtx.paymentStatus === 'pending') {
                const forceRefresh = req.query.refreshCheckout === '1' || req.query.refreshCheckout === 'true';
                try {
                    response.checkoutUrl = forceRefresh
                        ? await (0, mercadopago_teleconsultation_service_1.ensureTeleconsultationCheckoutUrl)(appointment.id, token, { forceNew: true })
                        : paymentCtx.checkoutUrl ||
                            (await (0, mercadopago_teleconsultation_service_1.ensureTeleconsultationCheckoutUrl)(appointment.id, token));
                }
                catch (checkoutErr) {
                    logger_utils_1.securityLogger.error('Error al asegurar checkout MP en info teleconsulta:', checkoutErr);
                    response.paymentError =
                        'No se pudo generar el enlace de pago. Pulsa «Reintentar enlace de pago» o contacta al consultorio.';
                }
            }
        }
        res.json(response);
    }
    catch (error) {
        logger_utils_1.securityLogger.error('Error en getTeleconsultationInfoByToken:', error);
        res.status(500).json({ error: 'Error al obtener información' });
    }
};
exports.getTeleconsultationInfoByToken = getTeleconsultationInfoByToken;
/**
 * Firmar consentimiento de teleconsulta (público, requiere token)
 */
const signTeleconsultationConsent = async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
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
            await (0, appointmentConfirmation_utils_1.ensureActiveConfirmationRequest)(confirmationRequest);
        }
        catch (tokenErr) {
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
            const paymentCtx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(appointment.doctorId, appointment.id);
            let checkoutUrlResolved = paymentCtx.checkoutUrl;
            if (paymentCtx.paymentRequired && paymentCtx.paymentStatus === 'pending') {
                try {
                    checkoutUrlResolved =
                        checkoutUrlResolved ||
                            (await (0, mercadopago_teleconsultation_service_1.ensureTeleconsultationCheckoutUrl)(appointment.id, token));
                }
                catch (_r) {
                    checkoutUrlResolved = null;
                }
            }
            return res.json({
                success: true,
                message: 'Consentimiento ya firmado',
                meetingUrl: !paymentCtx.paymentRequired || paymentCtx.paymentStatus === 'approved'
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
        const patientEmail = appointment.patient.email || ((_a = appointment.patient.user) === null || _a === void 0 ? void 0 : _a.email) || '';
        const patientPhone = appointment.patient.phone || ((_b = appointment.patient.user) === null || _b === void 0 ? void 0 : _b.phone) || '';
        const patientFullName = `${appointment.patient.firstName || ''} ${appointment.patient.lastName || ''}`.trim()
            || signature.trim();
        const doctorFullName = `${((_c = appointment.doctor.user) === null || _c === void 0 ? void 0 : _c.firstName) || ''} ${((_d = appointment.doctor.user) === null || _d === void 0 ? void 0 : _d.lastName) || ''}`.trim();
        const doctorTimezone = (_f = (_e = appointment.doctor) === null || _e === void 0 ? void 0 : _e.timezone) !== null && _f !== void 0 ? _f : 'America/Mexico_City';
        const { url: pdfUrl, hash, buffer: pdfBuffer } = await teleconsultationConsentPdf_service_1.TeleconsultationConsentPdfService.generateAndUpload(appointment.id, {
            patientFullName: patientFullName || signature.trim(),
            patientEmail: patientEmail || 'No especificado',
            patientPhone: patientPhone || 'No especificado',
            doctorFullName: doctorFullName || 'Profesional de salud',
            doctorTitle: appointment.doctor.professionalTitle || 'Dr.',
            appointmentDate: (0, date_utils_1.formatAppointmentDate)(appointment.date, doctorTimezone),
            appointmentTime: (0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone),
            signature: signature.trim(),
            consentIp: ((_h = (_g = req.headers['x-forwarded-for']) === null || _g === void 0 ? void 0 : _g.split(',')[0]) === null || _h === void 0 ? void 0 : _h.trim()) || req.socket.remoteAddress || 'N/A'
        });
        await prisma.teleconsultation.update({
            where: { id: teleconsultation.id },
            data: {
                consentSigned: true,
                consentPdfUrl: pdfUrl,
                consentDocumentHash: hash,
                consentSignedAt: new Date(),
                consentIp: ((_k = (_j = req.headers['x-forwarded-for']) === null || _j === void 0 ? void 0 : _j.split(',')[0]) === null || _k === void 0 ? void 0 : _k.trim()) || req.socket.remoteAddress || null
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
        let paymentCtx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(appointment.doctorId, appointment.id);
        let checkoutUrl = paymentCtx.checkoutUrl;
        let paymentRequired = paymentCtx.paymentRequired;
        let paymentStatus = paymentCtx.paymentStatus;
        let finalizeResult = {};
        try {
            finalizeResult = await (0, mercadopago_teleconsultation_service_1.tryFinalizeTeleconsultationAfterConsent)(appointment.id);
            paymentCtx = await (0, mercadopago_teleconsultation_service_1.getTeleconsultationPaymentContext)(appointment.doctorId, appointment.id);
            checkoutUrl = paymentCtx.checkoutUrl;
            paymentRequired = paymentCtx.paymentRequired;
            paymentStatus = paymentCtx.paymentStatus;
        }
        catch (syncErr) {
            logger_utils_1.securityLogger.error('Error sincronizando calendario tras firmar consentimiento de teleconsulta:', syncErr);
        }
        const paymentApproved = !paymentRequired ||
            paymentStatus === 'approved' ||
            (await (0, mercadopago_teleconsultation_service_1.isTeleconsultationPaymentApproved)(appointment.id));
        if (paymentApproved) {
            checkoutUrl = null;
            if (paymentRequired) {
                paymentStatus = 'approved';
            }
        }
        else if (paymentRequired && paymentStatus === 'pending') {
            try {
                checkoutUrl =
                    checkoutUrl || (await (0, mercadopago_teleconsultation_service_1.ensureTeleconsultationCheckoutUrl)(appointment.id, token));
            }
            catch (prefErr) {
                logger_utils_1.securityLogger.error('Error creando preferencia MP tras consentimiento:', prefErr);
                return res.status(502).json({
                    error: 'Consentimiento firmado, pero no se pudo generar el enlace de pago. Recarga la pagina o contacta al consultorio.',
                });
            }
        }
        await prisma.teleconsultationAuditLog.create({
            data: {
                teleconsultationId: teleconsultation.id,
                action: 'CONSENT_SIGNED',
                ip: ((_m = (_l = req.headers['x-forwarded-for']) === null || _l === void 0 ? void 0 : _l.split(',')[0]) === null || _m === void 0 ? void 0 : _m.trim()) || req.socket.remoteAddress || null,
                userAgent: req.headers['user-agent'] || null,
                metadata: { patientEmail }
            }
        });
        let teleconsultationUpdated = await prisma.teleconsultation.findUnique({
            where: { id: teleconsultation.id }
        });
        if (paymentApproved && paymentRequired && !(teleconsultationUpdated === null || teleconsultationUpdated === void 0 ? void 0 : teleconsultationUpdated.meetingUrl)) {
            try {
                await (0, mercadopago_teleconsultation_service_1.finalizeTeleconsultationAfterPayment)(appointment.id);
                teleconsultationUpdated = await prisma.teleconsultation.findUnique({
                    where: { id: teleconsultation.id },
                });
            }
            catch (finalizeErr) {
                logger_utils_1.securityLogger.error('Error finalizando teleconsulta tras pago ya aprobado:', finalizeErr);
            }
        }
        const canShowMeeting = !paymentRequired || paymentApproved;
        const meetingUrlForResponse = canShowMeeting ? (_o = teleconsultationUpdated === null || teleconsultationUpdated === void 0 ? void 0 : teleconsultationUpdated.meetingUrl) !== null && _o !== void 0 ? _o : null : null;
        const doctorEmail = ((_p = appointment.doctor.user) === null || _p === void 0 ? void 0 : _p.email) ||
            ((_q = (await prisma.user.findUnique({
                where: { id: appointment.doctor.userId },
                select: { email: true }
            }))) === null || _q === void 0 ? void 0 : _q.email);
        let doctorEmailSent = false;
        let patientEmailSent = false;
        let pdfAttachedToDoctorEmail = false;
        let pdfAttachedToPatientEmail = false;
        const consentDateLabel = `${(0, date_utils_1.formatAppointmentDate)(appointment.date, doctorTimezone)} - ${(0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone)}`;
        const buildConsentHtml = (extraNote) => (0, email_utils_1.brandedEmailLayout)({
            subtitle: 'Consentimiento de teleconsulta',
            bodyHtml: `
        <h2 style="color:#0f172a; margin-top:0; font-size:20px;">Consentimiento de teleconsulta firmado</h2>
        <p style="font-size:16px; color:#334155;">El paciente <strong>${patientFullName || 'Paciente'}</strong> ha firmado el consentimiento informado para la teleconsulta programada.</p>
        ${(0, email_utils_1.emailInfoCard)(`<p style="margin:0; color:#64748b; font-size:13px;">Fecha de la cita</p>
          <p style="margin:4px 0 0 0; color:#0f172a; font-size:16px; font-weight:600;">${consentDateLabel}</p>`)}
        <p style="font-size:15px; color:#334155;">Se adjunta el PDF del consentimiento firmado con aviso de privacidad.</p>
        ${extraNote ? `<p style="color:#b45309; font-size:13px; background:#fffbeb; padding:12px 14px; border-radius:8px; border-left:4px solid #f59e0b; margin-top:18px;">${extraNote}</p>` : ''}
      `,
            footerNote: email_utils_1.NO_REPLY_FOOTER
        });
        if (!doctorEmail || !doctorEmail.trim()) {
            logger_utils_1.securityLogger.warn(`Consentimiento teleconsulta firmado pero el doctor no tiene email en User (appointmentId=${appointment.id}, doctorId=${appointment.doctorId})`);
            await prisma.teleconsultationAuditLog.create({
                data: {
                    teleconsultationId: teleconsultation.id,
                    action: 'DOCTOR_EMAIL_MISSING',
                    metadata: { appointmentId: appointment.id, doctorId: appointment.doctorId }
                }
            });
        }
        else {
            const subject = `[Qlinexa360] Consentimiento teleconsulta - ${patientFullName || 'Paciente'}`;
            const htmlContent = buildConsentHtml();
            const plainText = [
                'Consentimiento de teleconsulta firmado',
                '',
                `El paciente ${patientFullName || 'Paciente'} ha firmado el consentimiento informado para la teleconsulta programada.`,
                `Fecha de la cita: ${(0, date_utils_1.formatAppointmentDate)(appointment.date, doctorTimezone)} - ${(0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone)}`,
                '',
                'Se adjunta el PDF del consentimiento firmado con aviso de privacidad.',
                '',
                'Saludos,',
                'Qlinexa360'
            ].join('\n');
            const attachments = [
                { filename: `Consentimiento_teleconsulta_${(patientFullName === null || patientFullName === void 0 ? void 0 : patientFullName.replace(/\s+/g, '_')) || 'paciente'}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }
            ];
            doctorEmailSent = await (0, email_utils_1.sendEmailHtmlWithTextFallback)(doctorEmail.trim(), subject, htmlContent, plainText, email_utils_1.fromAddresses.noReply, attachments);
            if (doctorEmailSent) {
                pdfAttachedToDoctorEmail = true;
            }
            if (!doctorEmailSent) {
                logger_utils_1.securityLogger.warn(`Reintentando envío de consentimiento al doctor sin adjunto (appointmentId=${appointment.id}) por posible rechazo SMTP del PDF.`);
                const htmlNoAttach = buildConsentHtml('Nota: el PDF no pudo adjuntarse por correo. Descárgalo desde el panel de Qlinexa360 o contacta soporte.');
                const textNoAttach = `${plainText}\n\nNota: el PDF no pudo adjuntarse por correo. Descárgalo desde el panel de Qlinexa360 o contacta soporte.`;
                doctorEmailSent = await (0, email_utils_1.sendEmailHtmlWithTextFallback)(doctorEmail.trim(), subject, htmlNoAttach, textNoAttach, email_utils_1.fromAddresses.noReply);
                if (!doctorEmailSent) {
                    doctorEmailSent = await (0, email_utils_1.sendEmailHtml)(doctorEmail.trim(), subject, htmlNoAttach, email_utils_1.fromAddresses.noReply);
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
            }
            else {
                logger_utils_1.securityLogger.error(`Fallo SMTP al enviar PDF de consentimiento teleconsulta al doctor (to=${doctorEmail}, appointmentId=${appointment.id}). Revisar SMTP_HOST / credenciales y logs del servidor.`);
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
            logger_utils_1.securityLogger.warn(`Consentimiento teleconsulta firmado pero el paciente no tiene email (appointmentId=${appointment.id}, patientId=${appointment.patientId})`);
            await prisma.teleconsultationAuditLog.create({
                data: {
                    teleconsultationId: teleconsultation.id,
                    action: 'PATIENT_EMAIL_MISSING',
                    metadata: { appointmentId: appointment.id, patientId: appointment.patientId }
                }
            });
        }
        else {
            const patientSubject = `[Qlinexa360] Consentimiento teleconsulta - ${patientFullName || 'Paciente'}`;
            const showPaymentCta = paymentRequired && !paymentApproved && paymentStatus === 'pending' && checkoutUrl;
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
                `Fecha de la cita: ${(0, date_utils_1.formatAppointmentDate)(appointment.date, doctorTimezone)} - ${(0, date_utils_1.formatAppointmentTime)(appointment.date, doctorTimezone)}`,
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
                { filename: `Consentimiento_teleconsulta_${(patientFullName === null || patientFullName === void 0 ? void 0 : patientFullName.replace(/\s+/g, '_')) || 'paciente'}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }
            ];
            patientEmailSent = await (0, email_utils_1.sendEmailHtmlWithTextFallback)(patientEmail.trim(), patientSubject, patientHtmlContent, patientPlainText, email_utils_1.fromAddresses.noReply, patientAttachments);
            if (patientEmailSent) {
                pdfAttachedToPatientEmail = true;
            }
            if (!patientEmailSent) {
                const patientHtmlNoAttach = buildConsentHtml('Nota: el PDF no pudo adjuntarse por correo. Solicita tu copia al profesional de salud o a soporte.');
                const patientTextNoAttach = `${patientPlainText}\n\nNota: el PDF no pudo adjuntarse por correo. Solicita tu copia al profesional de salud o a soporte.`;
                patientEmailSent = await (0, email_utils_1.sendEmailHtmlWithTextFallback)(patientEmail.trim(), patientSubject, patientHtmlNoAttach, patientTextNoAttach, email_utils_1.fromAddresses.noReply);
                if (!patientEmailSent) {
                    patientEmailSent = await (0, email_utils_1.sendEmailHtml)(patientEmail.trim(), patientSubject, patientHtmlNoAttach, email_utils_1.fromAddresses.noReply);
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
            }
            else {
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
            message: paymentRequired && paymentStatus === 'pending'
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
    }
    catch (error) {
        logger_utils_1.securityLogger.error('Error en signTeleconsultationConsent:', error);
        res.status(500).json({ error: 'Error al firmar el consentimiento' });
    }
};
exports.signTeleconsultationConsent = signTeleconsultationConsent;
const getTeleconsultationRefundContext = async (req, res) => {
    try {
        const { token } = req.params;
        const data = await (0, mercadopago_refund_service_1.getRefundRequestByToken)(token);
        return res.json(Object.assign({ success: true }, data));
    }
    catch (error) {
        if (error instanceof mercadopago_refund_service_1.RefundRequestError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        logger_utils_1.securityLogger.error('getTeleconsultationRefundContext failed', error);
        return res.status(500).json({ error: 'Error al obtener solicitud de reembolso' });
    }
};
exports.getTeleconsultationRefundContext = getTeleconsultationRefundContext;
const createTeleconsultationRefundRequest = async (req, res) => {
    try {
        const { token } = req.params;
        const { reason, requestedAmount } = req.body || {};
        const data = await (0, mercadopago_refund_service_1.createRefundRequestByToken)(token, { reason, requestedAmount });
        return res.json({ success: true, data });
    }
    catch (error) {
        if (error instanceof mercadopago_refund_service_1.RefundRequestError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        logger_utils_1.securityLogger.error('createTeleconsultationRefundRequest failed', error);
        return res.status(500).json({ error: 'Error al solicitar reembolso' });
    }
};
exports.createTeleconsultationRefundRequest = createTeleconsultationRefundRequest;
