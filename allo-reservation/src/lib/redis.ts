import { Redis } from "@upstash/redis";

/**
 * Optional Upstash Redis REST client (e.g. distributed locks later).
 * Not required for correctness — inventory uses Postgres row locks.
 */
let redis: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redis = null;
    return null;
  }
  redis = new Redis({ url, token });
  return redis;
}
