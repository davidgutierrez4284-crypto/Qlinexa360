-- AlterTable: Añadir pdfUrl a ConsentHistory (nullable, no afecta datos existentes)
ALTER TABLE "ConsentHistory" ADD COLUMN "pdfUrl" TEXT;

-- AlterTable: Añadir purpose a PasswordResetToken (nullable, default para compatibilidad)
ALTER TABLE "password_reset_tokens" ADD COLUMN "purpose" TEXT DEFAULT 'password_reset';
