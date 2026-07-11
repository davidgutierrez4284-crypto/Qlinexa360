-- Método de pago del afiliado (SPEI México | PAYPAL) + correo PayPal; banco opcional (PayPal no lo requiere)
ALTER TABLE "affiliate_bank_accounts" ADD COLUMN     "payoutMethod" TEXT NOT NULL DEFAULT 'SPEI',
ADD COLUMN     "paypalEmail" TEXT,
ALTER COLUMN "bankName" DROP NOT NULL;

-- Umbral mínimo de pago de comisiones (en MXN), configurable desde Admin
ALTER TABLE "affiliate_commission_rules" ADD COLUMN     "minPayoutAmountMxn" DECIMAL(12,2) NOT NULL DEFAULT 200;
