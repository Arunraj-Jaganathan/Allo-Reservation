import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/route-errors";
import { releaseExpiredReservationsBatch, reservationPublic } from "@/lib/reservations";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await releaseExpiredReservationsBatch(25);
    const r = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
      },
    });
    if (!r) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({
      reservation: {
        ...reservationPublic(r),
        productSku: r.product.sku,
        productName: r.product.name,
        warehouseCode: r.warehouse.code,
        warehouseName: r.warehouse.name,
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
