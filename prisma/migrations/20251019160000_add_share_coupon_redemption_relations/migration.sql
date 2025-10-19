-- Add redemption tracking columns to share coupons
ALTER TABLE "ShareCoupon"
    ADD COLUMN "redeemedByEmail" TEXT,
    ADD COLUMN "redeemedByUserId" TEXT,
    ADD COLUMN "redeemedOrderId" TEXT;

-- Link redeemed share coupons to the user who los canjeó (si aplica)
ALTER TABLE "ShareCoupon"
    ADD CONSTRAINT "ShareCoupon_redeemedByUserId_fkey"
        FOREIGN KEY ("redeemedByUserId")
        REFERENCES "User"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;

-- Vincular al pedido que consumió el cupón compartido
ALTER TABLE "ShareCoupon"
    ADD CONSTRAINT "ShareCoupon_redeemedOrderId_fkey"
        FOREIGN KEY ("redeemedOrderId")
        REFERENCES "Order"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
