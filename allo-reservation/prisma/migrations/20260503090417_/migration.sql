/*
  Warnings:

  - You are about to drop the `IdempotencyMutex` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "IdempotencyMutex";

-- CreateTable
CREATE TABLE "idempotency_mutex" (
    "mutexKey" TEXT NOT NULL,

    CONSTRAINT "idempotency_mutex_pkey" PRIMARY KEY ("mutexKey")
);
