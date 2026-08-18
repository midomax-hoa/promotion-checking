-- CreateTable
CREATE TABLE "ReconcileMatch" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "programName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "excelRowCount" INTEGER,
    "excelDiscountType" TEXT,
    "excelValue" DOUBLE PRECISION,
    "excelStartAt" TIMESTAMP(3),
    "excelEndAt" TIMESTAMP(3),
    "haravanId" TEXT,
    "haravanTakeType" TEXT,
    "haravanValue" DOUBLE PRECISION,
    "haravanStartAt" TIMESTAMP(3),
    "haravanEndAt" TIMESTAMP(3),
    "haravanStatus" TEXT,
    "haravanVariantCount" INTEGER,
    "haravanByProduct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReconcileMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconcileMatch_runId_programName_idx" ON "ReconcileMatch"("runId", "programName");

-- AddForeignKey
ALTER TABLE "ReconcileMatch" ADD CONSTRAINT "ReconcileMatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
