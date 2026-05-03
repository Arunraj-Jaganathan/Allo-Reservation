import { NextResponse } from "next/server";
import { getWarehouses } from "@/lib/catalog";
import { jsonError } from "@/lib/route-errors";

export async function GET() {
  try {
    const warehouses = await getWarehouses();
    return NextResponse.json({
      warehouses: warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
