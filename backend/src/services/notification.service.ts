import { securityLogger } from '../utils/logger.utils';
import { sendEmailHtml, sendEmailHtmlWithTextFallback, fromAddresses } from '../utils/email.utils';
import { formatAppointmentTime, formatAppointmentTimeWithAmPm, formatAppointmentDate, formatAppointmentDateShort } from '../utils/date.utils';

// TODO: Implementar con credenciales reales de WhatsApp Business API
export class WhatsAppService {
  private static instance: WhatsAppService;
  private apiKey: string | null = null;
  private phoneNumberId: string | null = null;

  private constructor() {
    // TODO: Cargar credenciales desde variables de entorno
    this.apiKey = process.env.WHATSAPP_API_KEY || null;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null;
  }

  public static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }

  async sendInvitationMessage(phone: string, doctorName: string, invitationUrl: string): Promise<boolean> {
    try {
      if (!this.apiKey || !this.phoneNumberId) {
        securityLogger.warn('WhatsApp credentials not configured, skipping message');
        return false;
      }

      const message = `Hola! El Dr. ${doctorName} te ha registrado en Qlinexa360. 
       
Para completar tu registro y acceder a tu historial médico, haz clic en este enlace:
${invitationUrl}

Este enlace expira en 7 días.

Saludos,
Equipo Qlinexa360`;

      // TODO: Implementar llamada real a WhatsApp Business API
      const response = await fetch(`https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message }
        })
      });

      if (response.ok) {
        securityLogger.info(`WhatsApp invitation sent to ${phone}`);
        return true;
      } else {
        securityLogger.error(`Failed to send WhatsApp message to ${phone}: ${response.statusText}`);
        return false;
      }

    } catch (error) {
      securityLogger.error(`Error sending WhatsApp message to ${phone}:`, error);
      return false;
    }
  }

  async sendAppointmentConfirmationMessage(phone: string, data: { doctorName: string; patientName: string; date: Date; time: string; reason?: string; timezone?: string | null }): Promise<boolean> {
    try {
      if (!this.apiKey || !this.phoneNumberId) {
        securityLogger.warn('WhatsApp credentials not configured, skipping message');
        return false;
      }
      const tz = data.timezone;
      const dateStr = formatAppointmentDateShort(data.date, tz);
      const timeStr = data.time || formatAppointmentTimeWithAmPm(data.date, tz);
      const message = `Confirmación de cita\n\nDoctor(a): ${data.doctorName}\nPaciente: ${data.patientName}\nFecha: ${dateStr}\nHorario: ${timeStr}${data.reason ? `\nMotivo: ${data.reason}` : ''}`;
      const response = await fetch(`https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } })
      });
      if (response.ok) return true;
      securityLogger.error(`Failed to send WhatsApp appointment confirmation to ${phone}: ${response.statusText}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending WhatsApp appointment confirmation to ${phone}:`, error);
      return false;
    }
  }

  async sendAppointmentCancellationMessage(phone: string, data: { patientName: string; doctorName: string; date: Date; time: string; timezone?: string | null }): Promise<boolean> {
    try {
      if (!this.apiKey || !this.phoneNumberId) {
        securityLogger.warn('WhatsApp credentials not configured, skipping message');
        return false;
      }
      const tz = data.timezone;
      const dateStr = formatAppointmentDateShort(data.date, tz);
      const timeStr = data.time || formatAppointmentTimeWithAmPm(data.date, tz);
      const message = `❌ Cancelación de cita\n\nHola ${data.patientName},\n\nLamentamos informarte que tu cita con ${data.doctorName} programada para el ${dateStr} a las ${timeStr} ha sido cancelada.\n\nPor favor, contacta al consultorio para reagendar tu cita si lo deseas.\n\nSaludos,\nEquipo Qlinexa360`;
      const response = await fetch(`https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } })
      });
      if (response.ok) return true;
      securityLogger.error(`Failed to send WhatsApp appointment cancellation to ${phone}: ${response.statusText}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending WhatsApp appointment cancellation to ${phone}:`, error);
      return false;
    }
  }

  async sendDoctorNotificationMessage(phone: string, data: { doctorName: string; patientName: string; date: Date; time: string; reason?: string }): Promise<boolean> {
    // For now reuse the same template
    return this.sendAppointmentConfirmationMessage(phone, data);
  }

  async sendPreConsultationLinkMessage(phone: string, doctorName: string, appointmentDate: string, link: string): Promise<boolean> {
    try {
      if (!this.apiKey || !this.phoneNumberId) {
        securityLogger.warn('WhatsApp credentials not configured, skipping message');
        return false;
      }

      const message = `Hola! El Prof. ${doctorName} te ha enviado un formulario de pre-consulta para tu cita del ${appointmentDate}.

Por favor, completa este formulario con tu información médica antes de tu cita para que tu profesional de la salud pueda revisarla con anticipación.

Accede al formulario aquí:
${link}

Este enlace expira en 7 días.

Saludos,
Equipo Qlinexa360`;

      const response = await fetch(`https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message }
        })
      });

      if (response.ok) {
        securityLogger.info(`WhatsApp pre-consultation link sent to ${phone}`);
        return true;
      } else {
        securityLogger.error(`Failed to send WhatsApp pre-consultation link to ${phone}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      securityLogger.error(`Error sending WhatsApp pre-consultation link to ${phone}:`, error);
      return false;
    }
  }

  async sendPreConsultationCompletedMessage(phone: string, patientName: string, appointmentDate: Date): Promise<boolean> {
    try {
      if (!this.apiKey || !this.phoneNumberId) {
        securityLogger.warn('WhatsApp credentials not configured, skipping message');
        return false;
      }

      const appointmentDateStr = new Date(appointmentDate).toLocaleDateString('es-MX', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const message = `Hola! El paciente ${patientName} ha completado su pre-consulta para la cita del ${appointmentDateStr}.

Puedes revisar la información en la plataforma Qlinexa360 antes de la consulta.

Saludos,
Equipo Qlinexa360`;

      const response = await fetch(`https://graph.facebook.com/v17.0/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message }
        })
      });

      if (response.ok) {
        securityLogger.info(`WhatsApp pre-consultation completed notification sent to ${phone}`);
        return true;
      } else {
        securityLogger.error(`Failed to send WhatsApp pre-consultation completed notification to ${phone}: ${response.statusText}`);
        return false;
      }
    } catch (error) {
      securityLogger.error(`Error sending WhatsApp pre-consultation completed notification to ${phone}:`, error);
      return false;
    }
  }
}

// Email via Zoho SMTP (nodemailer)
export class EmailService {
  private static instance: EmailService;

