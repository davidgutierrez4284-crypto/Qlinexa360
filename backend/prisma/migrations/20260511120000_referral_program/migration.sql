-- Programa de referidos: código propio, referidor, saldo % y conversiones

ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "referralCode" TEXT;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "referralCreditPercent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "referrerDoctorId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Doctor_referralCode_key" ON "Doctor"("referralCode");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Doctor_referrerDoctorId_fkey'
  ) THEN
    ALTER TABLE "Doctor"
      ADD CONSTRAINT "Doctor_referrerDoctorId_fkey"
      FOREIGN KEY ("referrerDoctorId") REFERENCES "Doctor"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "referral_conversions" (
    "id" TEXT NOT NULL,
    "referrerDoctorId" TEXT NOT NULL,
    "referredDoctorId" TEXT NOT NULL,
    "percentGranted" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "referral_conversions_referredDoctorId_key" ON "referral_conversions"("referredDoctorId");
CREATE INDEX IF NOT EXISTS "referral_conversions_referrerDoctorId_idx" ON "referral_conversions"("referrerDoctorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_conversions_referrerDoctorId_fkey'
  ) THEN
    ALTER TABLE "referral_conversions"
      ADD CONSTRAINT "referral_conversions_referrerDoctorId_fkey"
      FOREIGN KEY ("referrerDoctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_conversions_referredDoctorId_fkey'
  ) THEN
    ALTER TABLE "referral_conversions"
      ADD CONSTRAINT "referral_conversions_referredDoctorId_fkey"
      FOREIGN KEY ("referredDoctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
