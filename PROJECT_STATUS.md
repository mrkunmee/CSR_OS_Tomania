# AI Sales OS — Project Status & Implementation Tracker

Living tracker for building the platform in [`AI_Sales_Operating_System_Master_Blueprint.md`](~/Downloads/AI_Sales_Operating_System_Master_Blueprint.md), sequenced by the [build plan](~/Documents/AI-Sales-OS-Build-Plan.md). Blueprint section refs shown as `§n`.

**Legend:** ✅ done & verified · 🟡 in progress · ⬜ not started

---

## Stack (installed)
- Next.js 16.2 (App Router, TypeScript, Tailwind v4, ESLint) + React 19
- Prisma 7.8 + `@prisma/adapter-pg` (PostgreSQL) — client generated to `src/generated/prisma`
- Auth.js v5 (`next-auth@beta`) — Credentials + JWT sessions ✅ wired
- `@google/genai` (Gemini) — installed, wired in Milestone 1.5
- Zod, bcryptjs, tsx (seed runner)

## Infrastructure
- ✅ **Supabase Postgres** (eu-west-1), Session pooler `aws-0-eu-west-1.pooler.supabase.com:5432`
- ✅ Migration `init` applied — all tables live · ✅ seed loaded & verified
- ✅ `.env` set: `DATABASE_URL`, `AUTH_SECRET` · ⬜ `GEMINI_API_KEY` (needed for 1.5)
- ⬜ Deploy target (Vercel + Transaction pooler :6543) — Phase 4 concern

> **Notes:** Supabase direct host is IPv6-only here → use the pooler (set). DB password `#`/`%` are percent-encoded in the URL. Run the dev server from `~/Projects` (preview EPERMs under `~/Documents`); preview runs on **port 3100**.

---

## Phase 1 — MVP (end-to-end explainable qualification)

### ✅ Milestone 1.1 — Project foundation, Auth & RBAC (§4)
- [x] Next.js app scaffolded (TS, Tailwind, App Router)
- [x] Prisma + Postgres connected; client singleton (`src/lib/prisma.ts`)
- [x] Auth.js v5 Credentials provider (bcrypt + Prisma), JWT sessions
- [x] Edge-safe RBAC in `src/proxy.ts` via `authorized` callback (`src/auth.config.ts`)
- [x] `Role` enum (ADMIN/MANAGER/CSR); `requireUser()`/`requireRole()` guards
- [x] Role-aware app shell (sidebar filtered by role, role badge, sign-out)
- [x] Pages: `/login`, `/dashboard` (role-scoped stats), `/leads` (read-only), `/admin` (ADMIN-only)
- **Verified live:** CSR → own pipeline, Admin nav hidden, `/admin` redirects; Admin → Admin page with config counts; sign-out works.

### ✅ Milestone 1.2 — Data model (§17) & config seed (§12)
- [x] All entities in dependency order: `User → Company → Lead → Call → Response → Score → Recommendation → PartnerReferral → Package → Task → AuditLog → LearningEvent`
- [x] Config-first tables: `Package`, `PartnerService`, `ScoringWeight`, `QualificationThreshold`, `QualificationQuestion`, `PromptTemplate`, `FollowUpCadence`
- [x] `Recommendation` carries full explainability payload (§8/§10) + override fields (§14)
- [x] Seed: 3 users, 3 packages, 5 partners, 5 weights, 3 thresholds, 13 questions (with branching), 5 cadences, 1 prompt, 1 demo lead

