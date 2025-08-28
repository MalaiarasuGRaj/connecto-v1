"use server";

/**
 * PUBLIC_INTERFACE
 * In-memory rate limiter utilities for Next.js Route Handlers and Middleware.
 *
 * This implementation:
 * - Uses a sliding window approach per key (e.g., IP + route path).
 * - Exposes `consume()` to record a request and return whether it is allowed.
 * - Sends standard rate-limit headers (RateLimit-*) that mirror common conventions.
 *
 * IMPORTANT: This is process-memory scoped. In a serverless or multi-instance deployment,
 * each instance will keep its own memory and counters, which can lead to uneven enforcement.
 * For production-grade deployments, replace the storage logic with a centralized store
 * such as Redis (see "Redis upgrade pattern" docs below).
 */

type StoreRecord = {
  // timestamps in ms of accepted requests within window
  hits: number[];
  // last prune timestamp
  lastPruneAt: number;
};

type LimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reset: number; // seconds until reset
};

/**
 * Sliding window memory store.
 * Map key format recommendation: `${ip}:${bucket}`, where bucket could be route or a group.
 */
const memoryStore: Map<string, StoreRecord> = new Map();

export type RateLimitOptions = {
  /**
   * Maximum allowed requests per window per key.
   */
  limit: number;
  /**
   * Window size in milliseconds.
   */
  windowMs: number;
  /**
   * Optionally cap the bucket capacity for pruning performance (default: 5 * limit).
   */
  bucketCap?: number;
};

const nowMs = () => Date.now();

function pruneOldHits(record: StoreRecord, windowMs: number) {
  const cutoff = nowMs() - windowMs;
  // remove entries older than window
  let i = 0;
  while (i < record.hits.length && record.hits[i] <= cutoff) i++;
  if (i > 0) record.hits.splice(0, i);
  record.lastPruneAt = nowMs();
}

/**
 * PUBLIC_INTERFACE
 * consume
 * Consume a token for the given key. Returns limit info and whether the request is allowed.
 */
export function consume(
  key: string,
  options: RateLimitOptions
): LimitResult {
  const { limit, windowMs, bucketCap = Math.max(options.limit * 5, 100) } = options;

  let record = memoryStore.get(key);
  if (!record) {
    record = { hits: [], lastPruneAt: 0 };
    memoryStore.set(key, record);
  }

  // prune only if > 500ms from last prune to avoid excessive work
  if (!record.lastPruneAt || nowMs() - record.lastPruneAt > 500) {
    pruneOldHits(record, windowMs);
  }

  // Add current hit
  record.hits.push(nowMs());
  // Optional cap to avoid unbounded growth on abusive keys
  if (record.hits.length > bucketCap) {
    record.hits.splice(0, record.hits.length - bucketCap);
  }

  const count = record.hits.length;
  const allowed = count <= limit;

  // Compute reset seconds (when the earliest hit exits window)
  const oldest = record.hits[0] ?? nowMs();
  const resetMs = Math.max(0, oldest + windowMs - nowMs());
  const reset = Math.ceil(resetMs / 1000);

  const remaining = Math.max(0, limit - (allowed ? count : limit));

  return {
    allowed,
    remaining,
    limit,
    reset,
  };
}

/**
 * PUBLIC_INTERFACE
 * getClientIp
 * Attempts to extract client IP from Next.js request headers in a conservative way.
 */
export function getClientIp(headers: Headers): string {
  // Common headers used by proxies/CDN
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // The left-most is the original client
    const ip = xff.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;

  // Next.js may expose "x-vercel-forwarded-for" in Vercel environments
  const vcIp = headers.get("x-vercel-forwarded-for");
  if (vcIp) return vcIp;

  // Last resort: do not trust remoteAddress in serverless, fallback to a constant
  return "0.0.0.0";
}

/**
 * PUBLIC_INTERFACE
 * buildRateLimitHeaders
 * Creates a set of standard headers for rate limit info.
 */
export function buildRateLimitHeaders(result: LimitResult): Record<string, string> {
  // Draft standard headers: https://www.rfc-editor.org/rfc/rfc6585
  // Popular convention headers used by many frameworks:
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.reset),
  };
}

/**
 * Redis upgrade pattern:
 *
 * Replace the Map-based store with a Redis-based counter and sliding window approximation:
 *
 * Pseudocode:
 * - key := `rl:${ip}:${bucket}`
 * - Use a sorted set with timestamps or a rolling counter with TTL.
 * - On each request:
 *    ZREMRANGEBYSCORE key -inf (now - windowMs)
 *    ZADD key now now
 *    ZCARD key => count
 *    EXPIRE key ceil(windowMs/1000)
 * - Compare `count` to `limit` to decide allowed/blocked.
 *
 * Libraries:
 * - Upstash Redis (HTTP-based, ideal for serverless)
 * - ioredis or node-redis for long-lived server environments
 *
 * Important: With Redis, you'll get consistent global rate limiting across instances.
 */

