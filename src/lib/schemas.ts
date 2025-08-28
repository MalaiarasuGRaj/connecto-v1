import { z } from "zod";

/**
 * PUBLIC_INTERFACE
 * ChatHistoryMessageSchema
 * A single chat message item with normalized roles.
 */
export const ChatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "bot"]).describe("role of the message"),
  content: z.string().min(1, "content must not be empty").describe("message content"),
});

/**
 * PUBLIC_INTERFACE
 * ChatRequestSchema
 * Schema for POST /api/chat request payload.
 */
export const ChatRequestSchema = z.object({
  message: z.string().min(1, "`message` is required"),
  history: z.array(ChatHistoryMessageSchema).optional().default([]),
  company: z
    .string()
    .trim()
    .min(1)
    .regex(/^[\w-]+$/i, "company may contain letters, numbers, underscore, dash")
    .optional(),
});

/**
 * PUBLIC_INTERFACE
 * KnowledgeItemParamsSchema
 * Path params for /api/knowledge/item/[company]
 */
export const KnowledgeItemParamsSchema = z.object({
  company: z
    .string()
    .trim()
    .min(1, "`company` is required")
    .regex(/^[\w-]+$/i, "company may contain letters, numbers, underscore, dash"),
});

/**
 * PUBLIC_INTERFACE
 * KnowledgeItemQuerySchema
 * Query params for /api/knowledge/item/[company]?format=...
 */
export const KnowledgeItemQuerySchema = z.object({
  format: z
    .enum(["text", "json"])
    .default("text")
    .describe("response format: text returns string; json returns lines"),
});

/**
 * PUBLIC_INTERFACE
 * parseJsonSafe
 * Parses JSON with Zod schema validation, returning { success, data?, error? } without throwing.
 */
export async function parseJsonSafe<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: string }> {
  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return { success: false, error: msg || "Invalid request body" };
    }
    return { success: true, data: parsed.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}

/**
 * PUBLIC_INTERFACE
 * parseSearchParams
 * Validates URLSearchParams against a Zod schema, returning a typed, coerced object.
 */
export function parseSearchParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) raw[k] = v;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return { success: false, error: msg || "Invalid query parameters" };
  }
  return { success: true, data: parsed.data };
}
