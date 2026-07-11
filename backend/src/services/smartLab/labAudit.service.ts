import prisma from '../../config/database';
import { LabAuditAction } from '@prisma/client';

export async function recordLabAudit(params: {
  actorUserId?: string | null;
  patientId?: string | null;
  labReportId?: string | null;
  action: LabAuditAction;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.labAuditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        patientId: params.patientId ?? null,
        labReportId: params.labReportId ?? null,
        action: params.action,
        metadata: (params.metadata ?? undefined) as object | undefined,
      },
    });
  } catch (e) {
    console.warn('[LabAudit] no se pudo registrar:', e);
  }
}

export function recordLabAuditFireAndForget(params: Parameters<typeof recordLabAudit>[0]): void {
  void recordLabAudit(params);
}
