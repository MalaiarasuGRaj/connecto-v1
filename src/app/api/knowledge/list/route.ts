import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * PUBLIC_INTERFACE
 * GET /api/knowledge/list
 * Summary: Lists available knowledge base items.
 * Description: Reads the data/ directory and returns a list of available company identifiers derived from .txt files.
 * Response:
 *  - ok: boolean
 *  - items: Array<{ id: string; file: string }>
 */
export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir) : [];
    const items = files
      .filter((f) => f.toLowerCase().endsWith(".txt"))
      .map((file) => {
        const id = file.replace(/\.txt$/i, "");
        return { id, file };
      });

    return NextResponse.json({ ok: true, items }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, items: [], error: { code: "fs_error", message: err?.message || "Failed to read knowledge list" } },
      { status: 500 }
    );
  }
}
