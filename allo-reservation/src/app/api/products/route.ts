import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { jsonError } from "@/lib/route-errors";

export async function GET() {
  try {
    const products = await getCatalog();
    return NextResponse.json({ products });
  } catch (e) {
    return jsonError(e);
  }
}
