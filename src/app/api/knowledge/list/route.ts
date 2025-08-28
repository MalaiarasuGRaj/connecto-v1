import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { withApiLogging } from "@/lib/logger";

/**
 * PUBLIC_INTERFACE
 * GET /api/knowledge/list
 * Summary: Lists available knowledge base items.
 * Description: Reads the data/ directory and returns a list of available company identifiers derived from .txt files.
 * Response:
 *  - ok: boolean
 *  - items: Array<{ id: string; file: string }>
 */
export const GET = withApiLogging(async (_req: NextRequest, log) => {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
    const items = files
      .filter((f) => f.toLowerCase().endsWith(".txt"))
      .map((file) => {
        const id = file.replace(/\.txt$/i, "");
        return { id, file };
      });

    log.debug({ count: items.length }, "knowledge list");
    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err: any) {
    log.error({ err }, "failed to read knowledge list");
    return NextResponse.json(
      { ok: false, items: [], error: { code: "fs_error", message: "Failed to read knowledge list" } },
      { status: 500 }
    );
  }
});
