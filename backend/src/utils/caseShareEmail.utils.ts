import { sendEmailHtml, fromAddresses, brandedEmailLayout, emailButton, emailInfoCard, NO_REPLY_FOOTER } from './email.utils';
import { securityLogger } from './logger.utils';

const brand = 'Qlinexa360';
const siteUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const publicSite = 'https://www.qlinexa360.com';
const CASE_SHARE_SIGNED_SUBJECT = `[${brand}] Consentimiento firmado — colaboración en caso clínico`;

function consentLinkPath(token: string) {
  return `${siteUrl.replace(/\/$/, '')}/compartir-caso-clinico/${token}`;
}

export async function sendCaseSharePatientConsentRequest(params: {
  to: string;
  patientFirstName: string;
  caseLabel: string;
  ownerDoctorName: string;
  invitedDoctorName: string;
  token: string;
  expiresAt: Date;
}): Promise<boolean> {
  const link = consentLinkPath(params.token);
  const exp = params.expiresAt.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  const subject = `[${brand}] Autorizar colaboración en tu caso clínico`;
  const html = brandedEmailLayout({
    subtitle: 'Autorización de colaboración',
    bodyHtml: `
      <h2 style="color:#0f172a; margin-top:0; font-size:20px;">Hola ${params.patientFirstName},</h2>
      <p style="font-size:16px; color:#334155;"><strong style="color:#2563eb;">${params.ownerDoctorName}</strong> ha solicitado que <strong>${params.invitedDoctorName}</strong> pueda colaborar <strong>únicamente</strong> en el caso clínico: <em>${params.caseLabel}</em>.</p>
      <p style="font-size:15px; color:#334155;">Para continuar, revisa y firma el consentimiento informado (aviso de privacidad) con el siguiente botón. Sin tu firma, el profesional invitado <strong>no</strong> tendrá acceso a este caso.</p>
      ${emailButton('Revisar y firmar', link)}
      ${emailInfoCard(`<p style="margin:0; color:#92400e; font-size:13px;">⏳ Este enlace vence el <strong>${exp}</strong>.</p>`, '#f59e0b', '#fffbeb')}
      <p style="font-size:12px; color:#94a3b8; text-align:center; margin:0;">${publicSite}</p>
    `,
    footerNote: NO_REPLY_FOOTER
  });
  const ok = await sendEmailHtml(params.to, subject, html, fromAddresses.noReply);
  if (!ok) securityLogger.error(`case share: no se envió correo a paciente ${params.to}`);
  return ok;
}

export async function sendCaseShareDoctorsPendingNotice(params: {
  ownerEmail: string;
  invitedEmail: string;
  ownerDoctorName: string;
  invitedDoctorName: string;
  patientName: string;
  caseLabel: string;
  token: string;
}): Promise<void> {
  const link = consentLinkPath(params.token);
  const block = (who: string) => `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;">
    <h2 style="color:#2563eb;">${brand}</h2>
    <p>Hola <strong>${who}</strong>,</p>
    <p>Se ha enviado al paciente <strong>${params.patientName}</strong> un enlace para autorizar la colaboración de <strong>${params.invitedDoctorName}</strong> en el caso <em>${params.caseLabel}</em> (solicitado por ${params.ownerDoctorName}).</p>
    <p>El acceso del profesional invitado quedará activo <strong>únicamente después</strong> de que el paciente firme el consentimiento.</p>
    <p style="font-size:12px;color:#6b7280;">Enlace enviado al paciente (referencia):<br><a href="${link}">${link}</a></p>
    <p style="font-size:12px;">${publicSite}</p>
  </body></html>`;
  await sendEmailHtml(params.ownerEmail, `[${brand}] Colaboración pendiente de firma del paciente`, block(params.ownerDoctorName), fromAddresses.noReply);
  await sendEmailHtml(params.invitedEmail, `[${brand}] Esperando autorización del paciente`, block(params.invitedDoctorName), fromAddresses.noReply);
}

export async function sendCaseShareSignedWithPdf(params: {
  to: string;
  doctorLabel: string;
  patientName: string;
  caseLabel: string;
  /** Si falta, se envía solo el aviso (p. ej. falló la generación del PDF en servidor). */
  pdfBuffer?: Buffer | null;
}): Promise<boolean> {
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
    return sendEmailHtml(params.to, subject, html, fromAddresses.noReply, [
      {
        filename: `consentimiento_colaboracion_${params.caseLabel.replace(/\s+/g, '_')}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf'
      }
    ]);
  }
  return sendEmailHtml(params.to, subject, html, fromAddresses.noReply);
}

export async function sendCaseShareSignedCopyToPatient(params: {
  to: string;
  patientName: string;
  caseLabel: string;
  ownerDoctorName: string;
  invitedDoctorName: string;
  /** Si falta, se envía aviso sin adjunto. */
  pdfBuffer?: Buffer | null;
}): Promise<boolean> {
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
    return sendEmailHtml(params.to, subject, html, fromAddresses.noReply, [
      {
        filename: `consentimiento_colaboracion_${params.caseLabel.replace(/\s+/g, '_')}.pdf`,
        content: params.pdfBuffer,
        contentType: 'application/pdf'
      }
    ]);
  }
  return sendEmailHtml(params.to, subject, html, fromAddresses.noReply);
}
