import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { withApiLogging } from "@/lib/logger";
import { KnowledgeItemParamsSchema, KnowledgeItemQuerySchema, parseSearchParams } from "@/lib/schemas";

/**
 * PUBLIC_INTERFACE
 * GET /api/knowledge/item/[company]
 * Summary: Fetches a knowledge base item by company identifier.
 * Description: Returns the raw text content of the requested company knowledge file in data/{company}.txt.
 * Path params:
 *  - company: string (required)
 * Query params:
 *  - format: "text" | "json" (optional, default "text") - response format
 * Response (format=text):
 *  - ok: boolean
 *  - id: string
 *  - content: string
 * Response (format=json):
 *  - ok: boolean
 *  - id: string
 *  - content: { lines: string[] }
 */
export const GET = withApiLogging(async (req: NextRequest, log) => {
  const paramsCompany = (req as any).params?.company ?? (req as any)?.company; // fallback
  const paramsParsed = KnowledgeItemParamsSchema.safeParse({ company: paramsCompany });
  if (!paramsParsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_param", message: paramsParsed.error.issues.map(i => i.message).join("; ") } },
      { status: 400 }
    );
  }
  const queryParsed = parseSearchParams(req.nextUrl.searchParams, KnowledgeItemQuerySchema);
  if (!queryParsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_query", message: queryParsed.error } },
      { status: 400 }
    );
  }

  const safeName = paramsParsed.data.company.replace(/[^a-z0-9_-]/gi, "");
  const filePath = path.join(process.cwd(), "data", `${safeName}.txt`);

  if (!fs.existsSync(filePath)) {
    log.warn({ safeName }, "knowledge item not found");
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: `Knowledge item '${safeName}' not found` } },
      { status: 404 }
    );
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");

    if (queryParsed.data.format === "json") {
      return NextResponse.json(
        {
          ok: true,
          id: safeName,
          content: { lines: content.split(/\r?\n/) },
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        id: safeName,
        content,
      },
      { status: 200 }
    );
  } catch (err: any) {
    log.error({ err, safeName }, "failed reading knowledge item");
    return NextResponse.json(
      { ok: false, error: { code: "fs_error", message: "Failed to read knowledge item" } },
      { status: 500 }
    );
  }
});
