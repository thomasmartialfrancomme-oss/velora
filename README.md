# VELORA PRIVATE

**AI Private Estate & Lifestyle Manager** — a membership platform for principals, family offices and estate managers who run several residences, staff, vehicles, travel and a household ledger, and who want one place that holds all of it and answers questions about it.

This repository is a working application, not a mock-up. Landing pages, registration, login, eleven member modules, an API, a database, an AI coordinator, a membership/billing flow and an administration console are implemented and runnable. Everything that depends on an outside account (a payment provider, a model gateway, a mail server) is wired to the edge, clearly marked where it stops, and refuses to pretend.

```bash
npm install
npm run db:seed          # schema + demo households (three accounts, 8 residences, 168 ledger entries…)
npm run dev              # http://localhost:3000
```

Sign in with the demo principal:

| Account | Address | Passphrase | What it shows |
| --- | --- | --- | --- |
| Principal | `alexander@velora.private` | `Velora2026!` | Six residences, full ledger, AI history, staff |
| Family office | `henrik@sund-familyoffice.li` | `Velora2026!` | A second, **separate** account — use it to see isolation |
| Private office | `admin@velora.private` | `VeloraAdmin2026!` | Administration console |

Change these in `db/demo-data.mjs` (`DEMO_CREDENTIALS`). They exist only so a demo can start; the register flow creates real accounts with real password hashing.

---

## Contents