### ✅ Milestone 1.3 — Lead & Company management (verified in browser)
_Blueprint: §3 (workflow steps 1–2), §4 Lead Management, §6 lead statuses._
- [x] Company create/edit (profile fields from §5) — managed inline on the lead form
- [x] Lead create/edit + linked Company (atomic Prisma **nested write**); contact, source, decision-maker
- [x] Lead list with filters (status / assigned CSR / search) — replaced the read-only preview
- [x] Lead detail page — contact + company cards, status/assign controls, audit trail, slots for interview (1.4) & AI (1.5)
- [x] CSR assignment; Manager/Admin can reassign (CSRs are limited to their own leads)
- [x] Status lifecycle + guarded transitions (`src/lib/lead-status.ts`) — options adapt to current status
- [x] Every mutation writes an `AuditLog` (`src/lib/audit.ts`) — create + status-change verified in trail
- [x] Zod validation shared by forms + server actions (`src/lib/validation.ts`)
- **Verified:** created VitalHerbs/Tunde Bello (assigned, ASSIGNED), changed status ASSIGNED→IN_QUALIFICATION, both audited with actor + timestamp.
- **Files:** `src/app/(app)/leads/{page,actions,lead-form}.tsx`, `.../[id]/{page,lead-actions}.tsx`, `.../[id]/edit/page.tsx`, `.../new/page.tsx`, `src/components/status-badge.tsx`.
- **Bug fixed via browser:** Prisma interactive `$transaction` times out over the Supabase pooler (`P2028`) → replaced with atomic nested writes.

### ✅ Milestone 1.4 — CSR workspace + dynamic qualification interview (§5) (verified in browser)
- [x] Interview UI driven by `QualificationQuestion` config (not hardcoded) — 12 base questions render from the table
- [x] Dynamic branching from `branchRules` (`src/lib/interview.ts`) — NAFDAC "no" surfaced the `nafdacTimeline` follow-up (12→13)
- [x] Persist answers to `Response` (upsert on new `@@unique([callId, questionKey])`) tied to a `Call`; empties are cleared
- [x] Progress bar + resume (open `Call` reused); CSR notes on the `Call`
- [x] Start / Save / Complete actions, each audited (§13); Complete sets `Call.endedAt` and hands off to 1.5
- [x] Lead detail shows interview state + Resume/New-interview link
- **Verified:** started interview, answered 3 (incl. NAFDAC "no" → follow-up appeared), saved (persisted round-trip), completed → lead detail shows "completed with 3 responses"; all five audit events present.
- **Files:** `src/lib/interview.ts`, `.../[id]/interview/{page,actions,interview-form}.tsx`; migration `..._response_unique`.

### ✅ Milestone 1.5 — Gemini qualification engine (§8, §16) (verified LIVE in browser)
- [x] Server-side Gemini wrapper (`src/lib/gemini.ts`); prompt assembled from `PromptTemplate` (v1) + lead/company/responses/packages
- [x] **Zod-validated structured output** — all §8 fields; malformed-JSON retry
- [x] Five-outcome enforcement via the `QualificationOutcome` enum — no bare "Not Qualified"
- [x] Stored full output + `rawModelInput`/`rawModelOutput`/`modelName`/`promptTemplateVersion` (reproducibility + learning); `Score` row created
- [x] `AI_DECISION` audit entry; lead status auto-transitions to the outcome (if allowed)
- [x] **Resilience:** model fallback chain + 503 retry (`MODEL_CANDIDATES`) — rode through the free-tier 429/503 flakiness
- **Verified LIVE:** Tunde Bello → **PARTNER_REFERRAL, score 40, confidence 90, Starter (₦150k)**, context-aware reasoning + 3 business rules + risks/opportunities/objections/signals + 3-step follow-up; stored (rawInput 2940 / rawOutput 3026 chars) and audited.
- **Note:** the provided key is heavily rate-limited (free tier); each qualify call takes ~40s and can need a retry. A billing-enabled key would remove the flakiness.
- **Files:** `src/lib/{gemini,qualification}.ts`, `leads/[id]/{qualify-actions,qualify-button,recommendation-panel}.tsx`.

