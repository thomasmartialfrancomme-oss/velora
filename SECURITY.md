# Security posture — VELORA PRIVATE

Written for the people who will actually operate this: an CISO review asks "what is in place, where is the code that does it, and what is *not* in place". Everything below is stated with a file reference so it can be checked in minutes, and the gaps are listed as gaps.

Last reviewed against this working tree: **the state of the `main` checkout on 2026-09-06** — run `npm run check` (typecheck + `db:verify`) and `npm run smoke` to re-establish the claims that can be automated.

---

## 1. Who this protects against

| Adversary | Primary controls |
| --- | --- |
| Another member of the platform (horizontal escalation) | `user_id` in every member-facing query; ownership-checked `getById`; 404 for foreign ids — asserted by `npm run smoke` |
| Credential stuffing / brute force | bcrypt cost 12, per-IP **and** per-address rate limits, generic error text, no user enumeration |
| CSRF | `SameSite=Lax` cookie + a host check on every mutating request; no state change on `GET` |
| XSS, including via an uploaded document | React escaping with no `dangerouslySetInnerHTML` anywhere; uploads served only as `Content-Disposition: attachment`, never inline; extension allow-list |
| ID enumeration / scraping | Opaque ids (`usr_…`, `doc_…`), no sequential keys, per-scope rate limits |
| Exfiltration through the AI vendor | Context assembled server-side from the caller's own rows only; a provider never receives cookies, credentials, file contents or storage paths |
| A careless operator | The app refuses to boot in production without `AUTH_SECRET`; the demo signing key is a published constant that throws before it could be used there |
| A malicious administrator | Console sees account *states*, not member content; role changes require an account that is not your own; every action is written to `audit_events` |

## 2. Authentication and sessions

