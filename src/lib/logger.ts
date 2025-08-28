"use server";

/**
 * Structured logger with redaction, request IDs, and helper wrappers for API routes and AI flows.
 *
 * - Uses a minimal custom JSON logger to avoid extra deps.
 * - Redacts known secret-like env values from log messages/objects.
 * - Provides per-request child logger with a stable requestId (from header or generated).
 * - Wraps API handlers and async flows with standardized error handling.
 *
 * PUBLIC USAGE:
 *   import { logger, withApiLogging, withFlowLogging, getRequestId } from '@/lib/logger';
 *
 *   export const POST = withApiLogging(async (req, log) => {
 *     log.info({ event: 'input', body: safeBody }, 'received POST');
 *     ...
 *     return NextResponse.json({ ok: true });
 *   });
 *
 * NOTES:
 * - This module is server-only. Do not import in client components.
 */

// Very small unique ID generator (avoid external deps).
function nanoId(size = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';
  let id = '';
  for (let i = 0; i < bytes.length; i++) {
    id += alphabet[bytes[i] % alphabet.length];
  }
  return id;
}

// Secrets to redact from logs. Extend as needed.
const SECRET_ENV_KEYS = [
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'GOOGLE_API_KEY',
  'FIREBASE_API_KEY',
];

function collectSecrets(): string[] {
  const secrets: string[] = [];
  for (const key of SECRET_ENV_KEYS) {
    const val = process.env[key];
    if (typeof val === 'string' && val.length > 0) secrets.push(val);
  }
  return secrets;
}

const secretValues = collectSecrets();

// Redact any occurrences of known secrets in strings.
function redactString(input: string): string {
  let out = input;
  for (const sec of secretValues) {
    if (!sec) continue;
    // Replace long secrets; only when length > 4 to avoid over-redaction
    if (sec.length > 4 && out.includes(sec)) {
      out = out.split(sec).join('[REDACTED]');
    }
  }
  return out;
}

// Recursively sanitize objects for logging (remove functions/symbols, redact secret strings).
function sanitize(value: any, seen = new WeakSet()): any {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === 'string') return redactString(value);
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'function' || t === 'symbol') return undefined;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message || ''),
      stack: value.stack ? redactString(String(value.stack)) : undefined,
    };
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((v) => sanitize(v, seen));
  }
  if (t === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) {
      out[k] = sanitize(value[k], seen);
    }
    return out;
  }
  return String(value);
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  // Arbitrary structured fields.
  [key: string]: any;
}

export interface ILogger {
  /** Log with 'debug' level. */
  debug(obj: LogFields | null, msg?: string): void;
  /** Log with 'info' level. */
  info(obj: LogFields | null, msg?: string): void;
  /** Log with 'warn' level. */
  warn(obj: LogFields | null, msg?: string): void;
  /** Log with 'error' level. */
  error(obj: LogFields | null, msg?: string): void;
  /** Create child logger with bound fields (e.g., requestId). */
  child(bindings: LogFields): ILogger;
}

function jsonLog(level: LogLevel, base: LogFields, obj?: LogFields | null, msg?: string) {
  const record: any = {
    level,
    time: new Date().toISOString(),
    ...base,
  };
  if (obj && typeof obj === 'object') {
    Object.assign(record, sanitize(obj));
  }
  if (msg) record.msg = redactString(msg);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(record));
}

class BaseLogger implements ILogger {
  constructor(private bindings: LogFields = {}) {}
  child(bindings: LogFields): ILogger {
    return new BaseLogger({ ...this.bindings, ...bindings });
  }
  debug(obj: LogFields | null = null, msg?: string) {
    jsonLog('debug', this.bindings, obj ?? undefined, msg);
  }
  info(obj: LogFields | null = null, msg?: string) {
    jsonLog('info', this.bindings, obj ?? undefined, msg);
  }
  warn(obj: LogFields | null = null, msg?: string) {
    jsonLog('warn', this.bindings, obj ?? undefined, msg);
  }
  error(obj: LogFields | null = null, msg?: string) {
    jsonLog('error', this.bindings, obj ?? undefined, msg);
  }
}

// PUBLIC_INTERFACE
export const logger: ILogger = new BaseLogger({
  service: 'connecto-v1',
  env: process.env.NODE_ENV || 'development',
});

// PUBLIC_INTERFACE
export function getRequestId(headers?: Headers): string {
  const fromHeader =
    headers?.get('x-request-id') ||
    headers?.get('x-correlation-id') ||
    headers?.get('cf-ray') ||
    headers?.get('x-vercel-id');
  return fromHeader && fromHeader.length > 0 ? fromHeader : nanoId(16);
}

// PUBLIC_INTERFACE
export type ApiHandler = (req: Request, log: ILogger) => Promise<Response> | Response;

/**
 * PUBLIC_INTERFACE
 * withApiLogging
 * Wrap a Next.js Route Handler with standardized logging, requestId assignment, and robust error handling.
 * Ensures consistent JSON error responses and logs structured error details with stack traces.
 */
export function withApiLogging(handler: ApiHandler): ApiHandler {
  return async (req: Request) => {
    const requestId = getRequestId(req.headers as any as Headers);
    const log = logger.child({
      requestId,
      method: (req as any).method,
      url: (req as any).url,
    });
    try {
      log.info({ event: 'request:start' }, 'request start');
      const res = await handler(req, log);
      // Clone headers and set request id for tracing
      const r = new Response(res.body, res);
      r.headers.set('x-request-id', requestId);
      log.info({ event: 'request:complete', status: r.status }, 'request complete');
      return r;
    } catch (err: any) {
      log.error({ err, event: 'request:error' }, 'unhandled exception');
      const body = {
        ok: false,
        error: {
          code: 'internal_error',
          message: 'Internal Server Error',
          requestId,
        },
      };
      const res = new Response(JSON.stringify(body), {
        status: 500,
        headers: { 'content-type': 'application/json', 'x-request-id': requestId },
      });
      return res;
    }
  };
}

/**
 * PUBLIC_INTERFACE
 * withFlowLogging
 * Wrap async AI flows to capture inputs/outputs/errors in a redacted structured manner.
 */
export function withFlowLogging<I, O>(
  name: string,
  fn: (input: I, log: ILogger) => Promise<O>
): (input: I, parentLog?: ILogger) => Promise<O> {
  return async (input: I, parentLog?: ILogger) => {
    const log = (parentLog ?? logger).child({ flow: name });
    try {
      log.info({ event: 'flow:start', input: input as any }, `${name} start`);
      const out = await fn(input, log);
      log.info({ event: 'flow:complete' }, `${name} complete`);
      return out;
    } catch (err: any) {
      log.error({ event: 'flow:error', err }, `${name} error`);
      throw err;
    }
  };
}

/**
 * PUBLIC_INTERFACE
 * safeJson
 * Safely parse JSON body; returns [value, error] and avoids throwing.
 */
export async function safeJson<T = any>(req: Request): Promise<[T | null, string | null]> {
  try {
    const v = (await req.json()) as T;
    return [v, null];
  } catch (e: any) {
    return [null, e?.message || 'Invalid JSON'];
  }
}
