import { describe, expect, it } from "vitest";
import { sha256Hex, stableStringify } from "@/lib/hash";

describe("stableStringify", () => {
  it("orders object keys deterministically", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
  });

  it("handles nested objects and arrays", () => {
    expect(stableStringify({ z: [{ c: 1, b: 2 }], a: 0 })).toBe(
      stableStringify({ a: 0, z: [{ b: 2, c: 1 }] }),
    );
  });
});

describe("sha256Hex", () => {
  it("is stable for idempotency hashing", () => {
    expect(sha256Hex("hello").length).toBe(64);
  });
});
