-- Add external calendar metadata to internal calendar events
ALTER TABLE "InternalCalendarEvent"
ADD COLUMN "externalProvider" TEXT,
ADD COLUMN "externalEventId" TEXT,
ADD COLUMN "externalUpdatedAt" TIMESTAMP(3);

CREATE INDEX "InternalCalendarEvent_doctorId_externalProvider_externalEventId_idx"
ON "InternalCalendarEvent"("doctorId", "externalProvider", "externalEventId");

