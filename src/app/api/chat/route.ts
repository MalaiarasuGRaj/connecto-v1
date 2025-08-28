import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/app/actions";

/**
 * Validate server env for each cold start of the function.
 */
function validateServerEnv() {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("Server misconfigured: missing OPENROUTER_API_KEY or GEMINI_API_KEY");
  }
}
validateServerEnv();

/**
 * PUBLIC_INTERFACE
 * POST /api/chat
 * Summary: Chat endpoint that wraps existing server action to generate AI responses.
 * Description: Accepts a chat message and optional context, delegates to server-side AI flow, and returns a JSON response.
 * Request body:
 *  - message: string (required) - user input text
 *  - history: Array<{ role: 'user' | 'assistant' | 'system', content: string }> (optional) - prior turns
 *  - company: string (optional) - company identifier to bias knowledge
 * Response:
 *  - ok: boolean
 *  - data: {
 *      reply: string
 *      meta?: Record<string, any>
 *    } | null
 *  - error?: { code: string; message: string }
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { ok: false, data: null, error: { code: "bad_request", message: "Content-Type must be application/json" } },
        { status: 415 }
      );
    }

    const body = await req.json();
    const { message, history = [], company } = body || {};

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, data: null, error: { code: "invalid_payload", message: "`message` is required" } },
        { status: 400 }
      );
    }

    // Delegate to existing server action which encapsulates AI flow.
    const result = await generateChatResponse({ message, history, company });

    // Normalize response shape to avoid UI changes
    return NextResponse.json(
      {
        ok: true,
        data: {
          reply: typeof result === "string" ? result : result?.reply ?? "",
          meta: typeof result === "object" ? { ...result, reply: undefined } : undefined,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    // Ensure we do not leak secrets; send generic message
    const message = err?.message || "Internal Server Error";
    return NextResponse.json(
      { ok: false, data: null, error: { code: "internal_error", message } },
      { status: 500 }
    );
  }
}
