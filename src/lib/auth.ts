/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PUBLIC_INTERFACE
 * getIsAuthEnabled
 * Indicates whether auth is enabled using the ENABLE_AUTH feature flag.
 */
export function getIsAuthEnabled(): boolean {
  return process.env.ENABLE_AUTH === "true";
}

/**
 * PUBLIC_INTERFACE
 * requireAuth
 * Optional server-side guard for API routes. If auth is disabled, it no-ops and allows access.
 * If enabled, it checks for a session from next-auth and returns either:
 * - { ok: true, session } if authenticated
 * - { ok: false, response } with 401/403 Response if not.
 *
 * Usage in a Route Handler (future admin/write endpoints only):
 *   import { requireAuth } from "@/src/lib/auth";
 *   export async function POST(req: Request) {
 *     const check = await requireAuth(req, { requireAdmin: true });
 *     if (!check.ok) return check.response;
 *     const session = check.session!;
 *     // ... protected logic
 *   }
 */
export async function requireAuth(
  req: Request,
  opts?: { requireAdmin?: boolean }
): Promise<
  | { ok: true; session: any }
  | { ok: false; response: Response }
> {
  if (!getIsAuthEnabled()) {
    // Auth disabled => allow access.
    return { ok: true, session: null };
  }

  // Import inside function to avoid adding next-auth runtime unless needed.
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("./authOptions");

  const session = await getServerSession((authOptions as any)());
  if (!session) {
    return {
      ok: false,
      response: new Response("Unauthorized", { status: 401 }),
    };
  }

  // Minimal role-based check; can be extended later
  if (opts?.requireAdmin) {
    const roles: string[] = ((session.user as any)?.roles as string[]) || [];
    if (!roles.includes("admin")) {
      return {
        ok: false,
        response: new Response("Forbidden", { status: 403 }),
      };
    }
  }

  return { ok: true, session };
}

/**
 * PUBLIC_INTERFACE
 * getSessionServer
 * Convenience helper to fetch the session on the server. Returns null if disabled.
 */
export async function getSessionServer(): Promise<any | null> {
  if (!getIsAuthEnabled()) return null;
  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("./authOptions");
  return getServerSession((authOptions as any)());
}
