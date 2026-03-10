/*
  Warnings:

  - Added the required column `clinicalEvolution` to the `MedicalRecord` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ClinicalEvolution" AS ENUM ('INITIAL_EVALUATION', 'CONFIRMED_DIAGNOSIS', 'TREATMENT_PLAN', 'FOLLOW_UP', 'STABILIZATION', 'MEDICAL_DISCHARGE', 'READMISSION');

-- AlterTable
ALTER TABLE "MedicalRecord" ADD COLUMN     "clinicalEvolution" "ClinicalEvolution" NOT NULL;
