-- Pending migration: ensure to run `npx prisma migrate dev --name order_item_snapshots`
CREATE TABLE "public"."OrderItemSnapshot" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productKey" TEXT,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "side" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."OrderItemSnapshot"
ADD CONSTRAINT "OrderItemSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "OrderItemSnapshot_orderId_idx" ON "public"."OrderItemSnapshot" ("orderId");