### ✅ Milestone 1.6 — Confidence engine (§9) + Explainable AI (§10) (verified in browser)
- [x] Explainable AI panel (`recommendation-panel.tsx`): signals, positive/negative factors, rule refs, confidence
- [x] **Deterministic** confidence (`src/lib/confidence.ts`): completeness, missing fields, decision-maker presence, financial-consistency check — computed in code
- [x] Side-by-side computed vs AI confidence with a **divergence warning** (≥25 pts) prompting review (`confidence-card.tsx`)
- **Verified:** VitalHerbs computed **30** vs AI **90** → divergence flag fired, with a factor-by-factor breakdown (−23/−24/−15/−8).
- **DoD met:** every recommendation shows a client-readable explainability panel backed by an independent, code-computed confidence.

### ✅ Milestone 1.7 — Package (§8) + Partner (§7) recommendation engines (verified in browser)
- [x] Deterministic, config-driven **partner engine** (`src/lib/partners.ts`): NAFDAC not-registered / no website / weak logistics / weak branding / poor creatives → referral, with explainable reasons
- [x] Persists `PartnerReferral` rows matched to active `PartnerService` config; integrated into the orchestrator (idempotent `deleteMany` + recreate on re-run)
- [x] Deterministic **package ranking** by budget (`pickPackageByBudget`) cross-checks the AI pick — shows "✓ matches" or the rules-based alternative
- [x] UI: partner-referrals card (`partner-referrals-card.tsx`) + package cross-check line in the recommendation panel
- **Verified:** VitalHerbs → 2 referrals (NAFDAC Registration Partner, Website Service) rendered with reasons; deterministic package = Starter = AI pick → "✓ matches".
- **Note:** partner rules + package pick + persistence + UI verified directly; the orchestrator's Gemini-triggered re-run was rate-limited at test time, so referrals were persisted via the identical partner-block logic.
- **Files:** `src/lib/partners.ts`, `leads/[id]/partner-referrals-card.tsx`, updates to `qualification.ts` + `recommendation-panel.tsx` + detail `page.tsx`.

### ✅ Milestone 1.8 — Follow-up, tasks, human-in-the-loop, audit (§8, §13, §14) (verified in browser)
- [x] Follow-up `Task`s generated from AI `followUpPlan` + `FollowUpCadence` (idempotent); tasks card with mark-done
- [x] Manager override (`manage-actions.ts`, `override-form.tsx`): outcome / package / score — **reason mandatory** (client `required` + server check §14); writes `MANAGER_OVERRIDE` audit + fills Recommendation override fields; override banner on the panel
- [x] Won/Lost reachable via the status changer (audited); predicted outcome (Recommendation) + actual (WON/LOST) captured for the Phase 3 learning engine
- [x] Audit trail view on the lead detail (from 1.3)
- **Verified:** 3 tasks generated (due Jul 18/20/22), marked one done; manager override PARTNER_REFERRAL → QUALIFIED_WITH_CONDITIONS with reason → status changed + `MANAGER_OVERRIDE` audit + banner.
- **Files:** `manage-actions.ts`, `tasks-card.tsx`, `override-form.tsx`; updates to `qualification.ts`, `recommendation-panel.tsx`, detail `page.tsx`.

---

