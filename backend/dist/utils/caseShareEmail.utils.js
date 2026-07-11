"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCaseSharePatientConsentRequest = sendCaseSharePatientConsentRequest;
exports.sendCaseShareDoctorsPendingNotice = sendCaseShareDoctorsPendingNotice;
exports.sendCaseShareSignedWithPdf = sendCaseShareSignedWithPdf;
exports.sendCaseShareSignedCopyToPatient = sendCaseShareSignedCopyToPatient;
const email_utils_1 = require("./email.utils");
const logger_utils_1 = require("./logger.utils");
const brand = 'Qlinexa360';
const siteUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const publicSite = 'https://www.qlinexa360.com';
const CASE_SHARE_SIGNED_SUBJECT = `[${brand}] Consentimiento firmado — colaboración en caso clínico`;
function consentLinkPath(token) {
    return `${siteUrl.replace(/\/$/, '')}/compartir-caso-clinico/${token}`;
}
async function sendCaseSharePatientConsentRequest(params) {
    const link = consentLinkPath(params.token);
    const exp = params.expiresAt.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
    const subject = `[${brand}] Autorizar colaboración en tu caso clínico`;
    const html = (0, email_utils_1.brandedEmailLayout)({
        subtitle: 'Autorización de colaboración',
        bodyHtml: `
      <h2 style="color:#0f172a; margin-top:0; font-size:20px;">Hola ${params.patientFirstName},</h2>
      <p style="font-size:16px; color:#334155;"><strong style="color:#2563eb;">${params.ownerDoctorName}</strong> ha solicitado que <strong>${params.invitedDoctorName}</strong> pueda colaborar <strong>únicamente</strong> en el caso clínico: <em>${params.caseLabel}</em>.</p>
      <p style="font-size:15px; color:#334155;">Para continuar, revisa y firma el consentimiento informado (aviso de privacidad) con el siguiente botón. Sin tu firma, el profesional invitado <strong>no</strong> tendrá acceso a este caso.</p>
      ${(0, email_utils_1.emailButton)('Revisar y firmar', link)}
      ${(0, email_utils_1.emailInfoCard)(`<p style="margin:0; color:#92400e; font-size:13px;">⏳ Este enlace vence el <strong>${exp}</strong>.</p>`, '#f59e0b', '#fffbeb')}
      <p style="font-size:12px; color:#94a3b8; text-align:center; margin:0;">${publicSite}</p>
    `,
        footerNote: email_utils_1.NO_REPLY_FOOTER
    });
    const ok = await (0, email_utils_1.sendEmailHtml)(params.to, subject, html, email_utils_1.fromAddresses.noReply);
    if (!ok)
        logger_utils_1.securityLogger.error(`case share: no se envió correo a paciente ${params.to}`);
    return ok;
}
async function sendCaseShareDoctorsPendingNotice(params) {
    const link = consentLinkPath(params.token);
    const block = (who) => `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
    <h2 style="color:#2563eb;">${brand}</h2>
    <p>Hola <strong>${who}</strong>,</p>
    <p>Se ha enviado al paciente <strong>${params.patientName}</strong> un enlace para autorizar la colaboración de <strong>${params.invitedDoctorName}</strong> en el caso <em>${params.caseLabel}</em> (solicitado por ${params.ownerDoctorName}).</p>
    <p>El acceso del profesional invitado quedará activo <strong>únicamente después</strong> de que el paciente firme el consentimiento.</p>
    <p style="font-size:12px;color:#6b7280;">Enlace enviado al paciente (referencia):<br><a href="${link}">${link}</a></p>
    <p style="font-size:12px;">${publicSite}</p>
  </body></html>`;
    await (0, email_utils_1.sendEmailHtml)(params.ownerEmail, `[${brand}] Colaboración pendiente de firma del paciente`, block(params.ownerDoctorName), email_utils_1.fromAddresses.noReply);
    await (0, email_utils_1.sendEmailHtml)(params.invitedEmail, `[${brand}] Esperando autorización del paciente`, block(params.invitedDoctorName), email_utils_1.fromAddresses.noReply);
}
async function sendCaseShareSignedWithPdf(params) {
    const subject = CASE_SHARE_SIGNED_SUBJECT;
    const hasPdf = Boolean(params.pdfBuffer && params.pdfBuffer.length > 0);
    const bodyP = hasPdf
        ? `El paciente <strong>${params.patientName}</strong> firmó el consentimiento para el caso <em>${params.caseLabel}</em>. Se adjunta el PDF.`
        : `El paciente <strong>${params.patientName}</strong> firmó el consentimiento para el caso <em>${params.caseLabel}</em>. El acceso quedó habilitado en la plataforma.`;
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;">
    <p>Hola <strong>${params.doctorLabel}</strong>,</p>
    <p>${bodyP}</p>
    <p style="font-size:12px;color:#6b7280;">${publicSite}</p>
  </body></html>`;
    if (hasPdf && params.pdfBuffer) {
        return (0, email_utils_1.sendEmailHtml)(params.to, subject, html, email_utils_1.fromAddresses.noReply, [
            {
                filename: `consentimiento_colaboracion_${params.caseLabel.replace(/\s+/g, '_')}.pdf`,
                content: params.pdfBuffer,
                contentType: 'application/pdf'
            }
        ]);
    }
    return (0, email_utils_1.sendEmailHtml)(params.to, subject, html, email_utils_1.fromAddresses.noReply);
}
async function sendCaseShareSignedCopyToPatient(params) {
    const subject = CASE_SHARE_SIGNED_SUBJECT;
    const hasPdf = Boolean(params.pdfBuffer && params.pdfBuffer.length > 0);
    const bodyP = hasPdf
        ? `Firmaste el consentimiento para autorizar colaboración en el caso clínico <em>${params.caseLabel}</em>. Se adjunta el PDF firmado.`
        : `Firmaste el consentimiento para autorizar colaboración en el caso clínico <em>${params.caseLabel}</em>. El acceso quedó habilitado en la plataforma.`;
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;">
    <p>Hola <strong>${params.patientName}</strong>,</p>
    <p>${bodyP}</p>
    <p><strong>Profesional titular:</strong> ${params.ownerDoctorName}</p>
    <p><strong>Profesional invitado:</strong> ${params.invitedDoctorName}</p>
    <p style="font-size:12px;color:#6b7280;">${publicSite}</p>
  </body></html>`;
    if (hasPdf && params.pdfBuffer) {
        return (0, email_utils_1.sendEmailHtml)(params.to, subject, html, email_utils_1.fromAddresses.noReply, [
            {
                filename: `consentimiento_colaboracion_${params.caseLabel.replace(/\s+/g, '_')}.pdf`,
                content: params.pdfBuffer,
                contentType: 'application/pdf'
            }
        ]);
    }
    return (0, email_utils_1.sendEmailHtml)(params.to, subject, html, email_utils_1.fromAddresses.noReply);
}
