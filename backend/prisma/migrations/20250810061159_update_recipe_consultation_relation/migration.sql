-- DropForeignKey
ALTER TABLE "recetas_medicas" DROP CONSTRAINT "recetas_medicas_citaId_fkey";

-- AddForeignKey
ALTER TABLE "recetas_medicas" ADD CONSTRAINT "recetas_medicas_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "MedicalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
