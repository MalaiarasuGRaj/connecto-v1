/**
 * Server-side Genkit initialization.
 * Reads API keys from environment and validates at runtime.
 * This file must only be imported from server code paths.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { config } from '@/lib/config';

// Ensure evaluation happens on import only in server context
config.ai.ensureAnyProvider();
const GEMINI_API_KEY = config.ai.geminiApiKey();

// Initialize Genkit with GoogleAI plugin using the server-side Gemini key when available.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});
