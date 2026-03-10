-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "certificadoEspecialidad" TEXT,
ADD COLUMN     "certificadoMaestria" TEXT,
ADD COLUMN     "certificadoProfesional" TEXT,
ADD COLUMN     "consultorioDireccion" TEXT,
ADD COLUMN     "consultorioTelefono" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "primaryColor" TEXT DEFAULT '#2563eb',
ADD COLUMN     "secondaryColor" TEXT DEFAULT '#1e40af';
