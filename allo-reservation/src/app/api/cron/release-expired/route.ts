import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredReservationsBatch } from "@/lib/reservations";

function authorize(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.headers.get("x-cron-secret") === secret;
}

/** Called by Vercel Cron (or any scheduler) to return held stock from expired checkouts. */
export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await releaseExpiredReservationsBatch(200);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
