-- CreateTable
CREATE TABLE "InternalCalendarEvent" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT,
    "fechaHoraInicio" TIMESTAMP(3) NOT NULL,
    "fechaHoraFin" TIMESTAMP(3) NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "origenEvento" TEXT NOT NULL DEFAULT 'interno',
    "linkMeeting" TEXT,
    "creadoPor" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalCalendarEvent_doctorId_idx" ON "InternalCalendarEvent"("doctorId");

-- CreateIndex
CREATE INDEX "InternalCalendarEvent_patientId_idx" ON "InternalCalendarEvent"("patientId");

-- CreateIndex
CREATE INDEX "InternalCalendarEvent_fechaHoraInicio_idx" ON "InternalCalendarEvent"("fechaHoraInicio");

-- CreateIndex
CREATE INDEX "InternalCalendarEvent_origenEvento_idx" ON "InternalCalendarEvent"("origenEvento");

-- AddForeignKey
ALTER TABLE "InternalCalendarEvent" ADD CONSTRAINT "InternalCalendarEvent_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalCalendarEvent" ADD CONSTRAINT "InternalCalendarEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalCalendarEvent" ADD CONSTRAINT "InternalCalendarEvent_creadoPor_fkey" FOREIGN KEY ("creadoPor") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
