import { CatalogClient } from "@/components/CatalogClient";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getCatalog();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:pt-12">
      <div className="mb-10 max-w-2xl space-y-4">
        <p className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200">
          Try the flow: browse → reserve → checkout
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
          Pick a product, choose a warehouse, hold stock for checkout
        </h1>
        <p className="text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          We put a short hold on inventory so two people can&apos;t pay for the same last unit. Your hold lasts{" "}
          <strong className="font-semibold text-zinc-800 dark:text-zinc-200">10 minutes</strong>—finish checkout or
          cancel to release it for others.
        </p>
        <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              1
            </span>
            Check availability per warehouse
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              2
            </span>
            Tap &quot;Hold for checkout&quot;
          </li>
          <li className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-bold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
              3
            </span>
            Confirm or cancel on the next screen
          </li>
        </ol>
      </div>
      <CatalogClient initialProducts={products} />
    </main>
  );
}