| | |
| --- | --- |
| [What works](#what-works) | [Verification](#verification) |
| [What is not switched on](#what-is-not-switched-on-and-exactly-what-would-turn-it-on) | [Architecture](#architecture) |
| [Privacy model](#privacy-model) | [AI layer](#the-ai-layer) |
| [Membership & billing](#membership-and-billing) | [Database CLI](#database-cli) |
| [Launching it](#launching-it) | [First administrator](#the-first-administrator-account) |

---

## What works

**Access and accounts.** Registration with a passphrase strength meter (12 characters minimum, bcrypt cost 12, no plaintext at rest), login with per-IP and per-address rate limits, signed HttpOnly session cookie, server-side session revocation, forgot-password with a single-use hashed token (the link is logged, because no mail server is configured — see below), access requests queue for new households.

**Eleven member modules**, each with server-rendered views, URL-driven filters, and full create/edit/delete through the API:

| Module | What is genuinely there |
| --- | --- |
| `/dashboard` | Today's briefing, arrival window, open items, spend split by category, awaiting-confirmation queue, recent activity — all queried from your rows |
| `/briefing` | The morning read, assembled from fixed queries (no model writes it), past-due items, per-module counts |
| `/properties` | Residences with condition, occupancy, staff assigned, open tasks, budget vs actual; `/properties/[id]` per residence |
| `/people` | Staff and external advisers: roles, contracts, access windows, live status, per-person task load |
| `/vehicles` | Fleet readiness, servicing dates, insurance status, assigned driver |
| `/travel` | Journeys with ordered steps (`trip_legs`), each with provider, reference and status; `/travel/[id]` shows an arrival plan and lets you mark a step confirmed |
| `/lifestyle` | Supplier requests: restaurants, access, purchases — every request carries a status and a "requires confirmation" state rather than a fake booking |
| `/documents` | Indexed documents with categories, owners, versions, expiry, visibility; **real file upload** (15 MB, extension allow-list, stored outside the web root, served back only to the owner as an attachment) |
| `/finance` | Ledger entries by category and residence, month totals, filters, entry creation, per-entry document links |
| `/ai` | The coordinator: a command line that answers from your own records, structured blocks (checklists, tables, notes), proposed actions you can approve, defer or decline, conversation history |
| `/settings` | Profile, notification preferences, passphrase change, **JSON export of everything**, and account deletion with a typed confirmation |

**Plus:** `/membership` (plan state, invoices, switch plan, cancel/resume, portal), `/support` (write to the office; answers appear in the thread and as a message), `/admin` (overview, accounts, access queue with invites, correspondence with replies).

**API.** 47 route files under `src/app/api`, all behind one handler (`src/lib/http/handler.ts`) that enforces, in order: origin check → rate limit → authentication → authorisation → schema validation (zod) → handler → uniform envelope `{ok, data}` / `{ok, error{code,message,fields}}`. Every read is filtered by `user_id`; there is no route that takes another member's id and returns their rows.

**Nothing is faked.** Where an action needs an outside party — booking a table, dispatching a crew, charging a card — the platform records the intent, marks it `requires_confirmation`, and says `Action requires confirmation.` A demo booking is never presented as a completed one.

## Verification

Three commands, all run against this repository:

```bash
npm run typecheck   # tsc --noEmit, strict mode — clean
npm run db:verify   # schema, integrity, foreign keys, bcrypt digests, tenant columns, isolation
npm run smoke       # 48 checks over HTTP: every page, key reads, upload→download→delete, privacy, guards
```

`npm run smoke` (`scripts/smoke.mjs`, no test framework, plain Node) is the one that matters for a product like this, because it asserts the things a demo breaks first: no page renders an error boundary; two unrelated accounts see disjoint rows; reading another member's record by id returns 404; a state change without an `Origin` header returns 403; a principal calling an admin endpoint returns 403; an anonymous visitor to `/dashboard` is redirected to `/login?next=…`; the coordinator answers; a task and a document each round-trip (create → read → delete, including a PDF whose name contains an em dash, which is how a naive `Content-Disposition` first fails in production). It leaves exactly one artefact behind on purpose: the AI conversation it asks for, so `/ai` has something real to read.

Last run against this tree: **typecheck clean · `db:verify` every check passed · smoke 48/48.**

## What is not switched on — and exactly what would turn it on

| Capability | State here | How to turn it on | What changes |
| --- | --- | --- | --- |
| **Payments** | Demo mode. Membership changes are written to our own database; every screen says no payment was taken. | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` in `.env.local`, then point the webhook at `/api/billing/webhook` | Checkout and the customer portal redirect to Stripe; "paid" is only recorded when the webhook says so |
| **AI model** | Deterministic in-house provider (`velora-demo`): real analysis over your own rows, no external call, no invented facts | `AI_PROVIDER_URL` + `AI_API_KEY` (optionally `AI_MODEL`, `AI_TIMEOUT_MS`) | Requests are routed to your provider through `AIService`; on any provider error it falls back to the deterministic one and the response says so |
| **Email** | No transport. Reset and invite links are written to the server log, and in development only also returned to the UI | `SMTP_URL` (and `MAIL_FROM`) | Links go out by email instead of the log; nothing else changes |
| **Hardware-key 2FA** | Designed, not shipped. The security screens say this plainly rather than implying a control that is absent | — | See `SECURITY.md` § Roadmap |
| **Virus scanning of uploads** | Absent, and stated in the file-storage comment | an ICAP/clamav sidecar at the storage layer | — |

`GET /api/health` reports the live state of all of these, so nobody has to guess during a demo.

## Architecture

```
db/            schema.sql (21 tables), seed-core.mjs, demo-data.mjs
data/          velora.db (SQLite, git-ignored) · uploads/ (stored files, git-ignored)
src/
  middleware.ts        Edge gate: session present & valid on protected paths
  lib/
    config.ts          server-only env surface; capability flags for the UI
    db/                SQLite handle + tiny query helper (parameterised, named params)
    auth/              password (bcrypt), token (jose HS256), session, register
    http/              api() handler, responses, origin guard, rate limiting, client
    validation/        zod schemas, shared by API and forms
    data/              tables.ts (row mappers), read.ts, write.ts, analytics.ts, admin.ts
    ai/                types, analysis (intents), context builder, providers, service
    billing/           provider abstraction: DemoBilling | StripeBilling + webhook logic
    files.ts           upload storage
  components/
    ui/                buttons, panels, fields, tables, modal, toast, record-form engine
    marketing/         landing sections
    app/               shell, sidebar, topbar, palette, chrome, module widgets
  app/
    (marketing)/       landing, about, membership, security, terms, privacy, access request
    (auth)/            login, register, forgot-password (reset is the same screen)
    (app)/             the eleven member modules + admin/*
    api/               47 route files
scripts/db-cli.mjs     status · verify · seed · reset · users · invite · promote · set-password · export · orphans · sql
```

**Request lifecycle.** Browser → `middleware.ts` (is there a valid session for a protected path) → route file built by `api()` (origin, rate limit, auth, role, zod) → data layer (`read.ts`/`write.ts`, always with `user_id`) → server component re-render. Client components never fetch data to render a page: they mutate through the API, then `router.refresh()` lets the server components re-read. That is why a screen cannot show state the database does not have.

**Why SQLite.** The brief demanded something that runs and can be demoed without provisioning. `better-sqlite3` is synchronous, embedded, and gives us real transactions and foreign keys with zero setup. The schema is written in the SQLite/PostgreSQL common subset and every query funnels through one file, `src/lib/db/index.ts`, so moving to Postgres means replacing that handle (`all/get/run/exec`) and the `date('now')` idioms — not rewriting the app. This is documented, not implemented: no Postgres code path ships.

**The data layer, in one paragraph.** `src/lib/data/tables.ts` defines a thin table object with a zod row schema and column mapping (camelCase in, snake_case out). `read.ts` holds every member-facing query, each taking `userId` as its first argument; `write.ts` holds every mutation and is the only thing that inserts. `admin.ts` is the one module allowed to cross accounts, and both its page and its routes require the `admin` role.

## Privacy model

Three independent layers, because one of them will eventually be forgotten:

1. **The query.** Every member-facing SQL statement includes `user_id = @userId`. There is no "get by id" that omits it — `getById`-style helpers take the owner id too, which is why reading someone else's record is a 404 rather than a leak.
2. **The handler.** `api()` authenticates and authorises before running a handler; `auth: 'admin'` for the console, `scope` strings drive rate limiting budgets.
3. **The edge.** `middleware.ts` refuses to render protected pages without a valid signed session, and API responses are `no-store`.

Also: no third-party scripts, fonts are self-hosted through `next/font`, uploaded files live outside the web root and are streamed back only to their owner, the audit trail stores a salted hash of the IP rather than the address, and a member can export or delete their own data without asking anyone.

Sessions carry `{sub, email, role}` — nothing else. Sensitive state is re-read from the database on each request, and `sessions_revoked_at` (set on passphrase change, suspension, or account deletion) invalidates every older token server-side.

## The AI layer

`AIService` (`src/lib/ai/service.ts`) is the only thing the UI talks to. It takes a request plus a *bounded* context assembled from the member's own rows (`src/lib/ai/context.ts`), detects intent (`analysis.ts`), and returns structured blocks:

```ts
type AIBlock =
  | { type: 'kv'; … } | { type: 'list'; … } | { type: 'checklist'; … }
  | { type: 'table'; … } | { type: 'note'; … } | { type: 'actions'; … }
```

* **Providers are swappable** in `src/lib/ai/providers/`: `deterministic-provider` (in-house, always available, reads only the local database) and `http-provider` (posts the context to `AI_PROVIDER_URL` with `AI_API_KEY`, 12 s timeout). `AI_PROVIDER=auto` prefers the external one when configured and falls back on any failure.
* **It cannot act.** Answers propose. Every proposal becomes an `ai_tasks` row with status `requires_confirmation`, and only an approve/defer/decline decision from a signed-in member changes it. The coordinator has no code path that books, pays or sends.
* **It cannot invent numbers.** Prices, dates and counts in an answer come from the same queries the pages use; the model is asked to *structure and sequence*, and the deterministic provider needs no model at all.
* **Budgets apply.** `ai_requests_per_day` from the plan is enforced per UTC day (`getAiUsageToday`), and the whole exchange — question, answer, actions, decisions — is stored, so the office and the member read the same record.

## Membership and billing

**Prices are one edit.** `src/lib/utils/format.ts`, the block marked `PRICES`: `MEMBERSHIP_PLANS` carries name, positioning, monthly cents, annual discount, residence and staff limits, AI budget, response SLA and features. The landing page, `/membership`, the API, the checkout amount and the admin console all read that list — there is no second copy to forget.

```
PRIVATE         €199    per month   one residence, the essentials                      annual −10%
PRIORITY        €499    per month   up to four residences, a named estate coordinator   annual −12%   (most chosen)
PRIVATE OFFICE  €1,500+ per month   unlimited residences, a dedicated team of three     annual: one invoice
```

**Billing is an abstraction too** (`src/lib/billing/index.ts`): `DemoBilling` writes subscription state and an open invoice into our database and returns `simulated: true`; `StripeBilling` returns a Checkout URL and a customer-portal URL. `getBillingStatus()` decides which is live and every screen shows it (`billing/provider/simulated` in the API responses). The webhook at `/api/billing/webhook` verifies the Stripe signature, then maps five events — `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` — onto the subscription row — so "paid" arrives only from the provider, never from a button.

To go live: add the keys, create the three Products in Stripe, put their price ids in `STRIPE_PRICE_*`, and register `https://your.host/api/billing/webhook`.

## Database CLI

`scripts/db-cli.mjs` — no framework imports, so it works even when the app itself is broken.

```bash
npm run db:status      # file, size, integrity, accounts, memberships, workload
npm run db:seed        # schema + demo data (refuses to overwrite without --force)
npm run db:reset --yes # delete the database and uploads, then rebuild
npm run db:verify      # 21 tables, foreign keys, bcrypt digests, tenant columns, isolation
npm run db:users       # accounts with role, state, residences, plan
node scripts/db-cli.mjs promote <email>            # give console access
node scripts/db-cli.mjs demote <email>
node scripts/db-cli.mjs set-password <email> <pw>  # bcrypt + revoke every session
node scripts/db-cli.mjs invite <email> <first> <last>
node scripts/db-cli.mjs export <email> out.json    # every row for one member
node scripts/db-cli.mjs orphans --fix              # files without records, records without files
node scripts/db-cli.mjs sql "SELECT …"              # read-only; --write for statements
```

## Launching it

1. **Provision** any Node 18.18+ host. `npm ci && npm run build && npm start` (the `start` script binds `0.0.0.0:3000`; put nginx/Caddy/Cloudflare in front and terminate TLS there).
2. **Secrets.** `AUTH_SECRET` is mandatory in production — the process throws on boot rather than using the development fallback. Generate with `openssl rand -base64 48`. Everything else in `.env.example` is optional.
3. **Database.** Default path `./data/velora.db`; set `VELORA_DB_PATH` to put it on a persistent volume. `npm run db:seed` creates the schema; drop the demo data by seeding against an empty file and registering your own principals. Back up with `sqlite3 data/velora.db ".backup …"` — WAL, so a bare file copy while running is not enough.
4. **Uploads.** `data/uploads/` must be writable and must never be exposed by the web server (it isn't: it is not under `public/`).
5. **Headers.** `next.config.mjs` ships `nosniff`, `Referrer-Policy`, `Permissions-Policy` on every response. Frame-ancestors and CSP are deliberately left open in this profile so the app can be embedded in preview/ops tooling — `SECURITY.md` has the production set to paste in.
6. **Integrations.** Add Stripe, the model gateway and SMTP only when the accounts exist; the UI adapts by itself and says what is live.
7. **After the first login**, sign out of the demo accounts, delete them from `/admin/users`, and change `DEMO_CREDENTIALS` in the repository so nobody inherits a known password.

## The first administrator account

Three ways, in the order you would use them:

1. **From the console.** Any existing account with the `admin` role can grant it: `/admin/users` → *Grant office access*. In this repository `admin@velora.private` already holds that role, which is exactly how a real deployment bootstraps itself.
2. **From the shell**, when no administrator exists yet (the chicken-and-egg case):
   ```bash
   npm run db:users                        # find the address you registered with
   node scripts/db-cli.mjs promote you@yourdomain.com
   ```
   Sign in again — `/admin` appears in the sidebar and the API accepts your calls.
3. **By invite**, for a new office member: `/admin/access-requests` → *Send an invite*. That creates an account in the `invited` state whose stored credential is `unusable:<random>`, plus a 14-day single-use reset link. **No passphrase is ever generated on someone's behalf**; they choose their own, and until they do the account cannot read anything.

An administrator can never change their own role or status from the console (`/api/admin/users/[id]` refuses `self_modification`) — locking yourself out of your own deployment is the oldest accident in the trade. Administrators see account *states* and triage queues; they cannot read a member's ledger, documents, residences or AI conversations.

---

## Repository hygiene

What is committed and what is not, because the wrong file in a repository of a system like this is an incident, not a mistake:

| | |
| --- | --- |
| **Committed** | Source, `db/schema.sql` + the two seed modules, `package-lock.json` (reproducible installs), `.env.example` with empty values, docs, scripts |
| **Ignored, deliberately** | the whole `data/` tree — the SQLite database, its WAL sidecars and every uploaded document (only two `.gitkeep` files are tracked, so the structure survives a clone); `.env` and any `.env.*` but the example; `*.pem`, `*.key`; `node_modules/`, `.next/`, `*.log`, `*.tsbuildinfo` |
| **Verified before the first commit** | no `sk_live`/`sk_test`/`AKIA`/`ghp_` shaped strings, no private-key blocks, no non-empty value in `.env.example`. The only passphrases in the tree are the seeded demo accounts in `db/demo-data.mjs`, which the README tells you to change |
| **Line endings** | `.gitattributes` forces LF in the repository and on checkout, marks binaries, and keeps `package-lock.json` out of review diffs |

First push, from this directory:

```bash
git init -b main && git add -A
git status --porcelain | grep -E "^A\s+(data/\.|.*\.db)" || echo "clean: no runtime state staged"
git commit -m "VELORA PRIVATE — platform, admin console, docs"
git remote add origin <your-repository-url>
git push -u origin main
```

---

### Deliberate choices worth knowing about

* **No UI kit, no chart library.** The tables, panels, tabs and forms are eleven small components in `src/components/ui`, so nothing arrives with a default blue.
* **Colour is restricted on purpose:** deep black, ivory, graphite, and a metallic gold used for emphasis only — one hairline, one figure, never a filled button.
* **Type.** Cormorant Garamond for titles (uppercase, tracked), Manrope for the interface. Both self-hosted.
* **Copy is written for principals.** No exclamation marks, no "delight", no invented client logos or fake press quotes.
* **Server components own the reads.** Client components only mutate and then refresh, which is why a screen cannot show state the database does not have.
