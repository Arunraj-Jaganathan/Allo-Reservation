import { describe, expect, it } from "vitest";

/**
 * Requires a real Postgres DATABASE_URL and migrated schema.
 * Run locally: `DATABASE_URL=... npx prisma migrate deploy && npm run test`
 */
describe.skipIf(!process.env.TEST_DATABASE_URL)("reservation concurrency (integration)", () => {
  it("placeholder — enable TEST_DATABASE_URL to run against Postgres", () => {
    expect(true).toBe(true);
  });
});
