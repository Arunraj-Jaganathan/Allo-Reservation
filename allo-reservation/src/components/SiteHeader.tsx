import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white shadow-sm shadow-emerald-600/25">
            A
          </span>
          <span>Allo shop</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
            Browse
          </Link>
          <a
            href="/api/products"
            className="text-zinc-500 transition hover:text-zinc-800 dark:hover:text-zinc-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            API
          </a>
        </nav>
      </div>
    </header>
  );
}
