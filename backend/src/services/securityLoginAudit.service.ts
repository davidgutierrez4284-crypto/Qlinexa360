import prisma from '../config/database';
import { hashEmail, maskIp } from '../utils/auditEvidenceMask.utils';

export async function recordSecurityLoginAudit(params: {
  userId?: string | null;
  email?: string | null;
  success: boolean;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  try {
    await prisma.securityLoginAudit.create({
      data: {
        userId: params.userId || null,
        emailHash: hashEmail(params.email || undefined),
        success: params.success,
        ipMasked: maskIp(params.ip || undefined),
        userAgent: params.userAgent ? params.userAgent.slice(0, 500) : null,
      },
    });
  } catch (e) {
    console.warn('[SecurityLoginAudit] no se pudo registrar:', e);
  }
}
