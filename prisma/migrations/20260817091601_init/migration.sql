-- CreateTable
CREATE TABLE "VariantCache" (
    "variantId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "compareAtPrice" DOUBLE PRECISION,
    "inventoryQty" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "notAllowPromotion" BOOLEAN NOT NULL DEFAULT false,
    "publishedScope" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantCache_pkey" PRIMARY KEY ("variantId")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastFullSyncAt" TIMESTAMP(3),
    "lastCursor" TIMESTAMP(3),
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "variantCount" INTEGER NOT NULL DEFAULT 0,
    "blankSkuCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateSkuCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckRun" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedFileName" TEXT,
    "fileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalSheets" INTEGER NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "totalPrograms" INTEGER NOT NULL,
    "countCritical" INTEGER NOT NULL DEFAULT 0,
    "countDanger" INTEGER NOT NULL DEFAULT 0,
    "countWarn" INTEGER NOT NULL DEFAULT 0,
    "catalogSyncedAt" TIMESTAMP(3),

    CONSTRAINT "CheckRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sheetName" TEXT,
    "rowNumber" INTEGER,
    "programName" TEXT,
    "sku" TEXT,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleConfig" (
    "code" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL,
    "params" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleConfig_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "VariantCache_sku_idx" ON "VariantCache"("sku");

-- CreateIndex
CREATE INDEX "VariantCache_productId_idx" ON "VariantCache"("productId");

-- CreateIndex
CREATE INDEX "Finding_runId_severity_idx" ON "Finding"("runId", "severity");

-- CreateIndex
CREATE INDEX "Finding_runId_ruleCode_idx" ON "Finding"("runId", "ruleCode");

-- CreateIndex
CREATE INDEX "Finding_runId_programName_idx" ON "Finding"("runId", "programName");

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
