import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { config } from "@/lib/config";

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
export async function GET(
  req: NextRequest,
  { params }: { params: { company: string } }
) {
  try {
    const company = params?.company;
    const format = (req.nextUrl.searchParams.get("format") || "text").toLowerCase();

    if (!company || typeof company !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "invalid_param", message: "`company` is required" } },
        { status: 400 }
      );
    }

    const safeName = company.replace(/[^a-z0-9_-]/gi, "");
    const filePath = path.join(process.cwd(), "data", `${safeName}.txt`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: `Knowledge item '${safeName}' not found` } },
        { status: 404 }
      );
    }

    const content = fs.readFileSync(filePath, "utf8");

    if (format === "json") {
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
    return NextResponse.json(
      { ok: false, error: { code: "fs_error", message: err?.message || "Failed to read knowledge item" } },
      { status: 500 }
    );
  }
}
