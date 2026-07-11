-- CreateEnum
CREATE TYPE "ClinicalCaseShareInviteStatus" AS ENUM ('PENDING_CONSENT', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "clinical_case_share_invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clinicalCaseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "invitedDoctorId" TEXT NOT NULL,
    "ownerDoctorId" TEXT NOT NULL,
    "status" "ClinicalCaseShareInviteStatus" NOT NULL DEFAULT 'PENDING_CONSENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signedIp" TEXT,
    "signatureText" TEXT,
    "consentPdfUrl" TEXT,
    "consentDocumentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_case_share_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinical_case_share_invites_token_key" ON "clinical_case_share_invites"("token");
CREATE INDEX "clinical_case_share_invites_clinicalCaseId_status_idx" ON "clinical_case_share_invites"("clinicalCaseId", "status");
CREATE INDEX "clinical_case_share_invites_patientId_idx" ON "clinical_case_share_invites"("patientId");

-- AddForeignKey
ALTER TABLE "clinical_case_share_invites" ADD CONSTRAINT "clinical_case_share_invites_clinicalCaseId_fkey" FOREIGN KEY ("clinicalCaseId") REFERENCES "ClinicalCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_case_share_invites" ADD CONSTRAINT "clinical_case_share_invites_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_case_share_invites" ADD CONSTRAINT "clinical_case_share_invites_invitedDoctorId_fkey" FOREIGN KEY ("invitedDoctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_case_share_invites" ADD CONSTRAINT "clinical_case_share_invites_ownerDoctorId_fkey" FOREIGN KEY ("ownerDoctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
