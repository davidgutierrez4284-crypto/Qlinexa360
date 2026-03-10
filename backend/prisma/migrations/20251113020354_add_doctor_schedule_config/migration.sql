-- CreateTable
CREATE TABLE "doctor_schedule_configs" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "appointmentDuration" INTEGER NOT NULL DEFAULT 30,
    "bufferTime" INTEGER NOT NULL DEFAULT 15,
    "weeklySchedule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_schedule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_schedule_configs_doctorId_key" ON "doctor_schedule_configs"("doctorId");

-- AddForeignKey
ALTER TABLE "doctor_schedule_configs" ADD CONSTRAINT "doctor_schedule_configs_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
