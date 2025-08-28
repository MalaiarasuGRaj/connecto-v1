"use server";

/**
 * Backend Repository Abstraction for Session/History Storage
 *
 * This module provides a small, extensible repository layer for storing user sessions
 * and message history. It ships with a default, in-memory implementation that is safe
 * to use in development and preview environments, and can be swapped for a persistent
 * store (Postgres/Supabase/Firestore/etc.) without changing call sites.
 *
 * IMPORTANT
 * - This file introduces no UI/output contract changes. It's a ready-to-extend layer only.
 * - Use server-only code here; do not import this file into client components.
 *
 * HOW TO EXTEND TO PERSISTENT STORAGE:
 * 1) Create a new repository class that implements the `SessionRepository` interface below.
 *    For example:
 *
 *    class PostgresSessionRepository implements SessionRepository {
 *      constructor(private pool: Pool) {}
 *      async createSession(input) { ... }
 *      async getSession(id) { ... }
 *      async appendMessage(sessionId, message) { ... }
 *      async listSessions(limit, offset) { ... }
 *      async deleteSession(id) { ... }
 *      async clearAll() { ... }
 *    }
 *
 * 2) Initialize your backend client using environment variables (do not hardcode config):
 *    - For Postgres: require PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD
 *    - For Supabase: require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server side)
 *    - For Firestore: require GOOGLE_APPLICATION_CREDENTIALS or use a service-account json
 *
 *    Note: This project currently has NEXT_PUBLIC_GEMINI_API_KEY in .env. Add your new
 *    variables to .env (and .env.example) when you implement a persistent backend.
 *
 * 3) Swap the default export below by returning your persistent repository from getRepository():
 *
 *    export function getRepository(): SessionRepository {
 *      // return new PostgresSessionRepository(pgPool)
 *      // or new SupabaseSessionRepository(client)
 *    }
 *
 * 4) Maintain the same method contracts so no UI or API route needs to change.
 *
 * 5) Consider indexing, retention policies, and PII/data compliance when persisting.
 */

/* ------------------------------------------------------------------------------------
 * Types
 * ----------------------------------------------------------------------------------*/

/** Role of a chat message within a session. */
export type MessageRole = "user" | "assistant" | "system";

/** A single chat message persisted in a session's timeline. */
export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string; // ISO timestamp
}

/** A chat session aggregating a timeline of messages. */
export interface Session {
  id: string;
  title?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  messages: Message[];
}

/** Arguments for creating a new session. */
export interface CreateSessionInput {
  title?: string;
  initialMessages?: Omit<Message, "id" | "createdAt">[];
}

/** Arguments for appending a message to an existing session. */
export interface AppendMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
}

/* ------------------------------------------------------------------------------------
 * Repository Interface
 * ----------------------------------------------------------------------------------*/

// PUBLIC_INTERFACE
export interface SessionRepository {
  /**
   * Create a new session with optional initial messages.
   */
  createSession(input?: CreateSessionInput): Promise<Session>;

  /**
   * Retrieve a session by ID. Returns null if not found.
   */
  getSession(id: string): Promise<Session | null>;

  /**
   * Append a message to the session timeline and update updatedAt.
   * Returns the updated session, or null if session does not exist.
   */
  appendMessage(input: AppendMessageInput): Promise<Session | null>;

  /**
   * List sessions with simple pagination.
   */
  listSessions(limit?: number, offset?: number): Promise<Session[]>;

  /**
   * Delete a session. Returns true if deleted, false if not found.
   */
  deleteSession(id: string): Promise<boolean>;

  /**
   * Clear all sessions and messages. For dev/test usage.
   */
  clearAll(): Promise<void>;
}

/* ------------------------------------------------------------------------------------
 * Default In-Memory Implementation (development friendly)
 * ----------------------------------------------------------------------------------*/

class InMemorySessionRepository implements SessionRepository {
  private sessions: Map<string, Session> = new Map();

  async createSession(input?: CreateSessionInput): Promise<Session> {
    const id = generateId("sess_");
    const now = new Date().toISOString();

    const initialMessages: Message[] =
      input?.initialMessages?.map((m) => ({
        id: generateId("msg_"),
        role: m.role,
        content: m.content,
        createdAt: now,
      })) ?? [];

    const session: Session = {
      id,
      title: input?.title,
      createdAt: now,
      updatedAt: now,
      messages: initialMessages,
    };

    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) ?? null;
  }

  async appendMessage(input: AppendMessageInput): Promise<Session | null> {
    const session = this.sessions.get(input.sessionId);
    if (!session) return null;

    const message: Message = {
      id: generateId("msg_"),
      role: input.role,
      content: input.content,
      createdAt: new Date().toISOString(),
    };

    session.messages.push(message);
    session.updatedAt = message.createdAt;
    this.sessions.set(session.id, session);
    return session;
  }

  async listSessions(limit = 20, offset = 0): Promise<Session[]> {
    const all = Array.from(this.sessions.values()).sort(
      (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
    );
    return all.slice(offset, offset + limit);
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async clearAll(): Promise<void> {
    this.sessions.clear();
  }
}

/* ------------------------------------------------------------------------------------
 * Repository Selector
 * ----------------------------------------------------------------------------------*/

/**
 * PUBLIC_INTERFACE
 * getRepository
 * Returns the active SessionRepository instance.
 *
 * This defaults to an in-memory repository suitable for local development and
 * preview deployments. To use a persistent store, replace the return value
 * with your custom implementation (see top-of-file HOW TO EXTEND section).
 */
export function getRepository(): SessionRepository {
  // Example switch if you want to toggle by env in the future:
  // if (process.env.PERSISTENCE_PROVIDER === "postgres") {
  //   return new PostgresSessionRepository(pgPool);
  // }
  // if (process.env.PERSISTENCE_PROVIDER === "supabase") {
  //   return new SupabaseSessionRepository(supabaseClient);
  // }
  // if (process.env.PERSISTENCE_PROVIDER === "firestore") {
  //   return new FirestoreSessionRepository(firestoreClient);
  // }

  return inMemorySingleton;
}

/* ------------------------------------------------------------------------------------
 * Utilities
 * ----------------------------------------------------------------------------------*/

const inMemorySingleton = new InMemorySessionRepository();

/**
 * Generate a compact unique id. For production-grade systems, consider
 * using crypto.randomUUID() or ULIDs/KSUIDs from a vetted library.
 */
function generateId(prefix = ""): string {
  // Use crypto.randomUUID if available in the runtime, otherwise fallback.
  const base =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}${base}`;
}
