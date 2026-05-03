"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { newIdempotencyKey } from "@/lib/client-idempotency-key";

type ReservationPayload = {
  id: string;
  productId: string;
  warehouseId: string;
  qty: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  productSku: string;
  productName: string;
  warehouseCode: string;
  warehouseName: string;
};

type Props = { reservationId: string };

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m <= 0) return `${s} sec`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ReservationClient({ reservationId }: Props) {
  const [reservation, setReservation] = useState<ReservationPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [pending, setPending] = useState<"confirm" | "release" | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/reservations/${reservationId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(
        typeof data?.error === "string"
          ? "We couldn’t load this hold. It may have been removed."
          : `Could not load (${res.status}).`,
      );
      setReservation(null);
      return;
    }
    setReservation((data as { reservation: ReservationPayload }).reservation);
  }, [reservationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft = useMemo(() => {
    if (!reservation) return null;
    const exp = new Date(reservation.expiresAt).getTime();
    return Math.max(0, Math.ceil((exp - nowMs) / 1000));
  }, [reservation, nowMs]);

  const timerProgress = useMemo(() => {
    if (!reservation || secondsLeft == null) return 0;
    const created = new Date(reservation.createdAt).getTime();
    const expires = new Date(reservation.expiresAt).getTime();
    const totalMs = expires - created;
    if (totalMs <= 0) return 0;
    const leftMs = Math.max(0, expires - nowMs);
    return Math.min(100, Math.max(0, (leftMs / totalMs) * 100));
  }, [reservation, secondsLeft, nowMs]);

  async function post(path: string) {
    setActionError(null);
    setPending(path.includes("confirm") ? "confirm" : "release");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: {
          "Idempotency-Key": newIdempotencyKey(),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) {
        setActionError(
          typeof data?.message === "string"
            ? data.message
            : "This hold has expired. The items are available again for other shoppers.",
        );
        await load();
        return;
      }
      if (res.status === 409) {
        setActionError(
          typeof data?.message === "string"
            ? data.message
            : "This hold is no longer active (for example, it was already cancelled).",
        );
        await load();
        return;
      }
      if (!res.ok) {
        setActionError(typeof data?.message === "string" ? data.message : `Request failed (${res.status}). Try again.`);
        return;
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Network issue — try again.");
    } finally {
      setPending(null);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50/90 p-8 text-center dark:border-red-900/40 dark:bg-red-950/30">
        <p className="text-lg font-semibold text-red-900 dark:text-red-100">This page couldn’t be opened</p>
        <p className="mt-2 text-sm text-red-800/90 dark:text-red-200/80">{loadError}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-red-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700"
        >
          Back to shop
        </Link>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-[85%] max-w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-[55%] max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </div>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">Loading your checkout hold…</p>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const expired = isPending && new Date(reservation.expiresAt).getTime() <= nowMs;
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";
  const isExpired = reservation.status === "EXPIRED";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Checkout</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Your hold</h1>
        <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">{reservation.productName}</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {reservation.productSku} · Qty {reservation.qty} · {reservation.warehouseName}
        </p>
      </div>

      {(isConfirmed || isReleased || isExpired) && (
        <div
          className={`rounded-2xl border p-5 ${
            isConfirmed
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40"
              : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50"
          }`}
        >
          <p className={`text-lg font-semibold ${isConfirmed ? "text-emerald-900 dark:text-emerald-100" : "text-zinc-900 dark:text-white"}`}>
            {isConfirmed && "Purchase confirmed"}
            {isReleased && "Hold cancelled"}
            {isExpired && "Hold expired"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {isConfirmed && "Stock has been updated. Thanks for trying the demo."}
            {isReleased && "Those units are available again for other shoppers."}
            {isExpired && "The timer ran out before checkout finished, so we returned the stock."}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                isPending
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200"
                  : isConfirmed
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200"
                    : "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
              }`}
            >
              {reservation.status.toLowerCase()}
            </span>
          </div>
        </div>

        {isPending ? (
          <div className="space-y-4 px-5 py-5">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Time left on your hold</span>
                <span className={`font-mono text-lg font-bold tabular-nums ${expired ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-white"}`}>
                  {secondsLeft != null ? formatCountdown(secondsLeft) : "—"}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${expired ? "bg-amber-400" : "bg-emerald-500"}`}
                  style={{ width: `${timerProgress}%` }}
                />
              </div>
              {expired ? (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-200/90">
                  The hold has ended. You can still try &quot;Complete purchase&quot; — the app will tell you if it&apos;s too late.
                </p>
              ) : (
                <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Complete purchase to keep the items, or cancel to release them for others.
                </p>
              )}
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Expires {new Date(reservation.expiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">This hold is finished — use the link below to browse again.</p>
          </div>
        )}
      </div>

      {actionError ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-amber-900/40 dark:bg-amber-950/30"
          role="alert"
        >
          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100/90">{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="shrink-0 self-end rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          >
            OK
          </button>
        </div>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void post(`/api/reservations/${reservationId}/confirm`)}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "confirm" ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Processing…
              </span>
            ) : (
              "Complete purchase"
            )}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void post(`/api/reservations/${reservationId}/release`)}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {pending === "release" ? "Cancelling…" : "Cancel hold"}
          </button>
        </div>
      ) : null}

      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 underline decoration-emerald-600/30 underline-offset-4 hover:decoration-emerald-600 dark:text-emerald-400"
      >
        ← Continue shopping
      </Link>
    </div>
  );
}
