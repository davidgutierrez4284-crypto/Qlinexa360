-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AffiliateReferralStatus" AS ENUM ('REGISTERED', 'TRIAL', 'ACTIVE_PAID', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AffiliateCodeStatus" AS ENUM ('AVAILABLE', 'ASSIGNED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'AFFILIATE';

-- CreateTable
CREATE TABLE "affiliate_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "affiliateCode" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "country" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultCommissionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "defaultCommissionMonths" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_bank_accounts" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "beneficiaryFullName" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "clabe" TEXT,
    "accountNumber" TEXT,
    "swiftBic" TEXT,
    "iban" TEXT,
    "localBankCode" TEXT,
    "bankAddress" TEXT,
    "beneficiaryAddress" TEXT,
    "preferredCurrency" TEXT NOT NULL,
    "additionalInstructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_referrals" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "doctorEmail" TEXT NOT NULL,
    "doctorName" TEXT,
    "affiliateCodeUsed" TEXT NOT NULL,
    "registrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialDaysGranted" INTEGER NOT NULL DEFAULT 45,
    "firstPaymentDate" TIMESTAMP(3),
    "status" "AffiliateReferralStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commission_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commissionPercentage" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "commissionMonths" INTEGER NOT NULL DEFAULT 6,
    "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.16,
    "freeMonthsForDoctor" INTEGER NOT NULL DEFAULT 1,
    "graceDaysForDoctor" INTEGER NOT NULL DEFAULT 15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "doctorUserId" TEXT NOT NULL,
    "affiliateReferralId" TEXT NOT NULL,
    "paypalPaymentId" TEXT NOT NULL,
    "paypalSubscriptionId" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "commissionMonthNumber" INTEGER NOT NULL,
    "paymentAmountGross" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL,
    "paymentAmountNet" DECIMAL(12,2) NOT NULL,
    "commissionPercentage" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "calculationTraceJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidByAdminUserId" TEXT,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paypal_webhook_events" (
    "id" TEXT NOT NULL,
    "paypalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paypal_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "AffiliateCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "affiliateId" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_profiles_userId_key" ON "affiliate_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_profiles_affiliateCode_key" ON "affiliate_profiles"("affiliateCode");

-- CreateIndex
CREATE INDEX "affiliate_profiles_status_idx" ON "affiliate_profiles"("status");

-- CreateIndex
CREATE INDEX "affiliate_bank_accounts_affiliateId_idx" ON "affiliate_bank_accounts"("affiliateId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_referrals_doctorUserId_key" ON "affiliate_referrals"("doctorUserId");

-- CreateIndex
CREATE INDEX "affiliate_referrals_affiliateId_idx" ON "affiliate_referrals"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_referrals_status_idx" ON "affiliate_referrals"("status");

-- CreateIndex
CREATE INDEX "affiliate_commission_rules_isActive_idx" ON "affiliate_commission_rules"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commissions_paypalPaymentId_key" ON "affiliate_commissions"("paypalPaymentId");

-- CreateIndex
CREATE INDEX "affiliate_commissions_affiliateId_idx" ON "affiliate_commissions"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_commissions_doctorUserId_idx" ON "affiliate_commissions"("doctorUserId");

-- CreateIndex
CREATE INDEX "affiliate_commissions_status_idx" ON "affiliate_commissions"("status");

-- CreateIndex
CREATE INDEX "affiliate_commissions_paymentDate_idx" ON "affiliate_commissions"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "paypal_webhook_events_paypalEventId_key" ON "paypal_webhook_events"("paypalEventId");

-- CreateIndex
CREATE INDEX "paypal_webhook_events_eventType_idx" ON "paypal_webhook_events"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_codes_code_key" ON "affiliate_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_codes_affiliateId_key" ON "affiliate_codes"("affiliateId");

-- CreateIndex
CREATE INDEX "affiliate_codes_status_idx" ON "affiliate_codes"("status");

-- CreateIndex
CREATE INDEX "affiliate_codes_batchId_idx" ON "affiliate_codes"("batchId");

-- CreateIndex
CREATE INDEX "affiliate_audit_logs_action_idx" ON "affiliate_audit_logs"("action");

-- CreateIndex
CREATE INDEX "affiliate_audit_logs_createdAt_idx" ON "affiliate_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "affiliate_profiles" ADD CONSTRAINT "affiliate_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_bank_accounts" ADD CONSTRAINT "affiliate_bank_accounts_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliateReferralId_fkey" FOREIGN KEY ("affiliateReferralId") REFERENCES "affiliate_referrals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_paidByAdminUserId_fkey" FOREIGN KEY ("paidByAdminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_codes" ADD CONSTRAINT "affiliate_codes_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
