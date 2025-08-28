# Authentication (Feature-Flagged with NextAuth)

This project includes a scaffolded NextAuth integration that is disabled by default to keep all current endpoints public. You can enable it later to protect admin/write routes without changing the public behavior of the app.

## Summary

- Auth route: `src/app/api/auth/[...nextauth]/route.ts`
- Shared helpers: `src/lib/auth.ts`, `src/lib/authOptions.ts`
- Feature flag: `ENABLE_AUTH` (default: disabled)
- All current endpoints remain public. Only future admin/write endpoints should import `requireAuth` to enforce protection when enabled.

## Enabling Authentication

Add the following variables to your `.env` (see `.env.example` below):

```
ENABLE_AUTH=true
NEXTAUTH_URL=https://your-deployment-url.com
NEXTAUTH_SECRET=generate_a_strong_secret
# Choose providers you want; at least one must be configured:
GITHUB_ID=your_github_oauth_app_client_id
GITHUB_SECRET=your_github_oauth_app_client_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
# Optional:
NEXTAUTH_SESSION_STRATEGY=jwt
NEXTAUTH_DEBUG=false
```

When `ENABLE_AUTH` is not set to `true`, the `/api/auth/*` route returns 404 and no authentication logic runs.

## Usage: Protect Future Admin/Write Endpoints

Example for a protected POST endpoint:

```ts
import { requireAuth } from "@/src/lib/auth";

export async function POST(req: Request) {
  const check = await requireAuth(req, { requireAdmin: true });
  if (!check.ok) return check.response;
  const session = check.session!;
  // ... your protected logic
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
```

Notes:
- If `ENABLE_AUTH` is disabled, `requireAuth` no-ops and allows the request.
- Once enabled, it will enforce authentication (and optional admin role).

## Providers

We scaffold GitHub and Google OAuth providers. Configure at least one set of credentials in `.env` before enabling auth. You can add more providers by editing `src/app/api/auth/[...nextauth]/route.ts` and `src/lib/authOptions.ts`.

## Environment Variables

A minimal `.env.example` is provided. Never commit real secrets. In CI/production, set these via your hosting platform.

## Public Endpoints Are Unchanged

- Existing routes like `/api/health`, `/api/chat`, `/api/knowledge/*` remain public by default.
- Do not wrap them with `requireAuth` unless you intentionally want to restrict access.

## Troubleshooting

- 404 on `/api/auth/*`: Ensure `ENABLE_AUTH=true`.
- Provider error: Ensure provider IDs/secrets are set and callback URLs match your host’s NextAuth URL.
- Session not persisting locally: Verify `NEXTAUTH_URL` in `.env` and cookies are allowed by your browser.
