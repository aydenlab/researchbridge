# ResearchBridge

ResearchBridge connects students with open research opportunities at their university and gives researchers a structured way to find candidates for a specific project.

Students build one profile, browse positions that are actively recruiting, and apply to the projects that interest them. Researchers post a real opening, state the criteria that matter for that project, and review applications organised around those criteria.

The first pilot runs at **Example University in September 2026**, starting with Health Sciences and Life Sciences.

---

## Requirements

- Node.js 20 or later (22 recommended, see `.nvmrc`)
- npm 10 or later
- PostgreSQL 14 or later for production

There is no local PostgreSQL requirement for development. When `DATABASE_URL` is empty the application falls back to a file-backed [PGlite](https://pglite.dev) database in `.pgdata`, using the same Drizzle schema and the same migrations. Setting `DATABASE_URL` switches to `node-postgres` with no other change.

The fallback is deliberately development-only. PGlite lives inside the Node process, so a multi-worker production server would give each worker its own database and silently lose writes. Starting with `NODE_ENV=production` and no `DATABASE_URL` therefore fails immediately with an explanatory error rather than booting into that state.

---

## Local development

```bash
npm install
cp .env.example .env          # fill in SESSION_SECRET at minimum
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000.

**Important:** the PGlite development database is a single-writer directory. Stop the dev server before running `db:migrate`, `db:seed`, or `db:reset`, or the data directory can be corrupted. Concurrent queries within the dev server itself are serialised through a queue for the same reason. None of this applies once `DATABASE_URL` points at a real PostgreSQL instance.

### Signing in locally

`EMAIL_PROVIDER=console` prints verification codes to the server console instead of sending them. Sign in with any seeded address and copy the six-digit code from the terminal.

| Role | Email |
| --- | --- |
| Admin | `admin@myresearchbridge.com` |
| Researcher (verified) | `okonjoa@example.edu` |
| Researcher (awaiting approval) | `p.vasquez@example.edu` |
| Student with applications | `adeyemij@example.edu` |
| First-year student, no experience | `obrienk@example.edu` |

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL connection string. Empty in development falls back to PGlite. |
| `APP_URL` | Yes | Public base URL. Used for metadata, sitemap, and links in email. |
| `SESSION_SECRET` | Yes | At least 16 characters. Signs session tokens and verification code hashes. Rotating it invalidates all sessions and codes. |
| `CRON_SECRET` | No | Locks down `POST /api/cron/weekly-digest`. Not needed: the digest schedules itself. Set it to close the manual endpoint, or to be able to resend a week that has already gone out. |
| `DIGEST_AUTORUN` | No | Whether the app schedules the weekly digest itself off its health check. On by default. Set to `false` only if you want to drive the endpoint yourself. |
| `ADMIN_EMAILS` | First deploy | Comma-separated addresses that become ResearchBridge administrators on sign in, bypassing the institution domain check. Needed to bootstrap a fresh database, which has no institutions until an admin creates one. |
| `ANTHROPIC_API_KEY` | No | Enables Claude evidence analysis. Server only, never prefixed with `NEXT_PUBLIC_`. A key the provider rejects is reported as such on `/admin/system` rather than as an outage. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5`. Changing the model does not require a code change. |
| `ANTHROPIC_PROMPT_CACHE_ENABLED` | No | Marks the stable part of each prompt as cacheable. On by default. |
| `AI_DAILY_BUDGET_USD` | No | Estimated spend allowed per UTC day before analysis stops. Defaults to 25. |
| `AI_MONTHLY_BUDGET_USD` | No | Estimated spend allowed per UTC month. Defaults to 250. The monthly cap is checked first, so it has to leave room for the daily one to matter. |
| `AI_MAX_CALLS_PER_MINUTE` | No | Provider calls allowed across the deployment per minute. Defaults to 20. |
| `AI_MAX_CALLS_PER_DAY` | No | Provider calls allowed across the deployment per day. Defaults to 500. |
| `AI_MAX_CALLS_PER_SUBJECT_PER_HOUR` | No | Calls allowed for one application per hour, which bounds refresh clicking. Defaults to 5. |
| `AI_MAX_SECTION_CHARS` | No | Longest single block of student text sent to the model. Defaults to 8000. |
| `AI_MAX_INPUT_CHARS` | No | Longest whole request sent to the model. Defaults to 24000. |
| `AI_RESPONSE_CACHE_TTL_HOURS` | No | How long a successful cached result is reused. Defaults to 168. |
| `AI_NEGATIVE_CACHE_TTL_MINUTES` | No | How long a transient failure is remembered before a retry. Defaults to 30. |
| `AI_BREAKER_FAILURE_THRESHOLD` | No | Consecutive provider failures that pause calls. Defaults to 4. |
| `AI_BREAKER_COOLDOWN_SECONDS` | No | How long calls stay paused after that. Defaults to 120. |
| `EMAIL_PROVIDER` | No | `console` (default), `resend`, or `smtp`. |
| `EMAIL_FROM` | No | From address on transactional email. |
| `EMAIL_API_KEY` | No | Provider key when `EMAIL_PROVIDER=resend`. |
| `FILE_STORAGE_PROVIDER` | No | `local` (default) or `s3`. |
| `FILE_STORAGE_BUCKET` | No | Bucket name for object storage. |
| `FILE_STORAGE_PUBLIC_URL` | No | Public base URL for object storage. |
| `AI_ANALYSIS_ENABLED` | No | Initial value of the feature flag. |
| `VIDEO_RESPONSES_ENABLED` | No | Initial value of the feature flag. Off by default. |
| `WAITLIST_ENABLED` | No | Initial value of the feature flag. |
| `PUBLIC_SIGNUP_ENABLED` | No | Initial value of the feature flag. |
| `RESEARCHER_SIGNUP_ENABLED` | No | Initial value of the feature flag. |

Environment variables seed the feature flags. Once a flag row exists in the database, the admin panel at `/admin/system` is the source of truth.

Never commit real credentials. `.env` is git-ignored and `.env.example` contains names only.

---

## Database

Schema lives in `src/db/schema.ts`. Migrations are generated, not hand-written.

```bash
npm run db:generate        # after editing the schema
npm run db:migrate         # apply pending migrations
npm run db:seed            # replace all data with development seed data
npm run db:reset           # drop and recreate the public schema
npm run db:studio          # browse the database
npm run digest:weekly      # run the weekly email digest by hand (--force resends a period)
```

`db:seed` truncates every table. Never run it against production.

Integrity is enforced in the database as well as in application code: unique user email, unique institution slug, one application per student per opportunity, foreign keys with deliberate cascade behaviour, and check constraints for non-negative hours, ordered hour ranges, and valid academic values.

---

## Testing

```bash
npm run test         # 133 tests
npm run typecheck
npm run check        # typecheck, tests, and a production build
```

Tests run against an in-memory PGlite instance created in `tests/setup.ts`, migrated with the real migration files. Nothing touches the development database.

Coverage:

- **Unit** grading scale handling, deterministic criteria, weight normalisation, permission and status transition rules, and HTML form parsing including the single-checkbox case.
- **Integration** verification code lifecycle and rate limiting, duplicate application prevention, snapshot immutability, criterion persistence, opportunity search and filtering, database constraints, researcher and student authorisation boundaries.
- **AI** structured output parsing, schema rejection, provider errors, rate limits, missing API key, invented criterion ids, prompt injection inside application text, and the paid-position restriction.

---

## Railway deployment

1. Create a Railway project from this GitHub repository.
2. Add the **PostgreSQL** plugin.
3. Link the database to the application. Railway creates the database as a **separate service**, and your application service does not inherit its variables. In the application service, open Variables and add a reference:

   ```
   DATABASE_URL = ${{Postgres.DATABASE_URL}}
   ```

   Replace `Postgres` with the exact name of your database service. Without this the pre-deploy migration stops with an explanatory error rather than starting against an embedded database.
4. Set the remaining variables in the application service:
   - `APP_URL` (your Railway domain, no trailing slash)
   - `SESSION_SECRET` (generate with `openssl rand -base64 32`)
   - `ADMIN_EMAILS` (your own address, so you can sign in and configure the first institution)
   - `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` when you want the evidence layer on
   - `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` for real email
   - `FILE_STORAGE_PROVIDER=s3` plus bucket settings before relying on uploads
5. Deploy. `npm run start` applies any pending migrations, logs what it found, and then serves the app.
6. Health check: `GET /api/health` is a liveness check. It returns `200` whenever the process is serving, with a `database` field of `connected` or `unavailable`, so a database problem is visible without preventing the deployment from going live.
7. Diagnose with `GET /api/ready`. It returns `503` until the database is reachable and migrated, and the body names the specific problem, including the underlying connection error. Signed-in administrators also see a summary of what is configured.

Notes:

- The server binds to `PORT`, which Railway provides.
- Migrations run at startup rather than as a separate step, so the schema always matches the running code. If they fail, the server still starts and says why, rather than leaving an unreachable deployment.
- SSL is chosen from the connection string. Railway private networking (`*.railway.internal`) does not accept SSL and is connected without it; public hosts use SSL. An explicit `sslmode` in the URL always wins.
- `tsx` is a runtime dependency because the pre-deploy migration runs through it.
- No production URL is hardcoded anywhere. Everything derives from `APP_URL`.
- Local file storage is not durable on Railway. Connect object storage before students upload resumes in production.
- To load demo data into a fresh non-production environment, run `npm run db:seed` once from a Railway shell.

---

### The weekly digest schedules itself

There is nothing to configure. From Monday 13:00 UTC each week the app checks, on its own health check, whether that week has been sent, and sends it if not.

The usual objection to scheduling inside a web process is that a restart drops the timer and a second worker duplicates the work. Neither applies, because there is no timer. Every heartbeat asks the database whether the current ISO week has been claimed, and the claim is a single atomic insert, so any number of workers arriving at once still produce exactly one send. A restart loses nothing, because nothing was held in memory. The one real dependency is that the site sees some traffic during the week, which Railway's own health check already guarantees.

Two optional extras:

- `POST /api/cron/weekly-digest` triggers a run by hand. With `CRON_SECRET` unset it is open, which is safe only because the week is claimed before anything is sent: an anonymous caller can at most make that week's digest go out early, never twice. Resending a week that has already gone out always requires the secret, because that is the only way to make this send the same email to everybody twice.
- `.github/workflows/weekly-digest.yml` calls that endpoint every Monday if you set the `APP_URL` repository variable. Without it the workflow exits cleanly rather than going red every week.

---

## First sign in on a new database

A freshly migrated database has no institutions, and sign in requires an email domain that belongs to one. `ADMIN_EMAILS` breaks that circle.

1. Set `ADMIN_EMAILS` to your own address before the first deploy.
2. Go to `/signin` and enter that address. You are issued a code even though no institution matches it, and the account is created as an administrator. The promotion is written to the audit log.
3. Open `/admin/institutions`, add the university, and list its email domains.
4. Students and researchers with a matching address can now create accounts themselves at `/signin`.

Removing an address from `ADMIN_EMAILS` does not demote an existing account. Change the role from `/admin/users`.

---

## Architecture

```
src/
  app/
    (marketing)/        public site: landing, about, how it works, FAQ, legal, waitlist
    (auth)/             email code sign in
    (app)/              authenticated product
      onboarding/       role choice, 8-step student profile, researcher profile
      opportunities/    discovery, detail, save and apply entry points
      reviews/          open systematic, scoping, and general reviews
      directory/        two-way browse: students for researchers, researchers for students
      messages/         direct messages, gated by the rules in lib/queries/messages.ts
      people/           public member profiles, referrals, follow
      applications/     student drafts, submission, status, outcome reporting
      researcher/       dashboard, 9-step opportunity builder, review posting, applicant review
      admin/            approvals, users, listings, institutions, taxonomies, faculty import, pilot metrics
    api/                health, sign out, authorised file access, CSV export, weekly digest cron
  components/
    ui/                 buttons, fields, badges, cards
    marketing/          site chrome, hero, product compositions
    app/                shells, opportunity cards, criteria evidence, admin tables
  db/                   schema, client, migrate, seed, reset
  lib/
    ai/                 Anthropic client, schemas, application and interest analysis
    auth/               sessions, verification codes, permissions
    criteria/           types, deterministic engine, weighting
    email/              provider abstraction and templates
    faculty/            CSV reader and the faculty-list import
    matching/           see matching.ts: the weighted dimensions both sides are scored on
    notifications/      the weekly digest run, driven by an external scheduler
    queries/            read models for each surface
    storage/            file abstraction with per-purpose limits
    validation/         shared Zod schemas
```

The database driver is selected once in `src/db/index.ts`. Everything else imports a single `db`.

### Roles and permissions

`src/lib/auth/permissions.ts` is the only place authorisation is decided:

`requireUser`, `requireStudent`, `requireResearcher`, `requireApprovedResearcher`, `requireAdmin`, `canManageOpportunity`, `requireManagedOpportunity`, `canViewApplication`, `requireViewableApplication`.

Every server action and every page calls one of these. Hidden buttons are never treated as access control. A denial is logged and the person is sent to `/forbidden`, which explains the situation in plain language rather than surfacing an error page.

- Students cannot read other students' profiles, other students' applications, researcher notes, or admin pages.
- Researchers can only reach applications to positions they own.
- File downloads are checked per file: owner, the researcher who received the application, or an admin.
- Admin exports deliberately exclude written responses and private researcher notes.

### Authentication

Passwordless email codes. A six-digit code is generated with `crypto.randomInt`, stored as an HMAC keyed by `SESSION_SECRET`, expires in ten minutes, is single use, allows five wrong attempts, and is rate limited to five sends per address per hour. Comparison is constant time. Sessions are opaque random tokens stored as hashes, delivered in an HTTP-only, SameSite=Lax, Secure-in-production cookie.

Institution email domains live in the database. There is no `if (school === "Example University")` anywhere in the codebase.

### Claude integration

`lib/ai/` is the only place the Anthropic SDK is used.

- Structured output only. Claude answers through a forced tool call validated with Zod, never parsed from prose.
- Student text is wrapped in `<applicant_material>` and the system prompt states that it is untrusted evidence which cannot change instructions, criteria, schema, or role.
- Protected traits are explicitly forbidden, as are overall scores, rankings, and hiring recommendations.
- Criterion ids the model invents are dropped server side.
- Every run stores model, prompt version, schema version, input hash, result, and token counts in `ai_analyses` for audit and cost visibility.
- Results are cached by input hash. Claude is re-run on submission, on relevant changes, or when a researcher asks for a refresh.
- When the key is missing or the provider fails, applications still submit, deterministic criteria still evaluate, and the panel shows an understated unavailable state.

### Keeping Claude spend predictable

Every provider call passes through `lib/ai/anthropic.ts`, which is the only place the SDK is used. The controls below run in order, and each one is measured rather than assumed.

**Answer without calling.** A completed analysis is stored under a hash of the exact prompt inputs, so reopening an applicant costs nothing. The student alignment panel, which sits on a page anyone can reload, is cached the same way in `ai_response_cache` under a hash of the listing and the profile. Two concurrent requests for the same work collapse onto a single call rather than billing twice.

**Pay less for the calls that remain.** Each request is split into a stable half and a volatile half. The project description and its criteria are identical for every applicant, so they are sent first and marked as a prompt-cache breakpoint together with the system prompt and the tool schema; the applicant material follows unmarked. Reviewing a queue of applicants therefore re-reads that prefix at about a tenth of the input price. `usage.cache_read_input_tokens` is recorded on every call, and the admin panel shows the resulting hit rate, so the assumption is visible rather than hopeful.

**Ask for output that fits.** The tool schema states the same length and count caps that the parser enforces, so the model aims inside them, and the parser trims an over-long answer instead of rejecting it. A response that runs a few characters long has already been paid for; discarding it would waste a billed call and leave the reviewer with nothing.

**Bound what one request can cost.** Each block of student text is capped, and the whole request is capped again. A trimmed block says so in the text, so the model reports the gap instead of drawing conclusions from a sentence that stops mid-word.

**Bound how many requests can happen.** Fixed-window counters in `ai_rate_limits` limit calls per minute, per day, and per application per hour. They live in the database so every worker shares one allowance. A request that is already over the line is refused without consuming a slot, and a call that fails before reaching the provider gives its slot back.

**Bound total spend.** Token counts from each response are priced against the published list rates in `lib/ai/pricing.ts` and written to `ai_usage_events`. The budget check is one indexed pass over that table; the daily call ceiling bounds how many rows a month can hold, so a rollup table would only duplicate it. When the daily or monthly budget is reached, calls stop until the next period. Deterministic criteria keep working throughout, so the product degrades rather than breaking.

**Stop paying for a provider that is down.** Four consecutive failures open a circuit breaker for two minutes, after which one call is allowed through to test recovery. A transient failure is remembered for thirty minutes so it is not retried in a loop, while a rejected response schema is remembered as authoritative, because resending identical bytes would fail identically.

Calls that reached the provider are recorded with their outcome, so `/admin/system` shows spend against budget and the prompt cache hit rate. Calls refused before that point are logged as `ai_call_blocked` with the reason, rather than stored, so a hammering client cannot inflate the table it is being measured against.

Not implemented, and worth revisiting if volume grows: the Message Batches API halves the price of work that does not need an immediate answer, which describes analysis on submission. It needs a worker to poll batch results, so it was left out of the pilot.

---

## Important product rules

**Matching is a set of independent weighted dimensions, not one number.** `src/lib/matching.ts` scores research interest, duration, paid or volunteer, skills, and availability separately, and reports a percentage over only the dimensions that actually applied. A student who has not filled in their durations is not penalised for it; the weight simply leaves the denominator. Duration is a first-class dimension because a student wanting one term and a supervisor running a multi-year program are a bad match even in the same field, and overlap on any one selected value counts as a match.

**Messaging is gated on a mutual follow, deliberately.** A researcher can write to any student. A student can write to a researcher only once that researcher has followed them back, or once the researcher has actually engaged with one of their applications. Without that gate a professor's inbox becomes the cold-email pile this platform exists to replace, and the follow costs the researcher one click when they do want to hear from somebody. Once a conversation exists in either direction it stays open. Two students need a mutual follow. The rules live in one function, `canMessage`, and are tested in `tests/integration/messaging.test.ts`.

**Reviews are a separate posting type, not a research position with blanks.** A review posting is four fields: title, summary, whether there is authorship, and which parts need help. It publishes immediately with no draft steps and no moderation queue, because the entire value of the type is that it can go up in under two minutes.

**A pre-filled faculty profile belongs to the list until the person claims it.** An admin imports a faculty list at `/admin/faculty`; each row becomes a `researcher` account that is `pending` as a user but `verified` as a profile, because coming off the institution's own faculty list is a stronger check than the manual one done for a self-signup. Nobody is emailed. When the professor signs in they get one screen, not the wizard: everything is already filled in, and the only required answer is what they are actually looking for. Confirming sets `claimedAt`, which permanently takes the profile out of reach of any future re-import. Re-running the import as the list grows is therefore safe.

**Referrals replace public reviews.** There is no star rating and no public review of a person. A referral is one account vouching for another by name, optionally with a reference letter. The referrer's name is read live from their account rather than copied at referral time, so a title change does not leave a stale endorsement behind. Reference letters are readable by the person referred, by researchers, and by admins, never by other students.

**There is no universal student ranking.** No `student_quality_score` field, no leaderboard, no cross-project score. A student can be highly relevant to one project and not to the next, and that is the intended behaviour.

**AI output is evidence assistance.** Claude locates evidence relating to criteria the researcher wrote and points at the passage it came from. It does not decide anything.

**The researcher keeps decision authority.** Nothing accepts, declines, shortlists, or orders candidates automatically. Status changes are explicit researcher actions, validated against a state machine, and recorded in history.

**Paid roles receive stricter limits.** For `paid`, `work_study`, and `grant_funded` positions the system prompt forbids any suggestion of a hiring decision or candidate ordering, and the reviewer sees a visible notice that automated ordering is disabled.

**A missing preferred criterion costs only its own weight.** Importance maps to high 3, medium 2, low 1. Required conditions carry no preference weight and are reported separately. Preferred criteria are normalised against the ones that could actually be evaluated, so a single missing item cannot swing the result beyond its own share. Criteria with no information are excluded from the denominator rather than counted as failures, unless the researcher explicitly opted into the stricter behaviour.

**Grading scales are never assumed.** The 12 point, 4.0, 4.3, 9 point, and percentage scales are all first-class. Both the entered value and its scale are stored, the source value is never overwritten, and thresholds are only compared within the same scale. No language model is used to convert grades.

**Requirements are disclosed before applying.** Every criterion a researcher sets, and its importance, appears on the public listing.

**Prior research is never a platform-wide requirement.** Nor is video, which is off by default and enabled per position.

**Compensation is always visible** before a student begins an application.

**Records are archived, not destroyed.** Opportunities with applications are closed, unpublished, or archived rather than deleted, and status history is append-only.

---

## Accessibility and visual rules

Semantic HTML, keyboard reachable controls, visible focus outlines, labelled fields, live regions for status, and text labels alongside every colour-coded state. Motion respects `prefers-reduced-motion`. Dense researcher tables become readable cards on small screens rather than scrolling sideways.

---

## Known gaps

- Video responses are modelled end to end but implemented as an externally hosted link rather than in-browser recording. The question type, storage, and flags are already in place.
- Object storage has an interface and per-purpose limits but only the local provider is implemented.
- The SMTP email provider is a stub. `console` and `resend` work.
- Waitlist to account invitations are stored and exportable, but the invite email is triggered manually rather than from an admin button.
- The end to end suite in `scripts/run-e2e.sh` runs against `next dev` because the PGlite fallback cannot be shared across the production server's workers. Point `DATABASE_URL` at a real PostgreSQL instance to run it against `next start`.
- Faculty prefill keeps the platform's passwordless sign-in rather than adding a password, which the original note asked for. Adding password auth would mean a second credential store, a reset flow, and its own rate limiting, all to replace a six-digit code that already arrives at the same verified address. The claim flow is otherwise exactly as described: sign in, confirm, state your needs, done.
- The faculty importer reads a CSV. Scraping McMaster Experts and LinkedIn is not built; the expectation is that the list arrives as an export.
- The weekly digest rides on the health check rather than a real scheduler. That is correct here and needs no setup, but it does mean a deployment that receives no traffic at all for a week sends nothing that week. Point the optional GitHub workflow at it if that ever matters.
- The duration backfill in migration 0008 reads the old free-text duration field. Anything it cannot read confidently is left unset rather than guessed at, so some existing listings will ask their owner for a duration the next time they are edited.
- No formal third-party accessibility audit has been carried out, and no compliance certification is claimed.

---

## Contact

hello@myresearchbridge.com
