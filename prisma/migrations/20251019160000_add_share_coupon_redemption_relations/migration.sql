-- Add redemption tracking columns to share coupons
DO $$ BEGIN
  ALTER TABLE "ShareCoupon"
    ADD COLUMN "redeemedByEmail" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShareCoupon"
    ADD COLUMN "redeemedByUserId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShareCoupon"
    ADD COLUMN "redeemedOrderId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Link redeemed share coupons to the user who redeemed it
DO $$ BEGIN
  ALTER TABLE "ShareCoupon"
    ADD CONSTRAINT "ShareCoupon_redeemedByUserId_fkey"
        FOREIGN KEY ("redeemedByUserId")
        REFERENCES "User"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Link to the order that consumed the share coupon
DO $$ BEGIN
  ALTER TABLE "ShareCoupon"
    ADD CONSTRAINT "ShareCoupon_redeemedOrderId_fkey"
        FOREIGN KEY ("redeemedOrderId")
        REFERENCES "Order"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
