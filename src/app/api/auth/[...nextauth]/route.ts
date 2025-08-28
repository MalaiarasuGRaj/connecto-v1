import NextAuth, { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

/**
 * NextAuth dynamic route handler.
 * This route is feature-flagged via ENABLE_AUTH. If not enabled, it returns 404.
 *
 * Security note:
 * - We scaffold providers but the route is inactive unless explicitly enabled via env.
 * - All existing public endpoints remain public. Future admin/write routes can import helpers from src/lib/auth.ts.
 */

function isAuthEnabled(): boolean {
  // Feature flag: auth is disabled by default unless explicitly enabled.
  // Avoids breaking existing public-only deployments.
  return process.env.ENABLE_AUTH === "true";
}

function getAuthOptions(): NextAuthOptions {
  // Providers are registered conditionally; missing credentials are tolerated in disabled mode.
  const providers = [];

  // Only add providers that have the necessary env configured.
  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
        allowDangerousEmailAccountLinking: false,
      })
    );
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: false,
      })
    );
  }

  const sessionStrategy = (process.env.NEXTAUTH_SESSION_STRATEGY as "jwt" | "database") || "jwt";

  const options: NextAuthOptions = {
    debug: process.env.NODE_ENV !== "production" && process.env.NEXTAUTH_DEBUG === "true",
    secret: process.env.NEXTAUTH_SECRET,
    session: {
      strategy: sessionStrategy,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    // Configure one or more authentication providers
    providers,
    callbacks: {
      async session({ session, token }) {
        // Propagate minimal claims. Extend later as needed.
        if (session?.user) {
          (session.user as any).id = token.sub;
          (session.user as any).roles = token.roles || [];
        }
        return session;
      },
      async jwt({ token, account, profile }) {
        // Example: attach roles or org if needed in the future
        if (account && profile) {
          // Initialize roles array for future admin gating
          token.roles = token.roles || [];
        }
        return token;
      },
      async signIn({ account }) {
        // Allow sign-in by default; restrict later if necessary.
        if (!account) return false;
        return true;
      },
    },
    pages: {
      // Keep defaults; can be overridden by adding custom pages later.
      // signIn: "/auth/signin",
      // error: "/auth/error",
    },
  };

  return options;
}

// When the feature flag is off, return 404 to avoid exposing auth endpoints.
function notFoundResponse() {
  return new Response("Auth is disabled. Set ENABLE_AUTH=true to enable.", { status: 404 });
}

const handler = isAuthEnabled()
  ? NextAuth(getAuthOptions())
  : {
      GET: notFoundResponse,
      POST: notFoundResponse,
    };

export { handler as GET, handler as POST };
