/**
 * Server-side Genkit initialization.
 * Reads API keys from environment and validates at runtime.
 * This file must only be imported from server code paths.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

/**
 * Validates required server-side environment variables for AI providers.
 * Throws an error during server runtime if missing, to fail fast.
 */
function getServerEnv() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

  // Note: We support either GEMINI_API_KEY (Google) or OPENROUTER_API_KEY (OpenRouter),
  // depending on which integration is used by the flows/actions.
  if (!GEMINI_API_KEY && !OPENROUTER_API_KEY) {
    // Do not mention any NEXT_PUBLIC_* here to avoid suggesting client exposure.
    throw new Error(
      'Missing API keys: set at least one of GEMINI_API_KEY or OPENROUTER_API_KEY in server environment.'
    );
  }

  return { GEMINI_API_KEY, OPENROUTER_API_KEY };
}

// Ensure evaluation happens on import only in server context
const { GEMINI_API_KEY } = getServerEnv();

// Initialize Genkit with GoogleAI plugin using the server-side Gemini key when available.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY, // Only read on server
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
