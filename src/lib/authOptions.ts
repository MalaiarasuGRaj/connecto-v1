/**
 * Centralized NextAuth options used by server-side helpers (getServerSession).
 * This mirrors the provider setup used by the API route handler.
 */
import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";

export function authOptions(): NextAuthOptions {
  const providers = [];

  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_ID,
        clientSecret: process.env.GITHUB_SECRET,
      })
    );
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }

  const sessionStrategy = (process.env.NEXTAUTH_SESSION_STRATEGY as "jwt" | "database") || "jwt";

  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: {
      strategy: sessionStrategy,
      maxAge: 60 * 60 * 24 * 7,
    },
    providers,
    callbacks: {
      async session({ session, token }) {
        if (session?.user) {
          (session.user as any).id = token.sub;
          (session.user as any).roles = token.roles || [];
        }
        return session;
      },
      async jwt({ token }) {
        token.roles = token.roles || [];
        return token;
      },
    },
  };
}
