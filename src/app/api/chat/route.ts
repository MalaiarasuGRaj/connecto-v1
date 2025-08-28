import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/app/actions";

import { config } from "@/lib/config";
import { withApiLogging } from "@/lib/logger";
import { ChatRequestSchema, parseJsonSafe } from "@/lib/schemas";
config.ai.ensureAnyProvider();

/**
 * PUBLIC_INTERFACE
 * POST /api/chat
 * Summary: Chat endpoint that wraps existing server action to generate AI responses.
 * Description: Accepts a chat message and optional context, validates via Zod, delegates to server-side AI flow, and returns a JSON response.
 * Request body:
 *  - message: string (required) - user input text
 *  - history: Array<{ role: 'user' | 'assistant' | 'system' | 'bot', content: string }> (optional) - prior turns
 *  - company: string (optional) - company identifier to bias knowledge
 * Response:
 *  - ok: boolean
 *  - data: {
 *      reply: string
 *      meta?: Record<string, any>
 *    } | null
 *  - error?: { code: string; message: string }
 */
export const POST = withApiLogging(async (req: NextRequest, log) => {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, data: null, error: { code: "bad_request", message: "Content-Type must be application/json" } },
      { status: 415 }
    );
  }

  const parsed = await parseJsonSafe(req, ChatRequestSchema);
  if (!parsed.success) {
    log.warn({ reason: parsed.error }, "invalid request body");
    return NextResponse.json(
      { ok: false, data: null, error: { code: "invalid_payload", message: parsed.error } },
      { status: 400 }
    );
  }

  const { message, history, company } = parsed.data;

  log.info({ event: "chat:request" }, "processing chat");
  const result = await generateChatResponse({ message, history, company });

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
});
