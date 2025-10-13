-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE IF NOT EXISTS 'PREPARING';

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ShareCouponStatus') THEN
        CREATE TYPE "public"."ShareCouponStatus" AS ENUM ('ISSUED', 'ACTIVATED', 'REDEEMED');
    END IF;
END$$;

-- AlterTable
ALTER TABLE "public"."OrderItemSnapshot"
ADD COLUMN "originalUnitPrice" DECIMAL(10,2),
ADD COLUMN "discountValue" DECIMAL(10,2);

-- CreateTable
ALTER TABLE "public"."Order"
ADD COLUMN "preparingAt" TIMESTAMP(3),
ADD COLUMN "fulfilledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."OrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorId" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."OrderMessage"
ADD CONSTRAINT "OrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "OrderMessage_orderId_idx" ON "public"."OrderMessage" ("orderId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "public"."ShareCoupon" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "public"."ShareCouponStatus" NOT NULL DEFAULT 'ISSUED',
    "metadata" JSONB,
    "activatedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShareCoupon_code_key" ON "public"."ShareCoupon"("code");
CREATE INDEX IF NOT EXISTS "ShareCoupon_user_month_idx" ON "public"."ShareCoupon"("userId", "year", "month");

ALTER TABLE "public"."ShareCoupon"
ADD CONSTRAINT "ShareCoupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
