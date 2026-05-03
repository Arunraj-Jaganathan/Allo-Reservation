import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256Hex, stableStringify } from "@/lib/hash";
import { readOrBeginIdempotency, writeIdempotency } from "@/lib/idempotency";
import { jsonError } from "@/lib/route-errors";
import { releaseReservation, reservationPublic } from "@/lib/reservations";

function routeFor(id: string) {
  return `/api/reservations/${id}/release`;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const idem = req.headers.get("idempotency-key")?.trim() || null;
    const requestHash = sha256Hex(stableStringify({ reservationId: id }));

    const res = await prisma.$transaction(async (tx) => {
      const route = routeFor(id);
      if (idem) {
        const cached = await readOrBeginIdempotency(tx, idem, route, requestHash);
        if (cached.hit) {
          return { httpStatus: cached.statusCode, body: cached.body };
        }
      }

      const outcome = await releaseReservation(tx, id);
      const httpStatus = 200;
      const body: Record<string, unknown> = {
        reservation: reservationPublic(outcome.reservation),
        outcome: outcome.kind,
      };

      if (idem) {
        await writeIdempotency(tx, idem, route, requestHash, httpStatus, body);
      }

      return { httpStatus, body };
    });

    return NextResponse.json(res.body, { status: res.httpStatus });
  } catch (e) {
    return jsonError(e);
  }
}
