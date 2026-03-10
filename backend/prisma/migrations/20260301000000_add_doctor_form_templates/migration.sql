-- CreateTable
CREATE TABLE "doctor_form_templates" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_form_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_form_template_fields" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_form_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_form_data" (
    "id" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_form_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_form_templates_doctorId_name_key" ON "doctor_form_templates"("doctorId", "name");

-- CreateIndex
CREATE INDEX "doctor_form_templates_doctorId_idx" ON "doctor_form_templates"("doctorId");

-- CreateIndex
CREATE INDEX "doctor_form_template_fields_templateId_idx" ON "doctor_form_template_fields"("templateId");

-- CreateIndex
CREATE INDEX "doctor_form_data_medicalRecordId_idx" ON "doctor_form_data"("medicalRecordId");

-- CreateIndex
CREATE INDEX "doctor_form_data_patientId_idx" ON "doctor_form_data"("patientId");

-- CreateIndex
CREATE INDEX "doctor_form_data_templateId_idx" ON "doctor_form_data"("templateId");

-- CreateIndex
CREATE INDEX "doctor_form_data_doctorId_idx" ON "doctor_form_data"("doctorId");

-- AddForeignKey
ALTER TABLE "doctor_form_templates" ADD CONSTRAINT "doctor_form_templates_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_form_template_fields" ADD CONSTRAINT "doctor_form_template_fields_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "doctor_form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_form_data" ADD CONSTRAINT "doctor_form_data_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "doctor_form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
