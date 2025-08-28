import { NextRequest, NextResponse } from "next/server";
import { withApiLogging } from "@/lib/logger";

/**
 * PUBLIC_INTERFACE
 * GET /api/health
 * Summary: Basic liveness and readiness probe.
 * Description: Returns application health status, version, and timestamp for monitoring.
 * Response:
 *  - status: "ok" | "degraded"
 *  - uptime: number (seconds)
 *  - timestamp: string (ISO)
 *  - version?: string
 */
export const GET = withApiLogging(async (_req: NextRequest, _log) => {
  const startedAt = (global as any).__app_started_at || Date.now();
  (global as any).__app_started_at = startedAt;

  const uptime = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  return NextResponse.json(
    {
      status: "ok",
      uptime,
      timestamp: new Date().toISOString(),
      version: undefined,
    },
    { status: 200 }
  );
});
