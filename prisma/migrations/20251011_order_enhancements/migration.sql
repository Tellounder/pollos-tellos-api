-- ensure share coupon status enum exists
DO $$ BEGIN
  CREATE TYPE "ShareCouponStatus" AS ENUM ('ISSUED', 'ACTIVATED', 'REDEEMED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ensure share coupon table exists
DO $$ BEGIN
  CREATE TABLE "ShareCoupon" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid())::text,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "ShareCouponStatus" NOT NULL DEFAULT 'ISSUED',
    "metadata" JSONB,
    "activatedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedByEmail" TEXT,
    "redeemedByUserId" TEXT,
    "redeemedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareCoupon_pkey" PRIMARY KEY ("id")
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- indexes and base foreign key
DO $$ BEGIN
  CREATE UNIQUE INDEX "ShareCoupon_code_key" ON "ShareCoupon" ("code");
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShareCoupon"
  ADD CONSTRAINT "ShareCoupon_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- extra columns for orders
DO $$ BEGIN
  ALTER TABLE "Order"
  ADD COLUMN "metadata" JSONB;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order"
  ADD COLUMN "whatsappLink" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