  private constructor() {}

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendInvitationEmail(email: string, doctorName: string, invitationUrl: string): Promise<boolean> {
    try {
      const subject = 'Paciente registrado en Qlinexa360';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Paciente registrado en Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin-top: 0;">Estimado paciente,</h2>
              <p>El Profesional de la Salud <strong>${doctorName}</strong> te ha registrado en Qlinexa360.</p>
              <p>Por favor configura una contraseña personalizada para que puedas dar seguimiento y colabores con las consultas de tu Profesional de la Salud.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <div style="text-align: center; margin: 20px 0;">
                <a href="${invitationUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Configura una contraseña
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280;">
                <strong>Importante:</strong> Este enlace expira en 7 días.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Email invitation sent to ${email}`);
      else securityLogger.error(`Failed to send email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending email to ${email}:`, error);
      return false;
    }
  }

  /**
   * Envía a legal@qlinexa360.com notificación de nuevo usuario con consentimientos firmados.
   * Para DOCTOR, PACIENTE, ASISTENTE. Incluye: nombre y apellido, email, rol y los 3 PDFs.
   */
  async sendNewUserConsentToLegal(params: {
    fullName: string;
    email: string;
    role: string;
    pdfBuffers: { aviso: Buffer; terminos: Buffer; contrato: Buffer };
  }): Promise<boolean> {
    const LEGAL_EMAIL = 'legal@qlinexa360.com';
    const roleDisplay = params.role === 'PATIENT' ? 'PACIENTE' : params.role === 'ASISTENTE' ? 'ASISTENTE' : 'DOCTOR';
    try {
      const subject = `[Qlinexa360] Nuevo registro - ${params.fullName} (${roleDisplay})`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Nuevo registro Qlinexa360</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
              <p style="color: #6b7280; font-size: 14px;">Notificación de nuevo registro</p>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin-top: 0;">Nuevo usuario registrado</h2>
              <p><strong>Nombre y apellido:</strong> ${params.fullName}</p>
              <p><strong>Mail del usuario:</strong> ${params.email}</p>
              <p><strong>Rol:</strong> ${roleDisplay}</p>
            </div>
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px;">
                Se adjuntan los documentos legales firmados: Aviso de Privacidad, Términos de Uso y Contrato de Uso de Plataforma.
              </p>
            </div>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">Saludos,<br>Sistema Qlinexa360</p>
            </div>
          </div>
        </body>
        </html>
      `;
      const attachments = [
        { filename: 'Aviso_Privacidad.pdf', content: params.pdfBuffers.aviso, contentType: 'application/pdf' as const },
        { filename: 'Terminos_Uso.pdf', content: params.pdfBuffers.terminos, contentType: 'application/pdf' as const },
        { filename: 'Contrato_Uso_Plataforma.pdf', content: params.pdfBuffers.contrato, contentType: 'application/pdf' as const }
      ];
      const ok = await sendEmailHtml(LEGAL_EMAIL, subject, htmlContent, fromAddresses.noReply, attachments);
      if (ok) securityLogger.info(`New user consent notification sent to legal@qlinexa360.com for ${params.email}`);
      else securityLogger.error(`Failed to send legal notification for ${params.email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending new user consent to legal:`, error);
      return false;
    }
  }

  /**
   * Envía al DOCTOR que registró al paciente el Aviso de Privacidad firmado por el paciente.
   * Solo se adjunta el PDF del Aviso de Privacidad (no Términos ni Contrato).
   */
  async sendPatientAvisoPrivacidadToDoctor(params: {
    doctorEmail: string;
    patientName: string;
    patientEmail: string;
    avisoPdfBuffer: Buffer;
  }): Promise<boolean> {
    try {
      const subject = `[Qlinexa360] Nuevo paciente registrado - Aviso de Privacidad firmado: ${params.patientName}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Nuevo paciente - Aviso de Privacidad</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
              <p style="color: #6b7280; font-size: 14px;">Nuevo paciente registrado en tu consultorio</p>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin-top: 0;">Datos del paciente</h2>
              <p><strong>Nombre del Paciente:</strong> ${params.patientName}</p>
              <p><strong>Mail del paciente:</strong> ${params.patientEmail}</p>
              <p><strong>Rol:</strong> Paciente</p>
            </div>
            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px;">
                Se adjunta el Aviso de Privacidad firmado por el paciente.
              </p>
            </div>
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">Saludos,<br>Sistema Qlinexa360</p>
            </div>
          </div>
        </body>
        </html>
      `;
      const attachments = [
        { filename: 'Aviso_Privacidad_Paciente.pdf', content: params.avisoPdfBuffer, contentType: 'application/pdf' as const }
      ];
      const ok = await sendEmailHtml(params.doctorEmail, subject, htmlContent, fromAddresses.noReply, attachments);
      if (ok) securityLogger.info(`Patient Aviso de Privacidad sent to doctor ${params.doctorEmail} for patient ${params.patientEmail}`);
      else securityLogger.error(`Failed to send patient Aviso de Privacidad to doctor ${params.doctorEmail}`);
      return ok;
    } catch (error) {
      securityLogger.error('Error sending patient Aviso de Privacidad to doctor:', error);
      return false;
    }
  }

