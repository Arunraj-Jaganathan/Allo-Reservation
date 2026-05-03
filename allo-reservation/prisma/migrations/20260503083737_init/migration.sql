/*
  Warnings:

  - You are about to drop the `idempotency_mutex` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "IdempotencyRecord_createdAt_idx";

-- DropIndex
DROP INDEX "Inventory_productId_idx";

-- DropIndex
DROP INDEX "Inventory_warehouseId_idx";

-- DropIndex
DROP INDEX "Reservation_productId_warehouseId_idx";

-- DropIndex
DROP INDEX "Reservation_status_expiresAt_idx";

-- DropTable
DROP TABLE "idempotency_mutex";

-- CreateTable
CREATE TABLE "IdempotencyMutex" (
    "mutexKey" TEXT NOT NULL,

    CONSTRAINT "IdempotencyMutex_pkey" PRIMARY KEY ("mutexKey")
);
