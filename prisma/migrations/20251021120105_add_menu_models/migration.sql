-- CreateTable
CREATE TABLE "public"."MenuCategory" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "heroTitle" TEXT,
    "heroSubtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MenuItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "categoryId" TEXT NOT NULL,
    "productId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "badgeLabel" TEXT,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "originalPrice" DECIMAL(10,2),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "requiresSide" BOOLEAN NOT NULL DEFAULT false,
    "isShareable" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MenuItemOption" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "priceModifier" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MenuItemOption_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "MenuCategory_slug_key" ON "public"."MenuCategory"("slug");
CREATE INDEX "MenuCategory_sortOrder_idx" ON "public"."MenuCategory"("sortOrder");

CREATE UNIQUE INDEX "MenuItem_slug_key" ON "public"."MenuItem"("slug");
CREATE INDEX "MenuItem_categoryId_sortOrder_idx" ON "public"."MenuItem"("categoryId", "sortOrder");
CREATE INDEX "MenuItem_isVisible_sortOrder_idx" ON "public"."MenuItem"("isVisible", "sortOrder");

CREATE INDEX "MenuItemOption_itemId_sortOrder_idx" ON "public"."MenuItemOption"("itemId", "sortOrder");

-- Foreign Keys
ALTER TABLE "public"."MenuItem"
  ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."MenuItem"
  ADD CONSTRAINT "MenuItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."MenuItemOption"
  ADD CONSTRAINT "MenuItemOption_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
