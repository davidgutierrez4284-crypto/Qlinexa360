import prisma from '../config/database';

export async function getVisibleDoctorPatientIdsForPatient(patientId: string): Promise<string[]> {
  const links = await prisma.doctorPatient.findMany({
    where: { patientId, clinicalHistoryVisibleToPatient: true },
    select: { id: true },
  });
  return links.map((l) => l.id);
}

export async function patientHasClinicalHistoryPortalAccess(patientId: string): Promise<boolean> {
  const count = await prisma.doctorPatient.count({
    where: { patientId, clinicalHistoryVisibleToPatient: true },
  });
  return count > 0;
}

export function parseClinicalHistoryVisibleFlag(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return undefined;
}
