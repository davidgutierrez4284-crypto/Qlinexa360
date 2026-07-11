-- Slug amigable para enlace permanente de pre-consulta (/pre-consulta/nombre-apellido)
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "intakePortalSlug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_intakePortalSlug_key" ON "Doctor"("intakePortalSlug");
