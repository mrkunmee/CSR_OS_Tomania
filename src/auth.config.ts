import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

/**
 * Edge-safe Auth.js config. Contains NO Prisma/bcrypt so it can run in the
 * middleware (edge runtime). The Credentials provider (which needs Prisma) is
 * added in `src/auth.ts`, which runs in the Node runtime.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [], // real providers added in auth.ts
  callbacks: {
    // Persist id + role onto the JWT at sign-in
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    // Expose id + role on the session
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
    // RBAC gate — runs in middleware for every matched route
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isLoggedIn = !!auth?.user;

      // Public routes
      if (pathname.startsWith("/login")) return true;

      // Everything else requires a session
      if (!isLoggedIn) return false; // → redirect to signIn page

      // Admin-only area
      if (pathname.startsWith("/admin") && auth!.user!.role !== "ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
