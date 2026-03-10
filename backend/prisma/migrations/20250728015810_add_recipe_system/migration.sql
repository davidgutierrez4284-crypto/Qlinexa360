-- CreateTable
CREATE TABLE "doctor_recipe_templates" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "camposEditables" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_recipe_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas_medicas" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "citaId" TEXT,
    "archivoPdf" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "esRecetaMedicamento" BOOLEAN NOT NULL DEFAULT true,
    "esSolicitudEstudios" BOOLEAN NOT NULL DEFAULT false,
    "realizadoPor" TEXT,
    "vinculadoADoctor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recetas_medicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_detalle_medicamentos" (
    "id" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "medicamento" TEXT NOT NULL,
    "dosis" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "duracion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receta_detalle_medicamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_estudios_solicitados" (
    "id" TEXT NOT NULL,
    "recetaId" TEXT NOT NULL,
    "nombreEstudio" TEXT NOT NULL,
    "indicaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receta_estudios_solicitados_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "doctor_recipe_templates" ADD CONSTRAINT "doctor_recipe_templates_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_medicas" ADD CONSTRAINT "recetas_medicas_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_medicas" ADD CONSTRAINT "recetas_medicas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas_medicas" ADD CONSTRAINT "recetas_medicas_citaId_fkey" FOREIGN KEY ("citaId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_detalle_medicamentos" ADD CONSTRAINT "receta_detalle_medicamentos_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "recetas_medicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_estudios_solicitados" ADD CONSTRAINT "receta_estudios_solicitados_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "recetas_medicas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