* **Hashing** — `bcryptjs`, cost `BCRYPT_ROUNDS` (default 12). `src/lib/auth/password.ts`. Plaintext is never stored, logged or returned; the API cannot send a hash because the row mappers do not select `password_hash`. Swapping to argon2 means replacing that one file.
* **Policy** — minimum 12 characters, common-password block-list, scored strength in the register form. `inspectPassword()`.
* **Session** — a signed JWT (HS256, `jose`) in a cookie named `velora_session`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`, `Max-Age` = `AUTH_TOKEN_TTL_DAYS` (default 7, capped at 30). Claims are `{sub, email, role}` and nothing else. `src/lib/auth/token.ts`.
* **Verification is done twice, deliberately** — at the Edge (`src/middleware.ts`, so an unauthenticated visitor never reaches a page) and again inside every handler (`requireApiUser`/`requireApiAdmin`), which re-reads the account from the database. A valid token is therefore not sufficient if the row says otherwise.
* **Revocation** — `users.sessions_revoked_at`. Any token issued before that timestamp is refused. It is set on passphrase change, on suspension from the console, and on account deletion. `src/app/api/account/password/route.ts`, `src/app/api/admin/users/[id]/route.ts`.
* **Logout** clears the cookie and the audit trail records it; there is no client-side "logged out" state to trust.

## 3. Authorisation and tenant isolation

1. `api({ scope, auth })` — `auth: 'admin'` requires the `admin` role claim *and* a live account in good standing.
2. `src/lib/data/read.ts` / `write.ts` — every member-facing function takes `userId` as its first argument and puts it in the `WHERE` clause. There is deliberately no unscoped "find by id".
3. Foreign ids return **404, not 403**, so existence is not leaked.
4. `src/lib/data/admin.ts` is the only module permitted to cross accounts; it is reachable only through `/api/admin/*` and `/admin/*`, both guarded (`requireAdmin()` in the page tree, `auth:'admin'` in the routes).
5. An administrator cannot change their own role or status (`self_modification`, 400).
6. `npm run db:verify` fails if any member-owned table loses its `user_id` column, and if any child row's owner differs from its parent's (`trip_legs` vs `trips`) — isolation is a checked property, not a convention.

## 4. CSRF, origin and the API surface

* Cookie is `SameSite=Lax`: a cross-site form post does not carry it.
* Every non-`GET`/`HEAD` API request additionally passes `assertSameOrigin()` (`src/lib/http/security.ts`): the `Origin` (or `Referer`) host must equal the `Host`. A rejected request becomes a clean `403 origin_rejected`, mapped in `src/lib/http/responses.ts`.
* **The `x-velora-client: api` header** allows a request that carries neither `Origin` nor `Referer` — i.e. server-side callers, `curl`, and this repository's smoke test. It is not a CSRF hole: a browser always attaches `Origin` to a cross-site state change, so the header cannot make one look same-origin. If your deployment never needs non-browser callers, delete that branch — it is nine lines in one function.
* No state change is accepted from `GET`. All responses from `/api/*` carry `Cache-Control: no-store`.

## 5. Rate limiting

| Endpoint | Budget |
| --- | --- |
| Login | 12 per minute per IP, plus 8 per 5 minutes per address |
| Register | 5 per 10 minutes |
| Forgot-password | 5 per 10 minutes per address |
| Coordinator requests | 120 per minute per IP, *plus* the plan's daily allowance (`ai_requests_per_day`) — counted from `getAiUsageToday`, so the plan limit is a per-member daily ceiling |
| Membership changes | 8–10 per 10 minutes |
| Everything else | `RATE_LIMIT_MAX` per `RATE_LIMIT_WINDOW_MS` per IP+scope (default 30/60 s) |

Fixed-window, in-process counters (`src/lib/http/security.ts`) — adequate for one node. **Behind more than one instance, replace `consume()` with a Redis or Dynamo counter**; otherwise an attacker simply multiplies their budget by the number of pods. The same file hashes the client IP with a per-install salt for the audit trail: no raw addresses are stored.

## 6. Input handling

* Every body is parsed by a zod schema in `src/lib/validation/schemas.ts` before a handler sees it: strings are trimmed and length-capped, enums are enumerated, dates coerced to ISO with ranges checked in the data layer. Unknown keys are dropped by zod rather than passed through (no schema opts into `.strict()`, so a stray field is ignored, not stored).
* All SQL is parameterised through `getDb().all/get/run` with **named parameters**; there is no string-concatenated query in the repository, and table/column identifiers come from the `tables.ts` map, not from user input.
* Client components reuse the same schemas for pre-flight, so a bad field is reported inline rather than after a round trip — but the server never trusts that check.

## 7. Files

`src/lib/files.ts` and `src/app/api/documents/*`.

* Allow-list of twelve extensions (pdf, docx, xlsx, pptx, csv, txt, md, png, jpg, jpeg, webp, heic), `MAX_UPLOAD_BYTES = 15 MB`, name reduced to a basename with disallowed characters replaced, path confined to `data/uploads/<userId>/`.
* Only a **relative** path is stored, on the document row, and it is resolved under the uploads root before any read — a record cannot be pointed at `/etc/passwd`.
* Downloads go through `GET /api/documents/[id]/file`, which re-checks ownership, streams with `Content-Disposition: attachment` and the recorded MIME type only. Files are never under `public/`, so no web server rewrite can serve them.
* **No virus scanning** in this build. If members will upload documents that are later opened on a workstation, put an ICAP/ClamAV or a queue-based scanner in front of the write path.
* `node scripts/db-cli.mjs orphans --fix` reconciles files and records after a partial upload or a manual deletion.

## 8. Transport, headers, embedding

Shipped on every response (`next.config.mjs`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `poweredByHeader: false`, and `no-store` on all API responses. Source maps are not published.

**Deliberately absent in this profile:** `Content-Security-Policy` and `X-Frame-Options`. The build is configured to be embeddable in preview and operations tooling, which requires allowing frames and relaxing script sources. For a real deployment, paste this into `next.config.mjs` and treat it as the baseline:

```js
{ key: 'Content-Security-Policy', value:
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; " +
  "base-uri 'none'; form-action 'self'; object-src 'none'" },
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
```

`script-src 'unsafe-inline'` is present only because Next.js 14 inlines its bootstrap script; move to nonce-based CSP (`next/script` + a middleware nonce) if your standard forbids it. TLS ends at your proxy; the app assumes `Secure` cookies in production and does not attempt its own certificate work.

## 9. What the AI provider sees

The provider is a pluggable component; what it receives is fixed by `src/lib/ai/context.ts` and is the same for every provider:

* residence names, cities, statuses, next service dates, occupancy temperature, monthly operating budget;
* open tasks (title, status, due date), journeys (title, date, status, unconfirmed step count), ledger totals for the current month, vehicles and their readiness, supplier requests, and document **names, categories and statuses** (never file contents, never storage paths; the plain-text digest sent alongside lists at most twelve);
* the member's own request text (≤600 characters).

Never: passwords or hashes, session material, cookies, document contents, IP addresses, or another member's data. The context is built from the acting session server-side, so a provider cannot be prompted into a wider scope than the caller already has. Requests are capped per day by plan; the deterministic in-house provider needs no external call at all and is what runs unless `AI_PROVIDER_URL` and `AI_API_KEY` are set. If an external gateway is configured, that vendor becomes a data processor for the fields above — put it in your DPA and your retention schedule.

## 10. At rest, backups, logs

* The SQLite file (`data/velora.db`) is **not encrypted by the application**. Use filesystem or block encryption (LUKS, an encrypted EBS volume, cloud-disk CMEK) and `0600`/`0700` permissions for the `data/` directory.
* WAL mode is on: back up with `sqlite3 data/velora.db ".backup target.db"`, not by copying one file while the app runs.
* Uploads are plain files on the same volume — encrypt the volume and exclude `data/uploads/` from any world-readable share.
* Server logs contain request ids, route names and error text. Secrets are never logged; the one exception is intentional and bounded: with no SMTP configured, password-reset and invite links are logged so a demo can continue, and the API returns them **only when `NODE_ENV !== 'production'`**. Configure `SMTP_URL` before going live, and confirm your log shipping does not index that line.
* `audit_events` is append-only by design (no update or delete path exists in the data layer) and includes authentication, membership and admin actions. It is retained until an account is deleted, which also removes its audit rows.

## 11. Secrets policy

* `.env.example` is the only env file in the repository and contains no values. Real keys live in the environment or a secret manager.
* Client-side code cannot read a secret: only `NEXT_PUBLIC_APP_URL` is exposed, and `src/lib/config.ts` is a server-only module that exports **capability booleans**, never key material.
* Stripe keys, the AI API key and `SMTP_URL` are read from `process.env` at call time inside server files (`src/lib/billing/*`, `src/lib/ai/providers/*`, `src/lib/config.ts`) and are never sent to the browser.
* `AUTH_SECRET`: mandatory in production, minimum 32 characters, rotation invalidates every session (which is the intended behaviour).

## 12. What is not implemented — read this before an audit

| Gap | Consequence | Closure |
| --- | --- | --- |
| No 2FA / WebAuthn | A stolen passphrase is a full session. The `/settings` screens say this is designed and not shipped, rather than implying a control. | TOTP for v1, hardware keys for the audience that will demand them; revoke sessions on enrolment |
| No device/session list | A member cannot see or kill an individual session — a passphrase change revokes all of them instead | Store `jti` per session, list `{ip hash, UA, last seen}` |
| No email delivery | Reset and invite links come from the server log or the console | `SMTP_URL` + a template pass, plus rate limits on send |
| Payments are simulated unless Stripe keys exist | No money moves; a demo cannot show a real receipt | Set `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`; keep the webhook as the only writer of "paid" |
| Rate limits are per-process | Multi-instance deployments multiply the budget | Redis counters in `consume()` |
| No CSP/frame protection in this profile | Embedding and inline scripts are permitted | § 8 block; nonce-based CSP if required |
| No virus scanning | A malicious document reaches the downloader's machine | ICAP/ClamAV on the write path |
| Single-node SQLite | No replication, no horizontal write scaling, backup is manual | Postgres via the documented single-file swap; add RLS as defence in depth |
| No field-level encryption of document contents | An attacker with disk access reads files | Encrypt at rest (volume) or per-object keys with KMS |
| Not penetration tested; no DPIA, DPA or SOC 2 artefacts | Regulatory and contractual review remains open | Third-party test before onboarding a principal; document the data flow above for the DPIA |

## 13. Operator checklist before going live

1. `AUTH_SECRET` set (32+ chars, from a secret manager, rotated on suspicion).
2. TLS terminated at the proxy; HSTS enabled; `NEXT_PUBLIC_APP_URL` matching the real origin (it is used for callbacks and links).
3. Paste the § 8 header block into `next.config.mjs`, then `npm run build && npm start`.
4. `SMTP_URL` configured; confirm reset links no longer appear in logs.
5. Stripe keys + webhook endpoint with its signing secret.
6. Delete the demo households (`admin@velora.private` and both demo principals) once real accounts exist — `npm run db:users`, then the console or `sql --write`.
7. Confirm `GET /api/health` reports what you expect, and that it is not reachable from the public internet if that bothers you.
8. Backups scheduled and **restore-tested**; uploads included in the same job.
9. `npm run smoke` against the deployed origin: it asserts isolation, guards and every page, and takes a few seconds.
10. Review § 12 with the principal's own security team before any household data is loaded.

## 14. Reporting

Send reports to `security@velora.private` (PGP on request). Expect an acknowledgement within one business day; the private office answers 07:00–01:00 CET. Do not open a public issue for anything that reads another member's data.
