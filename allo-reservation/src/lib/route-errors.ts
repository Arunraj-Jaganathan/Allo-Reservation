import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "@/lib/errors";

export function jsonError(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json(
      { error: e.message, ...(e.body ?? {}) },
      { status: e.status },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: e.flatten() },
      { status: 400 },
    );
  }
  console.error(e);
  return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
}
