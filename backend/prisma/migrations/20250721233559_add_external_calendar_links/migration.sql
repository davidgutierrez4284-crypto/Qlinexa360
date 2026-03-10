-- CreateTable
CREATE TABLE "ExternalCalendarLink" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "tipoConexion" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "calendarioId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaVinculacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalCalendarLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalCalendarLink_doctorId_idx" ON "ExternalCalendarLink"("doctorId");

-- CreateIndex
CREATE INDEX "ExternalCalendarLink_tipoConexion_idx" ON "ExternalCalendarLink"("tipoConexion");

-- CreateIndex
CREATE INDEX "ExternalCalendarLink_activo_idx" ON "ExternalCalendarLink"("activo");

-- AddForeignKey
ALTER TABLE "ExternalCalendarLink" ADD CONSTRAINT "ExternalCalendarLink_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
