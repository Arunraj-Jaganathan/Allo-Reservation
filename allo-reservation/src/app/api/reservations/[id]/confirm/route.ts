import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256Hex, stableStringify } from "@/lib/hash";
import { readOrBeginIdempotency, writeIdempotency } from "@/lib/idempotency";
import { jsonError } from "@/lib/route-errors";
import { confirmReservation, reservationPublic } from "@/lib/reservations";

function routeFor(id: string) {
  return `/api/reservations/${id}/confirm`;
}

type ConfirmKind =
  | "confirmed"
  | "already_confirmed"
  | "expired_now"
  | "already_expired"
  | "released";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const idem = req.headers.get("idempotency-key")?.trim() || null;
    const requestHash = sha256Hex(stableStringify({ reservationId: id }));

    const res = await prisma.$transaction(
      async (tx) => {
        const route = routeFor(id);

        if (idem) {
          const cached = await readOrBeginIdempotency(tx, idem, route, requestHash);
          if (cached.hit) {
            return { httpStatus: cached.statusCode, body: cached.body };
          }
        }

        const outcome = await confirmReservation(tx, id);
        const kind = outcome.kind as ConfirmKind;

        let httpStatus: number;
        let body: Record<string, unknown>;

        switch (kind) {
          case "confirmed":
          case "already_confirmed":
            httpStatus = 200;
            body = { reservation: reservationPublic(outcome.reservation) };
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

          default: {
            const _exhaustiveCheck: never = kind;
            throw new Error(`Unhandled outcome kind: ${_exhaustiveCheck}`);
          }
        }

        if (idem) {
          await writeIdempotency(tx, idem, route, requestHash, httpStatus, body);
        }

        return { httpStatus, body };
      },
      { timeout: 15000 }
    );

    return NextResponse.json(res.body, { status: res.httpStatus });
  } catch (e) {
    return jsonError(e);
  }
}