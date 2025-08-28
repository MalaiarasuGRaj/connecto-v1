# Security Headers, CORS, and API Rate Limiting

This project includes a Next.js middleware (src/middleware.ts) that:
- Adds strict, safe-by-default security headers to all responses.
- Applies API rate limiting for all `/api/*` routes using an in-memory sliding window limiter (src/lib/rateLimit.ts).
- Handles basic CORS for same-origin APIs by default.

## What is enforced?

- Content Security Policy (CSP) with strict self defaults (adjust if embedding third-party assets).
- Referrer-Policy, X-Content-Type-Options, X-Frame-Options, Permissions-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy.
- CORS: Same-origin API access by default (customize allowlist as needed).
- Rate limit: 60 requests per minute per IP and path.
  - Returns HTTP 429 when exceeded.
  - Sends standard headers: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

## Production Considerations

- In-memory limiter is per-instance and per-region in serverless. For global consistency, migrate limiter state to Redis (or similar).
- If you deploy to multiple regions, confirm you are comfortable with per-region limits; otherwise centralize via Redis.
- Review and customize CSP to only allow the exact origins you call (e.g., OpenRouter endpoints).
- For public APIs, consider adding a CORS allowlist and/or auth tokens to prevent cross-origin abuse.
- Consider HSTS and custom headers via Vercel project settings if you need stricter transport guarantees.

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
- Return and send the same `RateLimit-*` headers.

Recommended providers:
- Upstash Redis (HTTP-based for serverless)
- Redis Cloud with `ioredis` / `node-redis`

## Environment variables

AI keys are server-only and must not be exposed to the client:
- OPENROUTER_API_KEY
- GEMINI_API_KEY

Do not use NEXT_PUBLIC_GEMINI_API_KEY.

## Security Checklist (Deployment)

- [ ] Set at least one AI provider key (OPENROUTER_API_KEY or GEMINI_API_KEY) in Vercel.
- [ ] Confirm middleware is active and /api/health responds with security headers.
- [ ] Validate rate limit behavior (429 on sustained bursts to the same path per IP).
- [ ] Review and tighten CSP to exact origins needed.
- [ ] If enabling auth, configure ENABLE_AUTH, NEXTAUTH_SECRET, NEXTAUTH_URL, and provider secrets.
- [ ] Monitor logs for 5xx errors and spikes in 429s; adjust limits or enable Redis if needed.

## Authentication (Feature-Flagged)

Optional NextAuth integration is scaffolded and disabled by default to keep all endpoints public. When you need to protect admin/write endpoints, enable auth and wrap those endpoints with `requireAuth` from `src/lib/auth.ts`. See `docs/auth.md` for configuration.