  async sendPreConsultationLinkEmail(email: string, doctorName: string, appointmentDate: string, link: string): Promise<boolean> {
    try {
      const subject = 'Formulario de Pre-Consulta - Qlinexa360';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Formulario de Pre-Consulta - Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin-top: 0;">Estimado paciente,</h2>
              <p>El Profesional de la Salud <strong>${doctorName}</strong> te ha enviado un formulario de pre-consulta para tu cita del <strong>${appointmentDate}</strong>.</p>
              <p>Por favor, completa este formulario con tu información médica antes de tu cita para que tu profesional de la salud pueda revisarla con anticipación y optimizar el tiempo de tu consulta.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin-bottom: 15px;"><strong>¿Qué información puedes incluir?</strong></p>
              <ul style="margin: 0; padding-left: 20px; color: #1e40af;">
                <li>Historial médico general</li>
                <li>Alergias y medicamentos actuales</li>
                <li>Resultados de exámenes y estudios de laboratorio</li>
                <li>Cirugías previas</li>
                <li>Antecedentes familiares relevantes</li>
              </ul>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${link}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Completar Formulario de Pre-Consulta
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">
                <strong>Importante:</strong> Este enlace expira en 7 días. Puedes guardar tu progreso y continuar más tarde.
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Nota:</strong> Esta información ayudará a tu profesional de la salud a prepararse mejor para tu consulta y aprovechar mejor el tiempo de atención.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Pre-consultation link email sent to ${email}`);
      else securityLogger.error(`Failed to send pre-consultation link email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending pre-consultation link email to ${email}:`, error);
      return false;
    }
  }

  async sendPreConsultationCompletedEmail(email: string, patientName: string, appointmentDate: Date, timezone?: string | null): Promise<boolean> {
    try {
      const subject = 'Pre-Consulta Completada - Qlinexa360';
      const appointmentDateStr = `${formatAppointmentDate(appointmentDate, timezone)} ${formatAppointmentTime(appointmentDate, timezone)}`;
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Pre-Consulta Completada - Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #22c55e;">
              <h2 style="color: #15803d; margin-top: 0;">Pre-Consulta Completada</h2>
              <p>El paciente <strong>${patientName}</strong> ha completado el formulario de pre-consulta para la cita del <strong>${appointmentDateStr}</strong>.</p>
              <p>Puedes revisar esta información en la plataforma antes de la consulta para optimizar el tiempo de atención.</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Pre-consultation completed notification email sent to ${email}`);
      else securityLogger.error(`Failed to send pre-consultation completed email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending pre-consultation completed email to ${email}:`, error);
      return false;
    }
  }

  async sendAssistantInvitationEmail(email: string, doctorName: string, invitationUrl: string): Promise<boolean> {
    try {
      const subject = 'Invitación para unirte como Asistente en Qlinexa360';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invitación Asistente Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin-top: 0;">¡Hola!</h2>
              <p>El Dr. <strong>${doctorName}</strong> te ha invitado a unirte como Asistente en Qlinexa360.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <p><strong>Para completar tu registro como Asistente y acceder a la plataforma:</strong></p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${invitationUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Completar Registro
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280;">
                <strong>Importante:</strong> Este enlace expira en 7 días.
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Nota:</strong> Como asistente, tendrás acceso a las secciones que el doctor te habilite para apoyar en las tareas administrativas.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Assistant invitation email sent to ${email}`);
      else securityLogger.error(`Failed to send assistant invitation email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending assistant invitation email to ${email}:`, error);
      return false;
    }
  }

  async sendExternalCollaborationInviteEmail(
    email: string,
    inviterName: string,
    patientName: string,
    padecimiento: string,
    websiteUrl: string,
    inviterEmail?: string,
    avisoPdfBuffer?: Buffer
  ): Promise<boolean> {
    try {
      const subject = 'Invitación para colaborar en Qlinexa360';
      const avisoSection = avisoPdfBuffer
        ? `<div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0; font-size: 14px;">
                Se adjunta el Aviso de Privacidad firmado por el paciente <strong>${patientName}</strong>, que autoriza el tratamiento de sus datos personales conforme a la normativa aplicable.
              </p>
            </div>`
        : '';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invitación a colaborar - Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            <p>Se te invita a colaborar en este caso clínico del paciente <strong>${patientName}</strong> con el padecimiento <strong>${padecimiento}</strong> por parte de <strong>${inviterName}</strong>.</p>
            ${avisoSection}
            <p>Para colaborar te debes de registrar en la plataforma <a href="${websiteUrl}" style="color: #2563eb;">www.qlinexa360.com</a> como "Profesional de la Salud".</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${websiteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Registrarse en Qlinexa360</a>
            </div>
            <p style="font-size: 12px; color: #6b7280;">Si ya te encuentras registrado(a), inicia sesión y acepta la invitación desde la sección correspondiente.</p>
          </div>
        </body>
        </html>
      `;

      const attachments = avisoPdfBuffer
        ? [{ filename: `Aviso_Privacidad_Paciente_${patientName.replace(/\s+/g, '_')}.pdf`, content: avisoPdfBuffer, contentType: 'application/pdf' as const }]
        : undefined;
      const sent = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply, attachments);
      if (!sent) {
        securityLogger.error(`Failed to send external collaboration invite email to ${email}`);
        return false;
      }

      if (inviterEmail) {
        const copySubject = 'Copia: Invitación de colaboración enviada';
        const copyHtmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>Copia de invitación - Qlinexa360</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb;">Qlinexa360</h1>
              </div>
              <p>Has enviado una invitación de colaboración a <strong>${email}</strong> para el caso clínico del paciente <strong>${patientName}</strong> con el padecimiento <strong>${padecimiento}</strong>.</p>
              <p>El contenido del mensaje enviado fue:</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p>Se te invita a colaborar en este caso clínico del paciente <strong>${patientName}</strong> con el padecimiento <strong>${padecimiento}</strong> por parte de <strong>${inviterName}</strong>.</p>
                <p>Para colaborar te debes de registrar en la plataforma <a href="${websiteUrl}" style="color: #2563eb;">www.qlinexa360.com</a> como "Profesional de la Salud".</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const copyOk = await sendEmailHtml(inviterEmail, copySubject, copyHtmlContent, fromAddresses.noReply);
        if (copyOk) {
          securityLogger.info(`Copy of external collaboration invite email sent to ${inviterEmail}`);
        } else {
          securityLogger.error(`Failed to send copy of external collaboration invite email to ${inviterEmail}`);
        }
      }

      securityLogger.info(`External collaboration invite email sent to ${email}`);
      return true;
    } catch (error) {
      securityLogger.error(`Error sending external collaboration invite email to ${email}:`, error);
      return false;
    }
  }

  async sendInternalCollaborationInviteEmail(
    email: string,
    inviterName: string,
    patientName: string,
    padecimiento: string,
    websiteUrl: string,
    avisoPdfBuffer?: Buffer
  ): Promise<boolean> {
    try {
      const subject = 'Invitación a colaborar en un caso clínico - Qlinexa360';
      const avisoSection = avisoPdfBuffer
        ? `<div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0;">
              <p style="margin: 0; font-size: 14px;">
                Se adjunta el Aviso de Privacidad firmado por el paciente <strong>${patientName}</strong>, que autoriza el tratamiento de sus datos personales conforme a la normativa aplicable.
              </p>
            </div>`
        : '';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invitación a colaborar - Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            <p>El Dr./Dra. <strong>${inviterName}</strong> te ha invitado a colaborar en el caso clínico <strong>${padecimiento}</strong> del paciente <strong>${patientName}</strong>.</p>
            ${avisoSection}
            <p>Se ha compartido únicamente este caso clínico de este paciente contigo. Inicia sesión en la plataforma para ver los detalles y colaborar.</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${websiteUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ir a Qlinexa360</a>
            </div>
            <p style="font-size: 12px; color: #6b7280;">También recibirás una notificación en la plataforma (icono de campanita) con esta invitación.</p>
          </div>
        </body>
        </html>
      `;

      const attachments = avisoPdfBuffer
        ? [{ filename: `Aviso_Privacidad_Paciente_${patientName.replace(/\s+/g, '_')}.pdf`, content: avisoPdfBuffer, contentType: 'application/pdf' as const }]
        : undefined;
      const sent = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply, attachments);
      if (!sent) {
        securityLogger.error(`Failed to send internal collaboration invite email to ${email}`);
        return false;
      }
      securityLogger.info(`Internal collaboration invite email sent to ${email}`);
      return true;
    } catch (error) {
      securityLogger.error(`Error sending internal collaboration invite email to ${email}:`, error);
      return false;
    }
  }

  async sendAppointmentConfirmationEmail(email: string, data: { doctorName: string; patientName: string; date: Date; time: string; reason?: string; timezone?: string | null }): Promise<boolean> {
    try {
      const subject = 'Confirmación de cita - Qlinexa360';
      const tz = data.timezone;
      const dateStr = formatAppointmentDateShort(new Date(data.date), tz);
      const htmlContent = `
        <html><body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color:#2563eb;">Confirmación de Cita</h2>
          <p>Hola ${data.patientName}, tu cita ha sido programada:</p>
          <ul>
            <li><strong>Doctor(a):</strong> ${data.doctorName}</li>
            <li><strong>Fecha:</strong> ${dateStr}</li>
            <li><strong>Horario:</strong> ${data.time || formatAppointmentTimeWithAmPm(data.date, tz)}</li>
            ${data.reason ? `<li><strong>Motivo:</strong> ${data.reason}</li>` : ''}
          </ul>
          <p>Gracias por usar Qlinexa360.</p>
        </body></html>`;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) return true;
      securityLogger.error(`Failed to send appointment confirmation email to ${email}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending appointment confirmation email to ${email}:`, error);
      return false;
    }
  }

  async sendAppointmentReminderEmail(
    email: string,
    data: { doctorName: string; patientName: string; date: Date; time: string; reason?: string; reminderLabel?: string; timezone?: string | null }
  ): Promise<boolean> {
    try {
      const subject = `Recordatorio de cita${data.reminderLabel ? ` (${data.reminderLabel})` : ''} - Qlinexa360`;
      const tz = data.timezone;
      const dateStr = formatAppointmentDate(data.date, tz);
      const labelText = data.reminderLabel ? ` (${data.reminderLabel})` : '';
      const htmlContent = `
        <html><body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">⏰ Recordatorio de Cita${labelText}</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Qlinexa360</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hola ${data.patientName},</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                Este es un recordatorio de tu cita médica programada:
              </p>
              
              <div style="background: white; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Doctor:</strong> ${data.doctorName}
                </p>
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Fecha:</strong> ${dateStr}
                </p>
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Hora:</strong> ${data.time || formatAppointmentTimeWithAmPm(data.date, tz)}
                </p>
                ${data.reason ? `
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Motivo:</strong> ${data.reason}
                </p>` : ''}
              </div>
              
              <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="color: #9a3412; margin: 0; font-size: 14px;">
                  <strong>💡 Recuerda:</strong> Si necesitas reagendar, contáctanos con anticipación.
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
            
            <div style="background: #343a40; padding: 12px; text-align: center; color: white; border-radius: 8px; margin-top: 20px;">
              <p style="margin: 0; font-size: 12px;">
                © 2024 Qlinexa360.
              </p>
            </div>
          </div>
        </body></html>`;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) return true;
      securityLogger.error(`Failed to send appointment reminder email to ${email}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending appointment reminder email to ${email}:`, error);
      return false;
    }
  }

  async sendAppointmentCancellationEmail(email: string, data: { patientName: string; doctorName: string; date: Date; time: string; timezone?: string | null }): Promise<boolean> {
    try {
      const subject = 'Cancelación de cita - Qlinexa360';
      const tz = data.timezone;
      const dateStr = formatAppointmentDate(data.date, tz);
      const htmlContent = `
        <html><body style="font-family: Arial, sans-serif; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 20px; text-align: center; color: white; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">❌ Cancelación de Cita</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Qlinexa360</p>
            </div>
            
            <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 8px 8px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hola ${data.patientName},</h2>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                Lamentamos informarte que tu cita médica ha sido cancelada:
              </p>
              
              <div style="background: white; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Doctor:</strong> Dr. ${data.doctorName}
                </p>
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Fecha:</strong> ${dateStr}
                </p>
                <p style="color: #555; margin: 5px 0; font-size: 16px;">
                  <strong>Hora:</strong> ${data.time || formatAppointmentTimeWithAmPm(data.date, tz)}
                </p>
              </div>
              
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                Por favor, contacta al consultorio si deseas reagendar tu cita.
              </p>
              
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>💡 Nota:</strong> Esta cancelación también se reflejará en tu calendario personal (Google Calendar, Outlook, etc.).
                </p>
              </div>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
            
            <div style="background: #343a40; padding: 20px; text-align: center; color: white; border-radius: 8px; margin-top: 20px;">
              <p style="margin: 0; font-size: 14px;">
                © 2024 Qlinexa360. Plataforma médica mexicana.
              </p>
            </div>
          </div>
        </body></html>`;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) return true;
      securityLogger.error(`Failed to send appointment cancellation email to ${email}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending appointment cancellation email to ${email}:`, error);
      return false;
    }
  }

  async sendDoctorNotificationEmail(email: string, data: { doctorName: string; patientName: string; date: Date; time: string; reason?: string; timezone?: string | null }): Promise<boolean> {
    try {
      const subject = 'Nueva cita agendada - Qlinexa360';
      const tz = data.timezone;
      const dateStr = formatAppointmentDateShort(data.date, tz);
      const htmlContent = `
        <html><body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color:#2563eb;">Nueva Cita Agendada</h2>
          <ul>
            <li><strong>Doctor(a):</strong> ${data.doctorName}</li>
            <li><strong>Paciente:</strong> ${data.patientName}</li>
            <li><strong>Fecha:</strong> ${dateStr}</li>
            <li><strong>Horario:</strong> ${data.time || formatAppointmentTimeWithAmPm(data.date, tz)}</li>
            ${data.reason ? `<li><strong>Motivo:</strong> ${data.reason}</li>` : ''}
          </ul>
        </body></html>`;
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) return true;
      securityLogger.error(`Failed to send doctor notification email to ${email}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending doctor notification email to ${email}:`, error);
      return false;
    }
  }

  // Enviar email de evento de calendario al paciente
  // icsContent: contenido .ics para adjuntar y que el paciente agregue el evento a su calendario
  async sendCalendarEventEmail(
    patientEmail: string,
    data: {
      patientName: string;
      doctorName: string;
      eventTitle: string;
      eventDate: Date;
      eventEndDate: Date;
      description?: string;
      linkMeeting?: string;
      tipoCita?: 'presencial' | 'remota';
      preConsultationLink?: string;
      manageLink?: string;
      timezone?: string | null;
      icsContent?: string;
    }
  ): Promise<boolean> {
    try {
      console.log('📧 sendCalendarEventEmail - preConsultationLink recibido:', data.preConsultationLink ? `SÍ (${data.preConsultationLink})` : 'NO');
      const subject = `Cita médica: ${data.eventTitle} - Qlinexa360`;
      const tz = data.timezone;
      const fechaFormateada = formatAppointmentDate(data.eventDate, tz);
      const horaInicio = formatAppointmentTime(data.eventDate, tz);
      const horaFin = formatAppointmentTime(data.eventEndDate, tz);

      // Log para debugging
      console.log('📧 sendCalendarEventEmail - preConsultationLink recibido:', data.preConsultationLink ? `SÍ (${data.preConsultationLink})` : 'NO');
      
      const htmlContent = `
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">Cita Médica Programada</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Qlinexa360</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hola ${data.patientName},</h2>
            
            <p style="color: #555; font-size: 16px; margin-bottom: 20px;">
              Te informamos que tienes una cita médica programada:
            </p>
            
            <div style="background: white; border: 2px solid #e9ecef; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
                ${data.eventTitle}
              </h3>
              
              <p style="color: #555; margin: 10px 0; font-size: 16px;">
                <strong style="color: #333;">👨‍⚕️ Doctor:</strong> ${data.doctorName}
              </p>
              
              <p style="color: #555; margin: 10px 0; font-size: 16px;">
                <strong style="color: #333;">📅 Fecha:</strong> ${fechaFormateada}
              </p>
              
              <p style="color: #555; margin: 10px 0; font-size: 16px;">
                <strong style="color: #333;">🕐 Horario:</strong> ${horaInicio} - ${horaFin}
              </p>
              
              ${data.tipoCita ? `
              <p style="color: #555; margin: 10px 0; font-size: 16px;">
                <strong style="color: #333;">📍 Tipo:</strong> 
                ${data.tipoCita === 'remota' ? '🖥️ Consulta Remota' : '🏥 Consulta Presencial'}
              </p>
              ` : ''}
              
              ${data.linkMeeting ? `
              <p style="color: #555; margin: 10px 0; font-size: 16px;">
                <strong style="color: #333;">🔗 Link de reunión:</strong><br>
                <a href="${data.linkMeeting}" style="color: #667eea; text-decoration: none; word-break: break-all;">
                  ${data.linkMeeting}
                </a>
              </p>
              ` : ''}
              
              ${data.description ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                <p style="color: #555; margin: 5px 0; font-size: 14px;">
                  <strong style="color: #333;">📝 Notas:</strong><br>
                  ${data.description}
                </p>
              </div>
              ` : ''}
            </div>
            
            ${data.icsContent ? `
            <div style="background: #ecfdf5; border: 2px solid #059669; border-radius: 10px; padding: 24px; margin: 24px 0;">
              <h3 style="margin: 0 0 12px 0; font-size: 20px; color: #065f46;">
                📅 Añade esta cita a tu calendario
              </h3>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Este correo incluye el archivo <strong style="color: #1f2937;">Cita_medica_Qlinexa360.ics</strong>. Con un solo clic lo agregas a tu calendario:
              </p>
              <ul style="margin: 0 0 16px 0; padding-left: 20px; font-size: 15px; line-height: 1.8; color: #374151;">
                <li><strong style="color: #1f2937;">En Gmail/Outlook:</strong> Haz clic en el archivo adjunto</li>
                <li><strong style="color: #1f2937;">En móvil:</strong> Toca el adjunto y elige "Añadir al calendario"</li>
                <li><strong style="color: #1f2937;">En computadora:</strong> Abre el archivo y se agregará a tu calendario predeterminado</li>
              </ul>
              <p style="margin: 0; font-size: 14px; color: #4b5563;">
                ✓ Funciona con Google Calendar, Outlook, Apple Calendar y la mayoría de aplicaciones de calendario
              </p>
            </div>
            ` : ''}
            
            ${data.manageLink ? `
            <div style="background: #ecfeff; border: 2px solid #06b6d4; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #0e7490; margin: 0 0 12px 0; font-size: 18px;">
                ✅ Confirmar o Reprogramar
              </h3>
              <p style="color: #0e7490; font-size: 16px; margin-bottom: 15px; line-height: 1.6;">
                Para confirmar tu asistencia o solicitar un cambio de horario, usa el siguiente enlace:
              </p>
              <div style="text-align: center; margin: 16px 0;">
                <a href="${data.manageLink}"
                   style="background-color: #0891b2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                  Confirmar o Reprogramar
                </a>
              </div>
            </div>
            ` : ''}

            ${data.preConsultationLink ? `
            <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 18px;">
                📋 Completa tu Pre-Consulta
              </h3>
              <p style="color: #1e40af; font-size: 16px; margin-bottom: 15px; line-height: 1.6;">
                Para optimizar el tiempo de tu consulta, te invitamos a completar tu historial clínico inicial antes de la cita. 
                Esto ayudará a tu profesional de la salud a prepararse mejor y aprovechar al máximo el tiempo de atención.
              </p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${data.preConsultationLink}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
                  Completar Pre-Consulta
                </a>
              </div>
              <p style="color: #1e40af; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                <strong>💡 Importante:</strong> Puedes guardar tu progreso y continuar más tarde si es necesario.
              </p>
            </div>
            ` : ''}
            
            <p style="color: #555; font-size: 14px; margin-top: 20px;">
              Por favor, confirma tu asistencia y si tienes alguna pregunta, no dudes en contactarnos.
            </p>
            
            <p style="color: #555; font-size: 14px; margin-top: 20px;">
              Gracias por confiar en nosotros.<br>
              <strong>Equipo Qlinexa360</strong>
            </p>
          </div>
        </body>
        </html>`;

      // Log del contenido HTML para debugging
      console.log('📧 Verificando preConsultationLink en datos recibidos:', data.preConsultationLink ? `SÍ (${data.preConsultationLink})` : 'NO');
      console.log('📧 Tipo de preConsultationLink:', typeof data.preConsultationLink);
      console.log('📧 Valor exacto:', JSON.stringify(data.preConsultationLink));
      
      if (data.preConsultationLink) {
        console.log('📧 HTML generado con preConsultationLink. Verificando que esté en el HTML...');
        const hasLinkInHtml = htmlContent.includes(data.preConsultationLink);
        console.log('   Link presente en HTML:', hasLinkInHtml ? '✅ SÍ' : '❌ NO');
        if (!hasLinkInHtml) {
          console.error('   ⚠️  ERROR: El link no está en el HTML generado!');
          console.log('   Link esperado:', data.preConsultationLink);
          console.log('   Primeros 200 caracteres del HTML:', htmlContent.substring(0, 200));
        } else {
          console.log('   ✅ Link confirmado en HTML');
        }
      } else {
        console.warn('   ⚠️  preConsultationLink es undefined o null, no se incluirá en el email');
      }

      const attachments: Array<{ filename: string; content: string; contentType: string }> = [];
      if (data.icsContent) {
        attachments.push({
          filename: 'Cita_medica_Qlinexa360.ics',
          content: data.icsContent,
          contentType: 'text/calendar; method=PUBLISH'
        });
      }

      const ok = await sendEmailHtml(
        patientEmail,
        subject,
        htmlContent,
        fromAddresses.noReply,
        attachments.length > 0 ? attachments : undefined
      );
      if (ok) {
        console.log(`✅ Email enviado exitosamente a ${patientEmail}${data.icsContent ? ' con adjunto .ics para calendario' : ''}`);
        return true;
      }
      securityLogger.error(`Failed to send calendar event email to ${patientEmail}`);
      return false;
    } catch (error) {
      securityLogger.error(`Error sending calendar event email to ${patientEmail}:`, error);
      return false;
    }
  }

  async sendDoctorWelcomeEmail(email: string, firstName: string, lastName: string): Promise<boolean> {
    try {
      const subject = '¡Bienvenido a Qlinexa360! - Registro Exitoso';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenido a Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
              <h2 style="color: #1e40af; margin-top: 0;">¡Felicidades ${firstName} ${lastName}!</h2>
              <p style="font-size: 18px; margin-bottom: 20px;">Has concluido tu registro como <strong>Profesional de la Salud</strong> en Qlinexa360.</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;">Estamos seguros que la plataforma y soluciones de Qlinexa360 te servirán mucho.</p>
              <p style="margin-bottom: 15px;">Nuestra misión es convertir a Qlinexa360 en la <strong>plataforma médica mexicana más confiable y accesible</strong> para la gestión integral de pacientes y servicios de salud.</p>
              <p style="margin-bottom: 15px;">Desarrollada con orgullo en México y diseñada específicamente para las necesidades del sector sanitario latinoamericano, Qlinexa360 combina innovación tecnológica con un profundo entendimiento de los retos que enfrentan los profesionales médicos en nuestra región.</p>
              <p>Nuestro compromiso es crecer contigo, adaptando constantemente nuestras soluciones para responder a un entorno médico en evolución y expandirnos regionalmente para apoyar a más profesionales de la salud.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;"><strong>Para acceder a tu cuenta:</strong></p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://www.qlinexa360.com" 
                   style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Acceder a Qlinexa360
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280; text-align: center;">
                <strong>Usuario:</strong> ${email}
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Nota de Seguridad:</strong> Por tu seguridad, nunca enviamos contraseñas por correo electrónico. Si olvidaste tu contraseña, puedes restablecerla desde la plataforma.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                ¡Bienvenido al futuro de la medicina digital!<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Doctor welcome email sent to ${email}`);
      else securityLogger.error(`Failed to send doctor welcome email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending doctor welcome email to ${email}:`, error);
      return false;
    }
  }

  async sendAssistantWelcomeEmail(email: string, firstName: string, lastName: string): Promise<boolean> {
    try {
      const subject = '¡Bienvenido a Qlinexa360! - Registro Exitoso';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenido a Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
              <h2 style="color: #1e40af; margin-top: 0;">¡Felicidades ${firstName} ${lastName}!</h2>
              <p style="font-size: 18px; margin-bottom: 20px;">Has concluido tu registro como <strong>Asistente</strong> en Qlinexa360.</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;">Como asistente, tendrás acceso a las secciones que el profesional de la salud te habilite para apoyar en las tareas administrativas y de gestión de pacientes.</p>
              <p style="margin-bottom: 15px;">Qlinexa360 es la <strong>plataforma médica mexicana más confiable y accesible</strong> para la gestión integral de pacientes y servicios de salud.</p>
              <p>Desarrollada con orgullo en México y diseñada específicamente para las necesidades del sector sanitario latinoamericano.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;"><strong>Para acceder a tu cuenta:</strong></p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://www.qlinexa360.com" 
                   style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Acceder a Qlinexa360
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280; text-align: center;">
                <strong>Usuario:</strong> ${email}
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Nota de Seguridad:</strong> Por tu seguridad, nunca enviamos contraseñas por correo electrónico. Si olvidaste tu contraseña, puedes restablecerla desde la plataforma.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                ¡Bienvenido al futuro de la medicina digital!<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Assistant welcome email sent to ${email}`);
      else securityLogger.error(`Failed to send assistant welcome email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending assistant welcome email to ${email}:`, error);
      return false;
    }
  }

  async sendPatientWelcomeEmail(email: string, firstName: string, lastName: string): Promise<boolean> {
    try {
      const subject = '¡Bienvenido a Qlinexa360! - Registro Exitoso';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Bienvenido a Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f0f9ff; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
              <h2 style="color: #1e40af; margin-top: 0;">¡Hola ${firstName} ${lastName}!</h2>
              <p style="font-size: 18px; margin-bottom: 20px;">Has sido registrado exitosamente como <strong>Paciente</strong> en Qlinexa360.</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;">Qlinexa360 es la <strong>plataforma médica mexicana más confiable y accesible</strong> para la gestión integral de tu salud.</p>
              <p style="margin-bottom: 15px;">Desde aquí podrás acceder a tu historial médico, recetas, citas y toda la información relacionada con tu atención médica de manera segura y organizada.</p>
              <p>Desarrollada con orgullo en México y diseñada específicamente para las necesidades del sector sanitario latinoamericano.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;"><strong>Para acceder a tu cuenta:</strong></p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://www.qlinexa360.com" 
                   style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Acceder a Qlinexa360
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280; text-align: center;">
                <strong>Usuario:</strong> ${email}
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>Nota de Seguridad:</strong> Por tu seguridad, nunca enviamos contraseñas por correo electrónico. Si olvidaste tu contraseña, puedes restablecerla desde la plataforma.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                ¡Bienvenido al futuro de la medicina digital!<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Patient welcome email sent to ${email}`);
      else securityLogger.error(`Failed to send patient welcome email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending patient welcome email to ${email}:`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(email: string, firstName: string, lastName: string, token: string): Promise<boolean> {
    try {
      const subject = 'Recuperación de Contraseña - Qlinexa360';
      const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      const safeFirstName = String(firstName || '').replace(/[<>&"']/g, '');
      const safeLastName = String(lastName || '').replace(/[<>&"']/g, '');

      const textContent = `Qlinexa360 - Recuperación de Contraseña

¡Hola ${safeFirstName} ${safeLastName}!

Has solicitado recuperar tu contraseña en Qlinexa360.

Para restablecer tu contraseña, copia y pega este enlace en tu navegador:

${resetUrl}

Usuario: ${email}

IMPORTANTE:
- Este enlace expira en 15 minutos
- Si no solicitaste este cambio, ignora este correo
- Nunca compartas este enlace con nadie

Saludos,
Equipo Qlinexa360`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Recuperación de Contraseña - Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #fef2f2; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #dc2626;">
              <h2 style="color: #dc2626; margin-top: 0;">¡Hola ${safeFirstName} ${safeLastName}!</h2>
              <p style="font-size: 18px; margin-bottom: 20px;">Has solicitado recuperar tu contraseña en Qlinexa360.</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;">Para restablecer tu contraseña, haz clic en el botón de abajo:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #dc2626; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Restablecer Contraseña
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280; text-align: center;">
                <strong>Usuario:</strong> ${email}
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⚠️ IMPORTANTE:</strong>
              </p>
              <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #92400e;">
                <li>Este enlace expira en <strong>15 minutos</strong></li>
                <li>Si no solicitaste este cambio, ignora este correo</li>
                <li>Nunca compartas este enlace con nadie</li>
                <li>Si tienes problemas, contacta al soporte técnico</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const ok = await sendEmailHtmlWithTextFallback(email, subject, htmlContent, textContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Password reset email sent to ${email}`);
      else securityLogger.error(`Failed to send password reset email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending password reset email to ${email}:`, error);
      return false;
    }
  }

  async sendPasswordChangedEmail(email: string, firstName: string, lastName: string): Promise<boolean> {
    try {
      const subject = 'Contraseña Actualizada - Qlinexa360';
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contraseña Actualizada - Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f0fdf4; padding: 25px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #16a34a;">
              <h2 style="color: #16a34a; margin-top: 0;">¡Hola ${firstName} ${lastName}!</h2>
              <p style="font-size: 18px; margin-bottom: 20px;">Tu contraseña ha sido actualizada exitosamente en Qlinexa360.</p>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin-bottom: 15px;">Ahora puedes acceder a tu cuenta con tu nueva contraseña:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="https://www.qlinexa360.com" 
                   style="background-color: #16a34a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px; font-weight: bold;">
                  Acceder a Qlinexa360
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280; text-align: center;">
                <strong>Usuario:</strong> ${email}
              </p>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>🔒 Nota de Seguridad:</strong> Si no realizaste este cambio, contacta inmediatamente al soporte técnico.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Password changed confirmation email sent to ${email}`);
      else securityLogger.error(`Failed to send password changed confirmation email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending password changed confirmation email to ${email}:`, error);
      return false;
    }
  }
}

export class NotificationService {
  private static instance: NotificationService;
  private whatsappService: WhatsAppService;
  private emailService: EmailService;

  private constructor() {
    this.whatsappService = WhatsAppService.getInstance();
    this.emailService = EmailService.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async sendTwoFactorRecoveryEmail(email: string, firstName: string, code: string): Promise<boolean> {
    try {
      const subject = 'Código de recuperación de acceso - Qlinexa360';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Código de recuperación</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            <h2 style="color: #1e40af;">Hola ${firstName},</h2>
            <p>Recibimos una solicitud para recuperar el acceso con 2FA.</p>
            <p>Tu código de recuperación es:</p>
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; font-size: 24px; letter-spacing: 3px;">
              <strong>${code}</strong>
            </div>
            <p style="margin-top: 16px; color: #6b7280; font-size: 14px;">
              Este código expira en 10 minutos. Si no solicitaste este código, puedes ignorar este mensaje.
            </p>
          </div>
        </body>
        </html>
      `;

      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Two-factor recovery email sent to ${email}`);
      else securityLogger.error(`Failed to send two-factor recovery email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending two-factor recovery email to ${email}:`, error);
      return false;
    }
  }

  async sendInvitation(phone: string, email: string, doctorName: string, invitationUrl: string): Promise<{
    whatsappSent: boolean;
    emailSent: boolean;
  }> {
    const [whatsappSent, emailSent] = await Promise.all([
      this.whatsappService.sendInvitationMessage(phone, doctorName, invitationUrl),
      this.emailService.sendInvitationEmail(email, doctorName, invitationUrl)
    ]);

    return { whatsappSent, emailSent };
  }

  async sendPasswordSetupEmail(email: string, doctorName: string, passwordResetUrl: string): Promise<boolean> {
    try {
      const subject = 'Paciente registrado en Qlinexa360';
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Paciente registrado en Qlinexa360</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2563eb;">Qlinexa360</h1>
            </div>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h2 style="color: #1e40af; margin-top: 0;">Estimado paciente,</h2>
              <p>El Profesional de la Salud <strong>${doctorName}</strong> te ha registrado en Qlinexa360.</p>
              <p>Por favor configura una contraseña personalizada para que puedas dar seguimiento y colabores con las consultas de tu Profesional de la Salud.</p>
            </div>
            
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <div style="text-align: center; margin: 20px 0;">
                <a href="${passwordResetUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Configura una contraseña
                </a>
              </div>
              <p style="font-size: 14px; color: #6b7280;">
                <strong>Importante:</strong> Este enlace expira en 7 días.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      const ok = await sendEmailHtml(email, subject, htmlContent, fromAddresses.noReply);
      if (ok) securityLogger.info(`Password setup email sent to ${email}`);
      else securityLogger.error(`Failed to send password setup email to ${email}`);
      return ok;
    } catch (error) {
      securityLogger.error(`Error sending password setup email to ${email}:`, error);
      return false;
    }
  }

  async sendAssistantInvitation(email: string, doctorName: string, invitationUrl: string): Promise<{
    emailSent: boolean;
  }> {
    const emailSent = await this.emailService.sendAssistantInvitationEmail(email, doctorName, invitationUrl);
    return { emailSent };
  }

  async sendExternalCollaborationInvite(params: {
    email: string;
    inviterName: string;
    patientName: string;
    padecimiento: string;
    websiteUrl: string;
    inviterEmail?: string;
    avisoPdfBuffer?: Buffer;
  }): Promise<{ emailSent: boolean }> {
    const { email, inviterName, patientName, padecimiento, websiteUrl, inviterEmail, avisoPdfBuffer } = params;
    try {
      const emailSent = await this.emailService.sendExternalCollaborationInviteEmail(
        email,
        inviterName,
        patientName,
        padecimiento,
        websiteUrl,
        inviterEmail,
        avisoPdfBuffer
      );
      return { emailSent };
    } catch (error) {
      securityLogger.error('Error sending external collaboration invite', error);
      return { emailSent: false };
    }
  }

  async sendInternalCollaborationInvite(params: {
    email: string;
    inviterName: string;
    patientName: string;
    padecimiento: string;
    avisoPdfBuffer?: Buffer;
  }): Promise<{ emailSent: boolean }> {
    const websiteUrl = process.env.FRONTEND_URL || 'https://www.qlinexa360.com';
    try {
      const emailSent = await this.emailService.sendInternalCollaborationInviteEmail(
        params.email,
        params.inviterName,
        params.patientName,
        params.padecimiento,
        websiteUrl,
        params.avisoPdfBuffer
      );
      return { emailSent };
    } catch (error) {
      securityLogger.error('Error sending internal collaboration invite', error);
      return { emailSent: false };
    }
  }

  async sendRecipeToPatientEmail(params: {
    toEmail: string;
    patientName: string;
    doctorName: string;
    recipeId: string;
    viewUrl?: string;
  }): Promise<boolean> {
    try {
      const subject = 'Tu receta médica - Qlinexa360';
      const html = `
        <html><body style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color:#2563eb;">Receta médica</h2>
          <p>Hola ${params.patientName},</p>
          <p><strong>${params.doctorName}</strong> te ha enviado una receta.</p>
          ${params.viewUrl ? `<p>Puedes verla y descargarla en el siguiente enlace seguro:</p>
          <p><a href="${params.viewUrl}" style="color:#2563eb;">Ver y descargar receta</a></p>` : ''}
          <p>Identificador de receta: <strong>${params.recipeId}</strong></p>
          <p>Gracias por usar Qlinexa360.</p>
        </body></html>`;
      const ok = await sendEmailHtml(
        params.toEmail,
        subject,
        html,
        fromAddresses.noReply
      );
      return ok;
    } catch (error) {
      securityLogger.error('Error sending recipe to patient email:', error);
      return false;
    }
  }

  async sendInvoiceToPatientEmail(params: {
    toEmail: string;
    patientName: string;
    doctorName: string;
    invoiceDate: string;
    pdfPath: string;
    xmlPath: string;
  }): Promise<boolean> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Leer archivos para adjuntarlos
      const attachments: any[] = [];
      
      // Adjuntar PDF
      if (params.pdfPath && fs.existsSync(params.pdfPath)) {
        const pdfFileName = path.basename(params.pdfPath);
        attachments.push({
          filename: pdfFileName.endsWith('.pdf') ? pdfFileName : `${pdfFileName}.pdf`,
          path: params.pdfPath,
          contentType: 'application/pdf'
        });
      }
      
      // Adjuntar XML
      if (params.xmlPath && fs.existsSync(params.xmlPath)) {
        const xmlFileName = path.basename(params.xmlPath);
        attachments.push({
          filename: xmlFileName.endsWith('.xml') ? xmlFileName : `${xmlFileName}.xml`,
          path: params.xmlPath,
          contentType: 'application/xml'
        });
      }
      
      const subject = 'Tu factura - Qlinexa360';
      const html = `
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb;">
              <h1 style="color:#2563eb; margin: 0; font-size: 24px;">Qlinexa360</h1>
              <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">Factura médica</p>
            </div>
            
            <h2 style="color:#333; margin-top: 0;">Hola ${params.patientName},</h2>
            
            <p style="font-size: 16px; color: #333;">
              <strong style="color: #2563eb;">${params.doctorName}</strong> te ha enviado tu factura.
            </p>
            
            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #1e40af;">Fecha de factura:</p>
              <p style="margin: 0; color: #333;">${params.invoiceDate}</p>
            </div>
            
            <div style="margin: 25px 0;">
              <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
                Se han adjuntado los siguientes archivos de facturación:
              </p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 0; font-size: 14px; color: #333;">
                  📄 <strong>Archivo PDF</strong> - Factura en formato PDF
                </p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #333;">
                  📋 <strong>Archivo XML</strong> - Comprobante fiscal digital (CFDI)
                </p>
              </div>
            </div>
            
            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>💡 Importante:</strong> Guarda estos archivos en un lugar seguro. El XML es necesario para trámites fiscales y deducciones.
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Saludos,<br>
                Equipo Qlinexa360
              </p>
            </div>
          </div>
        </body>
        </html>`;
      
      const ok = await sendEmailHtml(
        params.toEmail,
        subject,
        html,
        fromAddresses.noReply,
        attachments
      );
      return ok;
    } catch (error) {
      securityLogger.error('Error sending invoice to patient email:', error);
      return false;
    }
  }

  // Static helpers used by AgendaPacientesController
  static async sendAppointmentConfirmation(email: string, phone: string, appointmentData: { doctorName: string; patientName: string; date: Date; time: string; reason?: string }) {
    const svc = NotificationService.getInstance();
    const [emailSent, whatsappSent] = await Promise.all([
      svc.emailService.sendAppointmentConfirmationEmail(email, appointmentData),
      phone ? svc.whatsappService.sendAppointmentConfirmationMessage(phone, appointmentData) : Promise.resolve(false)
    ]);
    return { emailSent, whatsappSent };
  }

  static async sendDoctorNotification(email: string, phone: string, appointmentData: { doctorName: string; patientName: string; date: Date; time: string; reason?: string; timezone?: string | null }) {
    const svc = NotificationService.getInstance();
    const [emailSent, whatsappSent] = await Promise.all([
      svc.emailService.sendDoctorNotificationEmail(email, appointmentData),
      phone ? svc.whatsappService.sendDoctorNotificationMessage(phone, appointmentData) : Promise.resolve(false)
    ]);
    return { emailSent, whatsappSent };
  }

  static async sendAppointmentReminder(email: string, phone: string, appointmentData: { doctorName: string; patientName: string; date: Date; time: string; reason?: string }) {
    const svc = NotificationService.getInstance();
    const [emailSent, whatsappSent] = await Promise.all([
      svc.emailService.sendAppointmentReminderEmail(email, appointmentData),
      phone ? svc.whatsappService.sendAppointmentConfirmationMessage(phone, appointmentData) : Promise.resolve(false)
    ]);
    return { emailSent, whatsappSent };
  }

  /**
   * Envía a legal@qlinexa360.com notificación de nuevo usuario con consentimientos firmados.
   * Para DOCTOR, PACIENTE, ASISTENTE. Incluye: nombre y apellido, email, rol y los 3 PDFs.
   */
  static async sendNewUserConsentToLegal(params: {
    fullName: string;
    email: string;
    role: string;
    pdfBuffers: { aviso: Buffer; terminos: Buffer; contrato: Buffer };
  }): Promise<boolean> {
    const svc = NotificationService.getInstance();
    return svc.emailService.sendNewUserConsentToLegal(params);
  }

  static async sendPatientAvisoPrivacidadToDoctor(params: {
    doctorEmail: string;
    patientName: string;
    patientEmail: string;
    avisoPdfBuffer: Buffer;
  }): Promise<boolean> {
    const svc = NotificationService.getInstance();
    return svc.emailService.sendPatientAvisoPrivacidadToDoctor(params);
  }

  static async sendWelcomeEmail(email: string, firstName: string, lastName: string, role: 'DOCTOR' | 'ASISTENTE' | 'PATIENT') {
    const svc = NotificationService.getInstance();
    try {
      let emailSent = false;
      
      switch (role) {
        case 'DOCTOR':
          emailSent = await svc.emailService.sendDoctorWelcomeEmail(email, firstName, lastName);
          break;
        case 'ASISTENTE':
          emailSent = await svc.emailService.sendAssistantWelcomeEmail(email, firstName, lastName);
          break;
        case 'PATIENT':
          emailSent = await svc.emailService.sendPatientWelcomeEmail(email, firstName, lastName);
          break;
      }
      
      return { emailSent };
    } catch (error) {
      securityLogger.error(`Error sending welcome email to ${email} for role ${role}:`, error);
      return { emailSent: false };
    }
  }

  static async sendPasswordResetEmail(email: string, firstName: string, lastName: string, token: string) {
    const svc = NotificationService.getInstance();
    try {
      const emailSent = await svc.emailService.sendPasswordResetEmail(email, firstName, lastName, token);
      return { emailSent };
    } catch (error) {
      securityLogger.error(`Error sending password reset email to ${email}:`, error);
      return { emailSent: false };
    }
  }

  static async sendPasswordChangedEmail(email: string, firstName: string, lastName: string) {
    const svc = NotificationService.getInstance();
    try {
      const emailSent = await svc.emailService.sendPasswordChangedEmail(email, firstName, lastName);
      return { emailSent };
    } catch (error) {
      securityLogger.error(`Error sending password changed email to ${email}:`, error);
      return { emailSent: false };
    }
  }

  // Enviar email de confirmación de cita
  static async sendAppointmentConfirmationEmail(
    patientEmail: string,
    patientFirstName: string,
    patientLastName: string,
    appointmentDate: Date,
    doctorFirstName: string,
    doctorLastName: string,
    confirmationToken: string,
    reminderType: string,
    timezone?: string | null
  ): Promise<boolean> {
    try {
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const confirmationUrl = `${baseUrl}/confirm-appointment/${confirmationToken}`;
      
      const reminderText = this.getReminderTypeText(reminderType);
      
      const emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 24px;">Confirmación de Cita Médica</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Qlinexa360</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h2 style="color: #333; margin-bottom: 20px;">Hola ${patientFirstName} ${patientLastName}</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              ${reminderText} con el Dr. ${doctorFirstName} ${doctorLastName}.
            </p>
            
            <div style="background: white; border: 2px solid #e9ecef; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0;">Detalles de tu cita:</h3>
              <p style="color: #555; margin: 5px 0; font-size: 16px;">
                <strong>Fecha:</strong> ${formatAppointmentDate(appointmentDate, timezone)}
              </p>
              <p style="color: #555; margin: 5px 0; font-size: 16px;">
                <strong>Hora:</strong> ${formatAppointmentTime(appointmentDate, timezone)}
              </p>
              <p style="color: #555; margin: 5px 0; font-size: 16px;">
                <strong>Doctor:</strong> Dr. ${doctorFirstName} ${doctorLastName}
              </p>
            </div>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              Por favor, confirma tu asistencia o cancela si no puedes asistir:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationUrl}" 
                 style="display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 0 10px;">
                ✅ Confirmar Cita
              </a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>💡 Importante:</strong> Si no puedes asistir, puedes cancelar o solicitar reprogramación 
                haciendo clic en el enlace de confirmación.
              </p>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Este enlace expira en 24 horas por seguridad.
            </p>
          </div>
          
          <div style="background: #343a40; padding: 20px; text-align: center; color: white;">
            <p style="margin: 0; font-size: 14px;">
              © 2024 Qlinexa360. Plataforma médica mexicana.
            </p>
          </div>
        </div>
      `;
      
      const result = await sendEmailHtml(
        patientEmail,
        `Confirmación de Cita - ${reminderText}`,
        emailContent,
        fromAddresses.noReply
      );
      
      return result;
    } catch (error) {
      securityLogger.error('Error al enviar email de confirmación de cita:', error);
      return false;
    }
  }
  
  // Obtener texto descriptivo del tipo de recordatorio
  private static getReminderTypeText(reminderType: string): string {
    switch (reminderType) {
      case 'CONFIRMATION_48H':
        return 'Te recordamos que tienes una cita programada en 48 horas';
      case 'CONFIRMATION_24H':
        return 'Te recordamos que tienes una cita programada mañana';
      case 'CONFIRMATION_12H':
        return 'Te recordamos que tienes una cita programada en 12 horas';
      case 'FINAL_REMINDER':
        return 'Recordatorio final de tu cita programada';
      default:
        return 'Te recordamos que tienes una cita programada';
    }
  }

  // Enviar link de pre-consulta por email y WhatsApp
  async sendPreConsultationLink(
    email: string,
    phone: string,
    link: string,
    doctorName: string,
    appointmentDate: string
  ): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const [emailSent, whatsappSent] = await Promise.all([
      this.emailService.sendPreConsultationLinkEmail(email, doctorName, appointmentDate, link),
      phone ? this.whatsappService.sendPreConsultationLinkMessage(phone, doctorName, appointmentDate, link) : Promise.resolve(false)
    ]);

    return { emailSent, whatsappSent };
  }

  // Enviar notificación al doctor cuando el paciente completa la pre-consulta
  async sendPreConsultationCompletedNotification(
    email: string,
    phone: string,
    patientName: string,
    appointmentDate: Date
  ): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
    const [emailSent, whatsappSent] = await Promise.all([
      this.emailService.sendPreConsultationCompletedEmail(email, patientName, appointmentDate),
      phone ? this.whatsappService.sendPreConsultationCompletedMessage(phone, patientName, appointmentDate) : Promise.resolve(false)
    ]);

    return { emailSent, whatsappSent };
  }
}
