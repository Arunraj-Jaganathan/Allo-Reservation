import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sha256Hex, stableStringify } from "@/lib/hash";
import { readOrBeginIdempotency, writeIdempotency } from "@/lib/idempotency";
import { jsonError } from "@/lib/route-errors";
import { reservationPublic, reserveUnits } from "@/lib/reservations";
import { reserveBodySchema } from "@/lib/validation";

const ROUTE = "/api/reservations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = reserveBodySchema.parse(body);
    const idem = req.headers.get("idempotency-key")?.trim() || null;
    const requestHash = sha256Hex(stableStringify(parsed));

    const result = await prisma.$transaction(
      async (tx) => {
        if (idem) {
          const cached = await readOrBeginIdempotency(tx, idem, ROUTE, requestHash);
          if (cached.hit) {
            return { status: cached.statusCode, body: cached.body };
          }
        }

        const reservation = await reserveUnits(tx, parsed);
        const responseBody = { reservation: reservationPublic(reservation) };
        const status = 201;

        if (idem) {
          await writeIdempotency(tx, idem, ROUTE, requestHash, status, responseBody);
        }

        return { status, body: responseBody };
      },
      { timeout: 15000 } // ← increase from default 5000ms to 15000ms
    );

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    return jsonError(e);
  }
}