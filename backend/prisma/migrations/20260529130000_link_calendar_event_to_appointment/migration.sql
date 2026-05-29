-- AddColumn: vínculo duro entre InternalCalendarEvent y Appointment
ALTER TABLE "InternalCalendarEvent" ADD COLUMN "appointmentId" TEXT;

-- CreateIndex: un evento interno como máximo por cita
CREATE UNIQUE INDEX "InternalCalendarEvent_appointmentId_key" ON "InternalCalendarEvent"("appointmentId");

-- AddForeignKey
ALTER TABLE "InternalCalendarEvent" ADD CONSTRAINT "InternalCalendarEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
