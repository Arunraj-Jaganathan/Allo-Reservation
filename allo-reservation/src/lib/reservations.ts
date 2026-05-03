import { Prisma, Reservation, ReservationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { InsufficientStockError, NotFoundError } from "@/lib/errors";
import type { ReserveBody } from "@/lib/validation";

export type DbTx = Prisma.TransactionClient;

export const RESERVATION_TTL_MS = 10 * 60 * 1000;

function now() {
  return new Date();
}

export function reservationExpiresAt(from = now()) {
  return new Date(from.getTime() + RESERVATION_TTL_MS);
}

export function reservationPublic(r: {
  id: string;
  productId: string;
  warehouseId: string;
  qty: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: r.id,
    productId: r.productId,
    warehouseId: r.warehouseId,
    qty: r.qty,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

/* =========================
   INVENTORY LOCK + RESERVE
========================= */
export async function reserveUnits(tx: DbTx, input: ReserveBody) {
  const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id"
    FROM "Inventory"
    WHERE "productId" = ${input.productId}
      AND "warehouseId" = ${input.warehouseId}
    FOR UPDATE
  `);

  if (!locked.length) {
    throw new NotFoundError("Inventory row");
  }

  const inv = await tx.inventory.findUniqueOrThrow({
    where: {
      productId_warehouseId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
  });

  const available = inv.totalUnits - inv.reservedUnits;

  if (available < input.qty) {
    throw new InsufficientStockError();
  }

  await tx.inventory.update({
    where: { id: inv.id },
    data: { reservedUnits: { increment: input.qty } },
  });

  return await tx.reservation.create({
    data: {
      productId: input.productId,
      warehouseId: input.warehouseId,
      qty: input.qty,
      status: ReservationStatus.PENDING,
      expiresAt: reservationExpiresAt(),
    },
  });
}

/* =========================
   CONFIRM RESERVATION
========================= */
export async function confirmReservation(tx: DbTx, reservationId: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "Reservation"
    WHERE "id" = ${reservationId}
    FOR UPDATE
  `);

  const r = await tx.reservation.findUnique({ where: { id: reservationId } });
  if (!r) throw new NotFoundError("Reservation");

  if (r.status !== ReservationStatus.PENDING) {
    return { kind: "already_terminal", reservation: r };
  }

  const nowTime = now();

  if (r.expiresAt <= nowTime) {
    return await expire(tx, r);
  }

  await tx.inventory.update({
    where: {
      productId_warehouseId: {
        productId: r.productId,
        warehouseId: r.warehouseId,
      },
    },
    data: {
      reservedUnits: { decrement: r.qty },
      totalUnits: { decrement: r.qty },
    },
  });

  return {
    kind: "confirmed",
    reservation: await tx.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.CONFIRMED },
    }),
  };
}

/* =========================
   RELEASE RESERVATION
========================= */
export async function releaseReservation(tx: DbTx, reservationId: string) {
  const r = await tx.reservation.findUnique({ where: { id: reservationId } });
  if (!r) throw new NotFoundError("Reservation");

  if (r.status !== ReservationStatus.PENDING) {
    return { kind: "noop", reservation: r };
  }

  await tx.inventory.update({
    where: {
      productId_warehouseId: {
        productId: r.productId,
        warehouseId: r.warehouseId,
      },
    },
    data: { reservedUnits: { decrement: r.qty } },
  });

  return {
    kind: "released",
    reservation: await tx.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.RELEASED },
    }),
  };
}

/* =========================
   EXPIRE FUNCTION
========================= */
async function expire(tx: DbTx, r: Reservation) {
  await tx.inventory.update({
    where: {
      productId_warehouseId: {
        productId: r.productId,
        warehouseId: r.warehouseId,
      },
    },
    data: { reservedUnits: { decrement: r.qty } },
  });

  return {
    kind: "expired",
    reservation: await tx.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.EXPIRED },
    }),
  };
}

/* =========================
   CLEANUP JOB
========================= */
export async function releaseExpiredReservationsBatch(limit = 100) {
  const expired = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.PENDING,
      expiresAt: { lt: now() },
    },
    take: limit,
  });

  for (const r of expired) {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.reservation.findUnique({ where: { id: r.id } });
      if (!fresh || fresh.status !== ReservationStatus.PENDING) return;
      if (fresh.expiresAt > now()) return;
      await expire(tx, fresh);
    });
  }

  return { scanned: expired.length };
}