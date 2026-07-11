-- AlterTable: Redes sociales del doctor (estaban en schema pero sin migración)
-- Facebook, Instagram, X (Twitter), Otra
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "socialMediaFacebook" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "socialMediaInstagram" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "socialMediaX" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "socialMediaOther" TEXT;
