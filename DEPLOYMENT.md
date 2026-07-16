# Deploying AI Sales OS (Vercel + Supabase)

The app is build-ready (`npm run build` passes; Prisma client auto-generates via
`postinstall`). The Supabase database is **already migrated and seeded**, and
production will use that same database — so there's no separate DB setup.

## What only you can do (accounts / secrets)
1. **Push the repo to GitHub** (needs your GitHub account).
2. **Create/connect a Vercel project** from that repo (needs your Vercel account).
3. **Enter the environment variables** in Vercel (secrets — I never enter these).

I can't create accounts, push to your remote, or type secrets into Vercel. The
steps below are yours to run; ping me for any error output and I'll debug.

## Step 1 — Push to GitHub
```bash
cd ~/Projects/ai-sales-os
git add -A && git commit -m "AI Sales OS: Phase 1 + Phase 2 (2.4 pending)"
# create an EMPTY GitHub repo first, then:
git remote add origin git@github.com:<you>/ai-sales-os.git
git push -u origin main
```
`.env` is gitignored, so no secrets are pushed. ✅

## Step 2 — Import to Vercel
- New Project → import the GitHub repo. Framework preset **Next.js** is auto-detected.
- Build command / install command: **defaults** (the `postinstall` runs `prisma generate`).

## Step 3 — Environment variables (Vercel → Settings → Environment Variables)
| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase **Session pooler** URI (port **5432**, host `aws-0-…pooler.supabase.com`) | The known-good string (works locally with our `pg` adapter). **Do NOT use the direct `db.<ref>.supabase.co` host — it's IPv6-only and unreachable from Vercel** (this is the #1 cause of prod login failing while local works). Percent-encode the password (`#`→`%23`, `%`→`%25`). Must be the **same seeded project**. |
| `AUTH_SECRET` | a fresh secret | Generate a NEW one for prod: `openssl rand -base64 32`. Don't reuse the dev value. |
| `AUTH_TRUST_HOST` | `true` | Lets Auth.js trust the Vercel host. |
| `GEMINI_API_KEY` | a **billing-enabled** Gemini key | The current dev key is rate-limited free tier; use a paid key and rotate the shared dev one. |

## Step 4 — Deploy
- Click **Deploy**. First build runs `npm install` → `postinstall` (prisma generate) → `next build`.
- Migrations: already applied to the shared Supabase DB. If you ever point at a fresh DB, run
  `npx prisma migrate deploy` against the **Session pooler** URL (port 5432) once.

## Post-deploy checklist
- [ ] Log in with a seeded account and walk the flow (lead → interview → qualify → analytics).
- [ ] **Rotate** the dev `AUTH_SECRET` and the shared Gemini key (see `SECURITY.md`).
- [ ] Consider Phase-2.4 Redis (Upstash) so rate limits are shared across serverless instances.
- [ ] Add error monitoring (e.g. Sentry) — the one remaining `SECURITY.md` gap.

## Notes / caveats
- **Pooler choice:** use the **Session pooler (5432)** for `DATABASE_URL` — it's IPv4 and full-featured, and it's the exact string proven working with our `pg` driver adapter. (The Transaction pooler :6543 is a later scale optimization but can trip prepared-statement issues with the `pg` adapter.) The direct `db.<ref>.supabase.co` host is IPv6-only and won't work from Vercel.
- **"Invalid email or password" on prod but works locally** = a `DATABASE_URL` problem (Auth.js reports DB errors in `authorize` as invalid credentials). Check the Vercel **Functions log** — `authorize` now logs the real DB error there.
- **Seeded demo data** (2 leads, etc.) lives in the shared DB and will appear in production. Clear or
  reseed if you want a clean prod start.
