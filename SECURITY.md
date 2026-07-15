# Security posture (Blueprint §15)

Status of each §15 control in the AI Sales OS.

| Control | Status | Where |
|---|---|---|
| **RBAC** | ✅ App-level | Edge proxy (`src/proxy.ts`) + `authorized` callback (`src/auth.config.ts`) + `requireUser`/`requireRole` (`src/lib/auth-helpers.ts`); every server action re-checks role/ownership. |
| **Authentication** | ✅ | Auth.js v5, Credentials + bcrypt, JWT sessions. `AUTH_SECRET` in `.env`. |
| **API rate limiting** | ✅ App-level (in-memory) | `src/lib/rate-limit.ts`. Applied to login (5 / 5 min per email), AI qualification (8 / min per user), and call assist (12 / min per user). |
| **Audit trail** | ✅ | `src/lib/audit.ts` → `AuditLog` for CSR actions, AI decisions, manager overrides, status/score changes, API calls (§13). |
| **Secrets management** | ✅ | All secrets in `.env` (gitignored, untracked, verified). No secrets in the client bundle. |
| **Security headers** | ✅ | `next.config.ts`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`, `X-DNS-Prefetch-Control`. |
| **Encryption at rest** | ✅ Infra | Provided by Supabase Postgres. |
| **TLS in transit** | ✅ Infra | Provided by Supabase + Vercel. |
| **Monitoring** | ⬜ | Add error tracking (e.g. Sentry) at deploy time. |

## Known follow-ups
- **Rate limiting is per-instance / in-memory.** A multi-instance production deployment must back `rate-limit.ts` with Redis (Upstash) so limits are shared. Call sites don't change.
- **Content-Security-Policy is not yet set.** A strict CSP for Next.js needs per-request nonces (App Router `headers()` can't emit a nonce). Track as a dedicated task.
- **Gemini key** is currently a rate-limited free-tier key — move to a billing-enabled key and rotate the one shared during development.
