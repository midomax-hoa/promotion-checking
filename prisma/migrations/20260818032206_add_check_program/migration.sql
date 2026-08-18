-- CreateTable
CREATE TABLE "CheckProgram" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "countCritical" INTEGER NOT NULL DEFAULT 0,
    "countDanger" INTEGER NOT NULL DEFAULT 0,
    "countWarn" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CheckProgram_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckProgram_runId_name_key" ON "CheckProgram"("runId", "name");

-- AddForeignKey
ALTER TABLE "CheckProgram" ADD CONSTRAINT "CheckProgram_runId_fkey" FOREIGN KEY ("runId") REFERENCES "CheckRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