## Phase 2 — AI enhancements & operations
- ✅ **2.1 Prompt library + versioning UI (§16)** (verified in browser) — admin-editable prompts at `/admin/prompts`; editing creates a new version (history preserved), activation keeps a single active version per name, engine reads the active one. Files: `admin/prompts/{page,actions,prompt-admin}.tsx`. Verified: qualification v1→v2 create+activate, reactivated v1, exactly-one-active invariant holds.
- ✅ **2.2 Admin config CRUD (§12)** (verified in browser) — `/admin/config` edits packages, partner services, scoring weights, thresholds, and cadences with plain server-action forms; no deletes (active toggles). Verified config→behavior: changed Growth minBudget in the UI → lead's deterministic package pick flipped Starter→Growth (then reverted). Files: `admin/config/{page,actions}.tsx`.
- ✅ **2.2b Questions + branching editor** (verified in browser) — `/admin/questions` edits interview questions and their branch rules via a friendly `answerContains -> targetKey` text format (`src/lib/branch-rules.ts`); rejects branch targets that aren't real question keys. Verified: unknown-key rejected, valid edit persisted as JSON (then reverted). Files: `admin/questions/{page,actions,question-form}.tsx`.
- ✅ **2.3 Analytics (§4)** (verified in browser) — `/analytics` (Manager/Admin): headline tiles (total/won/win-rate/AI-accuracy), pipeline funnel, score-vs-outcome accuracy (feeds Phase 3 learning), CSR performance table, package + partner mix. Single-hue magnitude bars per dataviz guidance. Verified: marked a deal WON → win rate 100%, AI accuracy 1/1, avg won-score 40, CSR won-count updated. Files: `src/lib/analytics.ts`, `analytics/page.tsx`.
- ⬜ **2.4 Async pipeline + cost controls (§15): Redis/BullMQ jobs, caching, token budgeting** (model fallback + 503 retry already done) ◀ **NEXT** — needs a Redis instance (Upstash)
- ✅ **2.5 Live Call Assistant (§4)** (verified LIVE in browser) — on-demand in-interview guidance: sentiment, summary, suggested next questions, talking points, objections, buying signals. Shared `generateStructured` engine + a new **429 retry-after** resilience path. Verified LIVE for Ada Obi (POSITIVE; even flagged a NAFDAC CRM-vs-answer discrepancy and the ₦600k>₦400k budget gap). Files: `leads/[id]/interview/{call-assistant.tsx,actions.ts}`, `src/lib/gemini.ts`.
- ✅ **2.6 Security hardening (§15)** (verified in browser) — security response headers (`next.config.ts`, confirmed live), in-memory rate limiter (`src/lib/rate-limit.ts`) on login/qualify/call-assist (5 allowed→6th blocked, independent per key), secrets hygiene checked (`.env` gitignored + untracked, no secrets in tracked files), `SECURITY.md` documenting the full §15 posture. RBAC + audit already in place. _Follow-ups noted: Redis-backed limits for multi-instance, CSP with nonces, key rotation._

## Phase 3 — Learning engine & multi-agency
- ✅ **3.1 LearningEvent capture (§11)** (verified in browser) — on WON/LOST, `recordLearningEvent` (`src/lib/learning.ts`) stores predicted-vs-actual + a computed recalibration proposal (`PENDING_REVIEW`); hooked into `changeLeadStatus`. `computeRecalibration` unit-tested (over-optimistic→raise threshold, under-estimated→lower); live hook verified (Ada→LOST created the event). Idempotent per lead+outcome.
- ✅ **3.2 Manager review + apply (§11)** (verified in browser) — `/learning` (Manager/Admin, in nav): lists `PENDING_REVIEW` events with predicted-vs-actual + proposal; **Approve & apply** updates the live config (threshold/weight), **Reject** records the decision; both audited (`MANAGER_OVERRIDE`), event marked APPROVED/REJECTED with reviewer + timestamp. Verified LIVE: approved a mispredict proposal → `qualifiedMinScore` 70→75 applied, event APPROVED by Admin (then reverted test data). Files: `learning/{page,actions}.tsx`.
- ✅ **3.3 Aggregate recalibration + accuracy (§11)** (verified in browser) — `/learning` aggregate panel: overall accuracy, direction distribution (correct / over-optimistic / under-estimated / no-prediction), and a **net recalibration** proposal shown only on a clear systematic bias (|over−under|≥2). "Apply aggregate" applies it to config + audits. `computeLearningAggregate` (`src/lib/learning.ts`). Verified LIVE: 3 over-optimistic events → net proposal `qualifiedMinScore 70→75` → applied + audited (then reverted). 
### 🟡 3.4 Multi-agency tenant isolation (§20) — full isolation, staged
- ✅ **3.4a Schema foundation** (verified) — `Organization` model + nullable `organizationId` across all 18 tenant tables; migration `..._multitenancy_org` backfills existing rows into a default org ("Tomania Agency" / `org_default`); config unique constraints are now org-scoped composites; seed is org-aware. Non-breaking (nullable) — verified: migration applied, all rows backfilled (3 users / 2 leads / 2 companies / 3 packages, 0 orphans), typecheck green, pushed.
- ✅ **3.4b Enforce isolation** (verified in browser) — `organizationId` is now **NOT NULL** (migration `..._org_required`); session carries the org (authorize→jwt→session + `next-auth.d.ts`); **every** query, create, and action across the app is org-scoped (leads, dashboard, analytics, learning, interview, qualification + partner engines, audit, admin config/prompts/questions). Verified LIVE: a second org (**Acme**) logs in and sees only its own lead — **zero cross-tenant leak**; new org starts with empty config. Compiler-enforced for writes (required FK), manually scoped for reads. Typecheck green, pushed (`91cb840`).
- ✅ **3.4c Org onboarding** (verified) — `/signup` creates an org + first admin and **seeds that org's default config** (shared `src/lib/org-defaults.ts`); `/admin/team` lists org members + adds users (email/role/temp password). Verified: signed up "BrightAds" → landed on empty isolated dashboard with full seeded config (3 pkgs / 13 questions / 1 prompt), added a CSR (isolated to the org). Files: `signup/{page,actions}.tsx`, `admin/team/{page,actions,team-form}.tsx`, `src/lib/org-defaults.ts`.

