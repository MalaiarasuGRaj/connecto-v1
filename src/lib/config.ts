"use server";

/**
 * Centralized configuration and environment variable access.
 * - Strictly typed getters for server and client values
 * - Runtime validation with helpful errors
 * - Single place to extend with feature flags and future secrets
 *
 * Usage:
 *   import { config } from '@/lib/config';
 *   const key = config.ai.geminiApiKey(); // server-only
 *
 * Important:
 *   Do not import this module in client components. It is designed for server-only usage.
 *   If a client needs a value, explicitly add it to the client object and ensure it is NEXT_PUBLIC_*
 */

// PUBLIC_INTERFACE
export const config = {
  // Server-only configuration. Never expose secrets to the client.
  server: {
    /**
     * Returns a non-empty env var value or undefined if missing.
     */
    getOptional(name: string): string | undefined {
      const v = process.env[name];
      if (typeof v !== "string" || v.length === 0) return undefined;
      return v;
    },
    /**
     * Returns a required env var or throws with a helpful message.
     */
    getRequired(name: string, hint?: string): string {
      const v = process.env[name];
      if (typeof v !== "string" || v.trim().length === 0) {
        const extra = hint ? ` ${hint}` : "";
        throw new Error(`Missing required environment variable: ${name}.${extra}`.trim());
      }
      return v;
    },
  },

  // PUBLIC_INTERFACE
  ai: {
    /** Server-only: Google Gemini API key. Optional if using OpenRouter only. */
    geminiApiKey(): string | undefined {
      return config.server.getOptional("GEMINI_API_KEY");
    },
    /** Server-only: OpenRouter API key. Optional if using Gemini only. */
    openrouterApiKey(): string | undefined {
      return config.server.getOptional("OPENROUTER_API_KEY");
    },
    /**
     * PUBLIC_INTERFACE
     * ensureAnyProvider
     * Ensure at least one AI provider is configured (Gemini or OpenRouter).
     * Throws at runtime if neither is present.
     */
    ensureAnyProvider(): void {
      const hasGemini = !!config.ai.geminiApiKey();
      const hasOpenRouter = !!config.ai.openrouterApiKey();
      if (!hasGemini && !hasOpenRouter) {
        throw new Error(
          "Missing API keys: set at least one of GEMINI_API_KEY or OPENROUTER_API_KEY in server environment."
        );
      }
    },
  },

  // PUBLIC_INTERFACE
  client: {
    /**
     * Returns an optional public value. Only reads NEXT_PUBLIC_* vars.
     */
    getPublicOptional(name: `NEXT_PUBLIC_${string}`): string | undefined {
      const v = process.env[name];
      if (typeof v !== "string" || v.length === 0) return undefined;
      return v;
    },
    /**
     * Example of a public version string that can be shown in UI or health.
     */
    appVersion(): string | undefined {
      return config.client.getPublicOptional("NEXT_PUBLIC_APP_VERSION");
    },
  },

  // PUBLIC_INTERFACE
  features: {
    /**
     * Example feature flag getter. Expand with additional flags as needed.
     * Flags should be explicit and typed here for discoverability.
     */
    isSomeFeatureEnabled(): boolean {
      const raw = process.env.FEATURE_SOME_FLAG ?? "";
      return ["1", "true", "on", "yes"].includes(raw.toLowerCase());
    },
  },
};
