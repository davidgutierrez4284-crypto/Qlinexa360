import { Request, Response } from 'express';
import prisma from '../config/database';
import { securityLogger } from '../utils/logger.utils';
import { ClinicalCaseShareInviteStatus } from '@prisma/client';
import { CaseShareConsentPdfService } from '../services/caseShareConsentPdf.service';
import { sendCaseShareSignedWithPdf, sendCaseShareSignedCopyToPatient } from '../utils/caseShareEmail.utils';

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/** Público: datos mínimos del invite por token */
export async function getCaseShareInvitePublic(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const invite = await prisma.clinicalCaseShareInvite.findUnique({
      where: { token },
      include: {
        clinicalCase: { select: { id: true, padecimiento: true } },
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        ownerDoctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        invitedDoctor: { include: { user: { select: { firstName: true, lastName: true } } } }
      }
    });
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Enlace no válido' });
    }
    if (invite.status === ClinicalCaseShareInviteStatus.COMPLETED) {
      return res.json({
        success: true,
        alreadyCompleted: true,
        caseLabel: invite.clinicalCase.padecimiento,
        message: 'Este consentimiento ya fue firmado.'
      });
    }
    if (invite.status === ClinicalCaseShareInviteStatus.CANCELLED) {
      return res.status(400).json({ success: false, message: 'Esta invitación fue cancelada' });
    }
    if (new Date() > invite.expiresAt) {
      await prisma.clinicalCaseShareInvite.update({
        where: { id: invite.id },
        data: { status: ClinicalCaseShareInviteStatus.EXPIRED }
      });
      return res.status(410).json({ success: false, message: 'Este enlace expiró. Solicita una nueva invitación al profesional de tu caso.' });
    }
    if (invite.status !== ClinicalCaseShareInviteStatus.PENDING_CONSENT) {
      return res.status(400).json({ success: false, message: 'Estado de invitación no válido' });
    }
    return res.json({
      success: true,
      caseLabel: invite.clinicalCase.padecimiento,
      patientName: `${invite.patient.user.firstName} ${invite.patient.user.lastName}`.trim(),
      ownerDoctorName: `${invite.ownerDoctor.user.firstName} ${invite.ownerDoctor.user.lastName}`.trim(),
      invitedDoctorName: `${invite.invitedDoctor.user.firstName} ${invite.invitedDoctor.user.lastName}`.trim(),
      expiresAt: invite.expiresAt.toISOString()
    });
  } catch (e) {
    securityLogger.error('getCaseShareInvitePublic', e);
    return res.status(500).json({ success: false, message: 'Error del servidor' });
  }
}

