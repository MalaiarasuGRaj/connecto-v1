import { NextRequest, NextResponse, userAgent } from "next/server";
import { buildRateLimitHeaders, consume, getClientIp } from "@/lib/rateLimit";

/**
 * Next.js Middleware
 *
 * Purpose:
 * - Add security headers to all responses.
 * - Apply in-memory rate limiting to /api/* routes.
 *
 * Notes:
 * - This runs on the Edge by default in Next.js 15 middleware.
 * - In-memory limits are per-region/instance. For strict production enforcement,
 *   replace storage with Redis (see src/lib/rateLimit.ts).
 */

const API_WINDOW_MS = 60_000; // 1 minute
const API_LIMIT = 60; // 60 requests per minute per IP+path

// Define paths under /api that should be rate limited.
// You can widen to all API routes by keeping the check at req.nextUrl.pathname.startsWith("/api")
function shouldRateLimit(pathname: string): boolean {
  // Apply to all API routes by default
  return pathname.startsWith("/api");
}

function applySecurityHeaders(response: NextResponse, req: NextRequest): NextResponse {
  // Minimal, sensible defaults. Many of these are immutable-safe.
  // If you need to allow specific external resources, adjust CSP accordingly.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "0");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  // Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy can affect web workers and WASM;
  // adjust if app needs SharedArrayBuffer, etc.
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");

  // Basic CORS handling for API routes (customize as needed)
  const origin = req.headers.get("origin") || "";
  if (req.nextUrl.pathname.startsWith("/api")) {
    // For simplicity, allow same-origin; extend with an allowlist if needed.
    if (!origin || origin === req.nextUrl.origin) {
      response.headers.set("Access-Control-Allow-Origin", req.nextUrl.origin);
      response.headers.set("Vary", "Origin");
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With"
      );
      response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      response.headers.set("Access-Control-Max-Age", "600");
    }
  }

  return response;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Handle CORS preflight early
  if (req.method === "OPTIONS" && pathname.startsWith("/api")) {
    const preflight = NextResponse.json({}, { status: 204 });
    return applySecurityHeaders(preflight, req);
  }

  // Rate limit only API routes (skip NextAuth routes)
  if (shouldRateLimit(pathname) && !pathname.startsWith("/api/auth")) {
    const ip = getClientIp(req.headers);
    // bucket per path to avoid cross-route coupling
    const key = `${ip}:${pathname}`;
    const result = consume(key, {
      limit: API_LIMIT,
      windowMs: API_WINDOW_MS,
    });

    const headers = new Headers(buildRateLimitHeaders(result));

    if (!result.allowed) {
      const res = NextResponse.json(
        {
          ok: false,
          error: { code: "rate_limited", message: "Too many requests, please try again later." },
        },
        { status: 429, headers }
      );
      return applySecurityHeaders(res, req);
    }

    // Continue the chain, but attach headers for visibility
    const res = NextResponse.next({ headers });
    return applySecurityHeaders(res, req);
  }

  // Default pass-through with headers
  const res = NextResponse.next();
  return applySecurityHeaders(res, req);
}

export const config = {
  // Match all API routes and root app paths by default; exclude Next static assets, _next, and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