**→ Phase 3 (learning engine + multi-agency) is COMPLETE.**

## Phase 4 — SaaS  (OUT OF SCOPE — internal tool, not marketed)
- ~~Self-serve onboarding, billing/metering, plan gating~~ — not needed (own use).
- ⬜ (optional) deploy maturity: Docker · monitoring (Sentry). CI/CD ✅ Vercel; backups ✅ Supabase.

---

## Current position
**Phase 1 complete (1.1–1.8). Phase 2: 2.1 prompts + 2.2 config CRUD + 2.2b questions editor + 2.3 analytics + 2.5 call assistant + 2.6 security done.** Only **2.4 async pipeline** remains (deferred — needs Upstash Redis).
**Deploy: ✅ LIVE & GREEN** at `https://csr-os-tomania.vercel.app` (verified — admin login → dashboard with real data). Fixes that got it green: `trustHost: true` (code), `AUTH_SECRET` set in Vercel, and `DATABASE_URL` = Supabase **Session pooler** :5432 (the direct `db.<ref>` host is IPv6-only → unreachable from Vercel — that was the login failure). `authorize` now logs DB errors server-side. GitHub `mrkunmee/CSR_OS_Tomania`. **TODO:** rotate the DB password + Gemini key (shared in chat during setup).
**▶ PHASES 1–3 COMPLETE.** Learning engine (3.1–3.3) + multi-agency (3.4a schema + 3.4b isolation + 3.4c onboarding, verified with 3 orgs). **Scope note:** this is an **internal tool** (own use, not a marketed SaaS) — Phase 4 self-serve onboarding / billing / plan-gating is **OUT OF SCOPE**. Remaining optional work: 2.4 async pipeline (needs **Upstash Redis**) · monitoring (**Sentry** DSN) · Docker (optional). Backups handled by Supabase; CI/CD via Vercel.
**⚠️ Before real production use:** rotate DB password + Gemini key; remove test orgs (Acme, BrightAds) created during 3.4 verification.
**`GEMINI_API_KEY`** is a rate-limited free-tier key — use a billing-enabled key in prod.

> **Dev-env note:** Turbopack cold compiles are very slow here (60–90s per first route hit). Functionality is unaffected; just expect lag on first navigation to a new route.

## Run it
```bash
cd ~/Projects/ai-sales-os && npm run dev     # preview on :3100
```
Seeded logins (password `password123`): `admin@agency.test`, `manager@agency.test`, `csr@agency.test`
