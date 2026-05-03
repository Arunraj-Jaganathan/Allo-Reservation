import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256Hex, stableStringify } from "@/lib/hash";
import { readOrBeginIdempotency, writeIdempotency } from "@/lib/idempotency";
import { jsonError } from "@/lib/route-errors";
import { confirmReservation, reservationPublic } from "@/lib/reservations";

function routeFor(id: string) {
  return `/api/reservations/${id}/confirm`;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;

    const idem = req.headers.get("idempotency-key")?.trim() || null;

    const requestHash = sha256Hex(
      stableStringify({ reservationId: id })
    );

    const res = await prisma.$transaction(async (tx) => {
      const route = routeFor(id);

      // STEP 1: IDEMPOTENCY CHECK
      if (idem) {
        const cached = await readOrBeginIdempotency(
          tx,
          idem,
          route,
          requestHash
        );

        if (cached.hit) {
          return {
            httpStatus: cached.statusCode,
            body: cached.body,
          };
        }
      }

      // STEP 2: BUSINESS LOGIC
      const outcome = await confirmReservation(tx, id);

      let httpStatus: number;
      let body: Record<string, unknown>;

      switch (outcome.kind) {
        case "confirmed":
        case "already_confirmed":
          httpStatus = 200;
          body = {
            reservation: reservationPublic(outcome.reservation),
          };
          break;

        case "expired_now":
        case "already_expired":
          httpStatus = 410;
          body = {
            error: "RESERVATION_EXPIRED",
            message: "Reservation has expired.",
            reservation: reservationPublic(outcome.reservation),
          };
          break;

        case "released":
          httpStatus = 409;
          body = {
            error: "RESERVATION_NOT_PENDING",
            message: "Reservation was cancelled.",
            reservation: reservationPublic(outcome.reservation),
          };
          break;

        // SAFE EXHAUSTIVE CHECK (FIXED)
        default: {
          const _exhaustiveCheck: never = outcome.kind as never;
          throw new Error(
            `Unhandled outcome kind: ${_exhaustiveCheck}`
          );
        }
      }

      // STEP 3: WRITE IDEMPOTENCY
      if (idem) {
        await writeIdempotency(
          tx,
          idem,
          route,
          requestHash,
          httpStatus,
          body
        );
      }

      return { httpStatus, body };
    });

    return NextResponse.json(res.body, {
      status: res.httpStatus,
    });
  } catch (e) {
    return jsonError(e);
  }
}