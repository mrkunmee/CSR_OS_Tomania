import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe proxy (Next 16's renamed middleware): the `authorized` callback in
// authConfig runs here for every matched route to enforce RBAC.
export default NextAuth(authConfig).auth;

export const config = {
  // Run on everything except Next internals, static assets, and the auth API.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