/** POST firma: token del enlace (mismo criterio que teleconsulta). No exige sesión. */
export async function signCaseShareInvite(req: Request, res: Response) {
  try {
    const { token } = req.params;
    const signature = typeof req.body?.signature === 'string' ? req.body.signature.trim() : '';
    if (signature.length < 3) {
      return res.status(400).json({ success: false, message: 'La firma debe tener al menos 3 caracteres' });
    }
    const invite = await prisma.clinicalCaseShareInvite.findUnique({
      where: { token },
      include: {
        clinicalCase: { select: { id: true, padecimiento: true } },
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        ownerDoctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        invitedDoctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } }
      }
    });
    if (!invite) {
      return res.status(404).json({ success: false, message: 'Enlace no válido' });
    }
    if (invite.status === ClinicalCaseShareInviteStatus.COMPLETED) {
      return res.json({ success: true, alreadyCompleted: true, message: 'El consentimiento ya estaba firmado' });
    }
    if (invite.status === ClinicalCaseShareInviteStatus.CANCELLED) {
      return res.status(400).json({ success: false, message: 'Invitación cancelada' });
    }
    if (new Date() > invite.expiresAt) {
      await prisma.clinicalCaseShareInvite.update({
        where: { id: invite.id },
        data: { status: ClinicalCaseShareInviteStatus.EXPIRED }
      });
      return res.status(410).json({ success: false, message: 'El enlace expiró' });
    }
    if (invite.status !== ClinicalCaseShareInviteStatus.PENDING_CONSENT) {
      return res.status(400).json({ success: false, message: 'Estado no válido' });
    }
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')?.[0]?.trim() || req.ip || '';
    const signedAtDate = new Date();
    const signedAtStr = signedAtDate.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'medium' });
    const signedAtIso = signedAtDate.toISOString();
    const patientName = `${invite.patient.user.firstName} ${invite.patient.user.lastName}`.trim();
    const pdfData = {
      patientName,
      patientEmail: invite.patient.user.email || invite.patient.email || '',
      caseLabel: invite.clinicalCase.padecimiento,
      ownerDoctorName: `${invite.ownerDoctor.user.firstName} ${invite.ownerDoctor.user.lastName}`.trim(),
      invitedDoctorName: `${invite.invitedDoctor.user.firstName} ${invite.invitedDoctor.user.lastName}`.trim(),
      signature,
      signedAt: signedAtStr,
      signedAtIso,
      signedIp: ip
    };

    let pdfUrl: string | null = null;
    let consentHash: string | null = null;
    let pdfBuffer: Buffer | null = null;
    try {
      const gen = await CaseShareConsentPdfService.generateAndUpload(invite.id, pdfData);
      pdfUrl = gen.url;
      consentHash = gen.hash;
      pdfBuffer = gen.buffer;
    } catch (pdfErr) {
      securityLogger.error('signCaseShareInvite: PDF o subida a almacenamiento', pdfErr);
    }

    // Si el colaborador ya estaba vinculado (p. ej. revocación y nueva invitación con datos huérfanos), no volver a insertar: evita P2002
    await prisma.$transaction(async (tx) => {
      const already = await tx.padecimientoDoctorColaborador.findUnique({
        where: {
          patientId_padecimientoId_doctorId: {
            patientId: invite.patientId,
            padecimientoId: invite.clinicalCaseId,
            doctorId: invite.invitedDoctorId
          }
        }
      });
      if (!already) {
        await tx.padecimientoDoctorColaborador.create({
          data: {
            patientId: invite.patientId,
            padecimientoId: invite.clinicalCaseId,
            doctorId: invite.invitedDoctorId,
            rol: 'colaborador'
          }
        });
      }
      await tx.clinicalCaseShareInvite.update({
        where: { id: invite.id },
        data: {
          status: ClinicalCaseShareInviteStatus.COMPLETED,
          signedAt: new Date(),
          signedIp: ip,
          signatureText: signature,
          consentPdfUrl: pdfUrl,
          consentDocumentHash: consentHash
        }
      });
    });

    if (invite.invitedDoctor.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: invite.invitedDoctor.userId,
            type: 'COLLABORATION_REQUEST',
            title: 'Colaboración autorizada',
            message: `${patientName} autorizó tu acceso al caso clínico "${invite.clinicalCase.padecimiento}".`,
            data: { clinicalCaseId: invite.clinicalCaseId, patientId: invite.patientId, ownerDoctorId: invite.ownerDoctorId }
          }
        });
      } catch (notifErr) {
        securityLogger.error('signCaseShareInvite: notificación in-app', notifErr);
      }
    }
    const emails: string[] = [invite.ownerDoctor.user.email, invite.invitedDoctor.user.email].filter(
      (e): e is string => Boolean(e)
    );
    for (const to of emails) {
      const label =
        to === invite.ownerDoctor.user.email
          ? `${invite.ownerDoctor.user.firstName} ${invite.ownerDoctor.user.lastName}`
          : `${invite.invitedDoctor.user.firstName} ${invite.invitedDoctor.user.lastName}`;
      try {
        await sendCaseShareSignedWithPdf({
          to,
          doctorLabel: label,
          patientName,
          caseLabel: invite.clinicalCase.padecimiento,
          pdfBuffer: pdfBuffer && pdfBuffer.length > 0 ? pdfBuffer : null
        });
      } catch (emailErr) {
        securityLogger.error('signCaseShareInvite: correo a doctor', emailErr);
      }
    }
    const patientConsentEmail = invite.patient.user.email || invite.patient.email || '';
    if (patientConsentEmail) {
      try {
        await sendCaseShareSignedCopyToPatient({
          to: patientConsentEmail,
          patientName,
          caseLabel: invite.clinicalCase.padecimiento,
          ownerDoctorName: `${invite.ownerDoctor.user.firstName} ${invite.ownerDoctor.user.lastName}`.trim(),
          invitedDoctorName: `${invite.invitedDoctor.user.firstName} ${invite.invitedDoctor.user.lastName}`.trim(),
          pdfBuffer: pdfBuffer && pdfBuffer.length > 0 ? pdfBuffer : null
        });
      } catch (emailErr) {
        securityLogger.error('signCaseShareInvite: correo a paciente', emailErr);
      }
    } else {
      securityLogger.warn(
        `signCaseShareInvite: paciente sin email para copia de consentimiento (inviteId=${invite.id}, patientId=${invite.patientId})`
      );
    }
    return res.json({
      success: true,
      message: 'Consentimiento registrado. El profesional invitado ya puede colaborar en este caso.',
      redirectUrl: `${frontendBase()}/dashboard/medical-records`
    });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'El colaborador ya estaba vinculado a este caso' });
    }
    securityLogger.error('signCaseShareInvite', e);
    return res.status(500).json({ success: false, message: 'Error al registrar el consentimiento' });
  }
}
