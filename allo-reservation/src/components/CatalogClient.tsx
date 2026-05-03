"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { CatalogProduct } from "@/lib/catalog";
import { newIdempotencyKey } from "@/lib/client-idempotency-key";

type Props = {
  initialProducts: CatalogProduct[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts[1]?.[0] ?? (parts[0]?.[1] ?? "");
  return (a + b).toUpperCase();
}

export function CatalogClient({ initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/products");
    const data = (await res.json()) as { products: CatalogProduct[] };
    if (!res.ok) throw new Error("Failed to refresh products");
    setProducts(data.products);
  }, []);

  async function reserve(productId: string, warehouseId: string, qty: number) {
    const key = `${productId}:${warehouseId}`;
    setBusyKey(key);
    setError(null);
    try {
      const idempotencyKey = newIdempotencyKey();
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ productId, warehouseId, qty }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError(
          typeof data?.message === "string"
            ? data.message
            : "Not enough free stock at that warehouse right now. Try another location or refresh the page.",
        );
        await refresh();
        return;
      }
      if (!res.ok) {
        setError(typeof data?.message === "string" ? data.message : `Something went wrong (${res.status}). Try again.`);
        return;
      }
      const id = (data as { reservation?: { id?: string } }).reservation?.id;
      if (id) {
        window.location.href = `/reservations/${id}`;
        return;
      }
      setError("We couldn’t start your hold. Please try again.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network issue — check your connection and try again.");
    } finally {
      setBusyKey(null);
    }
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/80 p-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
        <p className="text-lg font-medium text-zinc-800 dark:text-zinc-100">No products to show yet</p>
        <p className="mt-2 max-w-md mx-auto text-sm text-zinc-500 dark:text-zinc-400">
          Run <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">npm run db:seed</code>{" "}
          from the project folder, then refresh this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div
          className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between dark:border-red-900/50 dark:bg-red-950/40"
          role="alert"
        >
          <div>
            <p className="font-semibold text-red-900 dark:text-red-100">We couldn’t place that hold</p>
            <p className="mt-1 text-sm leading-relaxed text-red-800 dark:text-red-200/90">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-800 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900/60"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        {products.map((p) => (
          <article
            key={p.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm shadow-zinc-900/5 ring-1 ring-zinc-900/[0.02] dark:border-zinc-800 dark:bg-zinc-900/80 dark:shadow-none dark:ring-white/5"
          >
            <div className="flex gap-4 border-b border-zinc-100 p-5 dark:border-zinc-800">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-lg font-bold text-white shadow-inner"
                aria-hidden
              >
                {initials(p.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold leading-snug text-zinc-900 dark:text-white">{p.name}</h2>
                <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">SKU {p.sku}</p>
              </div>
            </div>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {p.warehouses.map((w) => {
                const busy = busyKey === `${p.id}:${w.warehouseId}`;
                const available = Number(w.availableUnits);
                const canReserve = Number.isFinite(available) && available >= 1;
                return (
                  <li key={w.warehouseId} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-white">{w.warehouseName}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{w.warehouseCode}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200">
                            {Number.isFinite(available) ? available : "—"} free to ship
                          </span>
                          <span className="inline-flex items-center rounded-lg bg-zinc-100 px-2.5 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {w.reservedUnits} on hold · {w.totalUnits} total
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <button
                          type="button"
                          disabled={busy || !canReserve}
                          title={
                            !canReserve
                              ? "Nothing available at this warehouse — pick another or check back later"
                              : "Hold one unit for 10 minutes while you complete checkout"
                          }
                          onClick={() => void reserve(p.id, w.warehouseId, 1)}
                          className="inline-flex min-h-[48px] min-w-[11rem] cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
                        >
                          {busy ? (
                            <span className="flex items-center gap-2">
                              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                              Starting hold…
                            </span>
                          ) : (
                            "Hold for checkout"
                          )}
                        </button>
                        {!canReserve ? (
                          <p className="max-w-[14rem] text-right text-xs leading-snug text-amber-800 dark:text-amber-200/90">
                            Sold out here — try another warehouse.
                          </p>
                        ) : (
                          <p className="max-w-[14rem] text-right text-xs text-zinc-500 dark:text-zinc-400">
                            Holds 1 unit for 10 min
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        Developers:{" "}
        <Link className="font-medium text-emerald-700 underline decoration-emerald-700/30 underline-offset-2 hover:decoration-emerald-700 dark:text-emerald-400 dark:decoration-emerald-400/30" href="/api/products">
          product JSON
        </Link>
      </p>
    </div>
  );
}
