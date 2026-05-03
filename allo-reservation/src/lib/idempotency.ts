import { Prisma } from "@prisma/client";
import type { DbTx } from "@/lib/reservations";
import { IdempotencyConflictError } from "@/lib/errors";
import { sha256Hex } from "@/lib/hash";

function mutexKeyFor(route: string, idemKey: string) {
  return sha256Hex(`${route}:${idemKey}`).slice(0, 64);
}

/**
 * STEP 1: lock + detect duplicate request
 */
export async function readOrBeginIdempotency(
  tx: DbTx,
  idemKey: string,
  route: string,
  requestHash: string,
): Promise<{ hit: true; statusCode: number; body: unknown } | { hit: false }> {

  const mutexKey = mutexKeyFor(route, idemKey);

  await tx.$queryRaw(Prisma.sql`
    SELECT "mutexKey"
    FROM idempotency_mutex
    WHERE "mutexKey" = ${mutexKey}
    FOR UPDATE
  `);

  const existing = await tx.idempotencyRecord.findUnique({
    where: {
      key_route: { key: idemKey, route },
    },
  });

  if (!existing) return { hit: false };

  if (existing.requestHash !== requestHash) {
    throw new IdempotencyConflictError();
  }

  return {
    hit: true,
    statusCode: existing.statusCode,
    body: existing.body,
  };
}

/**
 * STEP 2: store successful response
 */
export async function writeIdempotency(
  tx: DbTx,
  idemKey: string,
  route: string,
  requestHash: string,
  statusCode: number,
  body: unknown,
) {
  await tx.idempotencyRecord.create({
    data: {
      key: idemKey,
      route,
      requestHash,
      statusCode,
      body: body as Prisma.InputJsonValue,
    },
  });
}