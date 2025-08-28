# Security Headers and API Rate Limiting

This project includes a Next.js middleware (src/middleware.ts) that:
- Adds strict, safe-by-default security headers to all responses.
- Applies API rate limiting for all `/api/*` routes using an in-memory sliding window limiter (src/lib/rateLimit.ts).

## What is enforced?

- Content Security Policy (CSP) with self defaults (adjust if you embed 3rd-party assets).
- Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, COOP/CORP.
- CORS: Same-origin API access by default (customize allowlist as needed).
- Rate limit: 60 requests per minute per IP and path.
  - Returns HTTP 429 when exceeded.
  - Sends standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

## In-memory vs Production

The current implementation stores counters in process memory. In serverless or multi-instance deployments, each instance keeps its own counters, resulting in per-instance enforcement. For stricter global limits, migrate to a centralized store (Redis).

### Redis upgrade pattern

Replace the in-memory `Map` in `src/lib/rateLimit.ts` with Redis:

Pseudocode (sorted set approach):
- key := `rl:${ip}:${bucket}`
- On each request:
  - `ZREMRANGEBYSCORE key -inf (nowMs - windowMs)`
  - `ZADD key nowMs nowMs`
  - `ZCARD key` => count
  - `EXPIRE key ceil(windowMs/1000)`
- Compare `count` to `limit` to decide allow/deny.
- Build and send the same `RateLimit-*` headers.

Recommended providers:
- Upstash Redis (HTTP-based for serverless)
- Redis Cloud with `ioredis` / `node-redis`

## Environment variables

AI keys are server-only:
- OPENROUTER_API_KEY
- GEMINI_API_KEY

Do not use NEXT_PUBLIC_GEMINI_API_KEY. See `.env.example` for guidance.
