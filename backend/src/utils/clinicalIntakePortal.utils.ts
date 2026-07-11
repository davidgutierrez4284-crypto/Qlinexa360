import { PrismaClient } from '@prisma/client';

type DoctorUser = { firstName?: string | null; lastName?: string | null };

/** Slug público tipo agenda: nombre-apellido (sin títulos ni acentos). */
export function buildDoctorPublicSlug(user: DoctorUser): string {
  const cleanFirstName = (user.firstName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(dr\.?|doctor\.?|dra\.?|doctora\.?)\s*/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const cleanLastName = (user.lastName || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  const slug = [cleanFirstName, cleanLastName].filter(Boolean).join('-');
  return slug || 'profesional';
}

export async function ensureIntakePortalSlug(
  prismaClient: PrismaClient,
  doctor: {
    id: string;
    intakePortalSlug?: string | null;
    user?: DoctorUser | null;
  }
): Promise<string> {
  if (doctor.intakePortalSlug) return doctor.intakePortalSlug;

  const base = buildDoctorPublicSlug(doctor.user || {});
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const conflict = await prismaClient.doctor.findFirst({
      where: { intakePortalSlug: slug, NOT: { id: doctor.id } },
      select: { id: true }
    });
    if (!conflict) break;
    slug = `${base}-${suffix++}`;
  }

  await prismaClient.doctor.update({
    where: { id: doctor.id },
    data: { intakePortalSlug: slug }
  });
  return slug;
}

export function intakePortalPublicUrl(frontendUrl: string, slug: string): string {
  const base = frontendUrl.replace(/\/$/, '');
  return `${base}/pre-consulta/${slug}`;
}

export function resolveFrontendBaseUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.FRONTEND_URL || 'https://www.qlinexa360.com';
  }
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}
