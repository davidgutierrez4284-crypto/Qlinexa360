import prisma from '../config/database';
import { AffiliateAuditAction } from '../constants/affiliate.constants';

/**
 * Registro de audit trail del módulo de afiliados.
 * Fire-and-forget: nunca debe romper el flujo principal (try/catch + warn).
 */
export async function recordAffiliateAudit(params: {
  actorUserId?: string | null;
  action: AffiliateAuditAction | string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.affiliateAuditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: (params.metadata ?? undefined) as any
      }
    });
  } catch (e) {
    console.warn('[AffiliateAudit] no se pudo registrar:', e);
  }
}
