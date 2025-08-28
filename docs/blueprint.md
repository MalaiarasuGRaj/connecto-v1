# **App Name**: Gemini Chat

## Core Features (Full Stack)

- Serverless APIs (Next.js App Router) powering the chat experience.
- AI Integration: Use OpenRouter (recommended) or Google Gemini directly; all AI calls happen server-side.
- Knowledge Base: Document-driven via data/*.txt, accessible via public endpoints for listing and item retrieval.
- Real-Time Chat Display with context retention.
- Loading state management and input ergonomics (enter-to-send).
- Responsive design across desktop and mobile.

## APIs

- POST /api/chat: Validated JSON to produce an AI response.
- GET /api/health: Liveness/readiness.
- GET /api/knowledge/list: Enumerate available companies.
- GET /api/knowledge/item/[company]?format=text|json: Return content.

## Security and Rate Limiting

- Edge middleware adds security headers (CSP, X-Content-Type-Options, X-Frame-Options, COOP/CORP, etc.).
- In-memory sliding window rate limiting for /api/* (60 req/min per IP+path).
- Same-origin CORS by default; customize for external callers.

## Deployment

- Vercel-ready with zero custom build commands.
- Configure env vars in Vercel: OPENROUTER_API_KEY or GEMINI_API_KEY (at least one).
- Optional auth feature flag via ENABLE_AUTH and NextAuth provider secrets.

## Style Guidelines

- Primary color: Dark slate blue (#434A54).
- Background color: Charcoal gray (#363A43).
- Accent color: Soft lavender (#8E82A0).
- Font: Inter.
- Minimalistic, centered chat window with smooth animations and a simple send icon.