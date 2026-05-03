# Allo — Inventory Reservations

Next.js (App Router) + **Supabase (PostgreSQL)** via Prisma (v5 classic engine), with **race-safe checkout reservations** using `SELECT … FOR UPDATE` inside short transactions. Optional **Upstash Redis** client is wired but **not required** for correctness.

---

## Features

- **Data model**: `Product`, `Warehouse`, `Inventory` (total + reserved), `Reservation` (pending / confirmed / released / expired), optional `IdempotencyRecord`.
- **API** (spec):
  - `GET /api/products` — catalog + `availableUnits` per warehouse (runs a small lazy expiry sweep first).
  - `GET /api/warehouses`
  - `POST /api/reservations` — `{ productId, warehouseId, qty }` → `201` or **`409`** when not enough available stock.
  - `POST /api/reservations/:id/confirm` — **`410`** when the hold expired (and stock is returned in the same transaction).
  - `POST /api/reservations/:id/release` — early cancel.
- **UI**: product list with per-warehouse availability + **Reserve**; reservation page with **live countdown**, **Confirm** / **Cancel**, refetch after actions; **409** and **410** surfaced in the UI.
- **Expiry**: Render Cron Job → `GET /api/cron/release-expired` (plus lazy cleanup on reads). See below.
- **Bonus — idempotency**: `Idempotency-Key` on reserve / confirm / release. Same key + same route + same body hash → **original stored JSON + status** replayed while holding a dedicated **PostgreSQL row lock** on `IdempotencyMutex`.

---

## Concurrency / Correctness

**Reserve** runs in a transaction:

1. `SELECT id FROM Inventory … FOR UPDATE` for the `(productId, warehouseId)` row (PostgreSQL row lock).
2. Compute `available = totalUnits - reservedUnits`.
3. If `available < qty` → **`409`** (transaction rolls back).
4. Else `reservedUnits += qty` and insert `Reservation` `PENDING` with `expiresAt = now + 10m`.

Two concurrent requests for the last unit **serialize on the inventory row**; only one passes the availability check.

**Confirm** locks the `Reservation` row first. If still `PENDING` but `expiresAt` has passed, we **release the hold** (decrement `reservedUnits`, mark `EXPIRED`) and respond **`410`** — without throwing mid-transaction (so the release commits).

---

## Expiry in Production

1. **Primary**: A [Render Cron Job](https://docs.render.com/cronjobs) hits `GET /api/cron/release-expired` every minute. Set `CRON_SECRET` in Render's environment variables; the handler accepts `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.
2. **Safety net**: `releaseExpiredReservationsBatch` also runs before **product listing** and **single-reservation reads** so UX stays correct if the cron is delayed.

---

## Local Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project. From **Project Settings → Database**, copy the **connection string**.

> Use the **Session mode** pooler URL on port `5432` for Prisma compatibility, or the direct connection string.

### 2. Configure Environment

```bash
cp .env.example .env
```

Set the following in `.env`:

```env
# Supabase session-mode pooler (port 5432) or direct connection
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Optional
CRON_SECRET="your-random-secret"
# Upstash Redis (optional, not required for correctness)
# UPSTASH_REDIS_REST_URL=
# UPSTASH_REDIS_REST_TOKEN=
```

### 3. Install & Migrate

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Idempotency (Bonus)

- Header: `Idempotency-Key` (any stable string per logical operation).
- Server stores `(key, route, requestHash)` → `(statusCode, body)` in PostgreSQL.
- A short-lived **mutex row** in `IdempotencyMutex` plus `SELECT … FOR UPDATE` ensures concurrent retries serialize; only one execution performs side effects while others read the stored replay.

**Reserve** only writes an idempotency record on **`201` success** (so a later retry after a failed attempt can succeed once stock exists). **Confirm** / **release** cache their HTTP outcomes (including `410` / `409`) so retries are safe.

---

## Tests

```bash
npm test
```

- Default unit tests run without a database.
- Optional integration placeholder: set `TEST_DATABASE_URL` (see `tests/reservations.integration.test.ts`) to a Supabase test project URL to extend with real concurrency tests.

---

## Trade-offs / Next Steps

- **Allocation**: always decrements from a single `(product, warehouse)` row chosen by the client — no auto-routing across warehouses.
- **Cron auth**: Render does not auto-inject auth headers; ensure `CRON_SECRET` is set and the cron job sends `Authorization: Bearer <CRON_SECRET>`.
- **Observability**: add structured logs + metrics around `409`/`410` rates and reservation lifetime histograms.
- **Stronger idempotency**: add a TTL cleanup job for `IdempotencyRecord` rows.
- **Supabase connection pooling**: use the **Transaction mode** pooler (port `6543`) only if you move away from Prisma's interactive transactions — Transaction mode does not support `SELECT … FOR UPDATE` across multiple roundtrips. Stick to **Session mode** (port `5432`) or the direct connection URL for this project.

---

## Deploy (Render)

### 1. Create a Web Service

Push this repo to GitHub and create a new **Web Service** in [Render](https://render.com) pointing to your repo.

### 2. Set Environment Variables

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase session-mode pooler URL (port `5432`) |
| `CRON_SECRET` | A random secret string |
| `NODE_ENV` | `production` |

### 3. Configure Build & Start Commands

**Build Command:**
```bash
npm install && npx prisma migrate deploy && npm run build
```

**Start Command:**
```bash
npm start
```

### 4. Seed Production Data

Run once from your local machine after the first deploy:

```bash
DATABASE_URL="<your-supabase-url>" npm run db:seed
```

### 5. Add a Render Cron Job

Create a separate **Cron Job** service in Render dashboard:

- **Schedule**: `* * * * *` (every minute)
- **Command**:
  ```bash
  curl -s -o /dev/null -H "Authorization: Bearer $CRON_SECRET" https://<your-render-app>.onrender.com/api/cron/release-expired
  ```

---

> Scaffolded in `allo-reservation/` because npm rejects package names with spaces.