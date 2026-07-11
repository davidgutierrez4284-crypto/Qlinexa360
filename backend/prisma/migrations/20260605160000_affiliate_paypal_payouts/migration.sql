-- Estatus intermedio para comisiones enviadas a PayPal Payouts (en proceso)
ALTER TYPE "AffiliateCommissionStatus" ADD VALUE 'PROCESSING';

-- Rastreo del payout de PayPal por comisión
ALTER TABLE "affiliate_commissions" ADD COLUMN     "payoutBatchId" TEXT,
ADD COLUMN     "payoutItemId" TEXT;
