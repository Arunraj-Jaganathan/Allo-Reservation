/** Works on http:// LAN and older browsers where `crypto.randomUUID` may be missing. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      /* fall through */
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
