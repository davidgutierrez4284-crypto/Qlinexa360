-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "invitationToken" TEXT,
ADD COLUMN     "invitationTokenExpires" TIMESTAMP(3),
ADD COLUMN     "isRegistrationComplete" BOOLEAN NOT NULL DEFAULT false;
