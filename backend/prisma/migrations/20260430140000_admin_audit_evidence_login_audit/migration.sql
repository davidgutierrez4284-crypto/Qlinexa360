-- Evidencia de auditoría (HU-01) y trazas de login anonimizables
CREATE TABLE "security_login_audits" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailHash" TEXT,
    "success" BOOLEAN NOT NULL,
    "ipMasked" TEXT,
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_login_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_login_audits_createdAt_idx" ON "security_login_audits"("createdAt");
CREATE INDEX "security_login_audits_userId_idx" ON "security_login_audits"("userId");

ALTER TABLE "security_login_audits" ADD CONSTRAINT "security_login_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "admin_audit_evidence_exports" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "categoriesJson" TEXT NOT NULL,
    "daysBack" INTEGER NOT NULL,
    "rowCountsJson" TEXT NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_evidence_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_evidence_exports_adminUserId_idx" ON "admin_audit_evidence_exports"("adminUserId");
CREATE INDEX "admin_audit_evidence_exports_createdAt_idx" ON "admin_audit_evidence_exports"("createdAt");

ALTER TABLE "admin_audit_evidence_exports" ADD CONSTRAINT "admin_audit_evidence_exports_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
