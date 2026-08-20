# ResearchBridge

ResearchBridge connects students with open research opportunities at their university and gives researchers a structured way to find candidates for a specific project.

Students build one profile, browse positions that are actively recruiting, and apply to the projects that interest them. Researchers post a real opening, state the criteria that matter for that project, and review applications organised around those criteria.

The first pilot runs at **McMaster University in September 2026**, starting with Health Sciences and Life Sciences.

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
| Researcher (verified) | `okonjoa@mcmaster.ca` |
| Researcher (awaiting approval) | `p.vasquez@mcmaster.ca` |
| Student with applications | `adeyemij@mcmaster.ca` |
| First-year student, no experience | `obrienk@mcmaster.ca` |

---

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Production | PostgreSQL connection string. Empty in development falls back to PGlite. |
| `APP_URL` | Yes | Public base URL. Used for metadata, sitemap, and links in email. |
| `SESSION_SECRET` | Yes | At least 16 characters. Signs session tokens and verification code hashes. Rotating it invalidates all sessions and codes. |
| `ANTHROPIC_API_KEY` | No | Enables Claude evidence analysis. Server only, never prefixed with `NEXT_PUBLIC_`. |
| `ANTHROPIC_MODEL` | No | Defaults to `claude-sonnet-5`. Changing the model does not require a code change. |
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
```

`db:seed` truncates every table. Never run it against production.

Integrity is enforced in the database as well as in application code: unique user email, unique institution slug, one application per student per opportunity, foreign keys with deliberate cascade behaviour, and check constraints for non-negative hours, ordered hour ranges, and valid academic values.

---

## Testing

```bash
npm run test         # 112 tests
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
2. Add the **PostgreSQL** plugin. Railway sets `DATABASE_URL` automatically.
3. Set the remaining variables in the service:
   - `APP_URL` (your Railway domain, no trailing slash)
   - `SESSION_SECRET` (generate with `openssl rand -base64 32`)
   - `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` when you want the evidence layer on
   - `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` for real email
   - `FILE_STORAGE_PROVIDER=s3` plus bucket settings before relying on uploads
4. Deploy. `railway.json` runs `npm run db:migrate` as the pre-deploy command, then `npm run start`.
5. Health check: `GET /api/health` returns `{"status":"ok"}` and nothing about the infrastructure.

Notes:

- The server binds to `PORT`, which Railway provides.
- No production URL is hardcoded anywhere. Everything derives from `APP_URL`.
- Local file storage is not durable on Railway. Connect object storage before students upload resumes in production.
- To load demo data into a fresh non-production environment, run `npm run db:seed` once from a Railway shell.

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
      applications/     student drafts, submission, status, outcome reporting
      researcher/       dashboard, 9-step opportunity builder, applicant review
      admin/            approvals, users, listings, institutions, taxonomies, pilot metrics
    api/                health, sign out, authorised file access, CSV export
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

Institution email domains live in the database. There is no `if (school === "McMaster")` anywhere in the codebase.

### Claude integration

`lib/ai/` is the only place the Anthropic SDK is used.

- Structured output only. Claude answers through a forced tool call validated with Zod, never parsed from prose.
- Student text is wrapped in `<applicant_material>` and the system prompt states that it is untrusted evidence which cannot change instructions, criteria, schema, or role.
- Protected traits are explicitly forbidden, as are overall scores, rankings, and hiring recommendations.
- Criterion ids the model invents are dropped server side.
- Every run stores model, prompt version, schema version, input hash, result, and token counts in `ai_analyses` for audit and cost visibility.
- Results are cached by input hash. Claude is re-run on submission, on relevant changes, or when a researcher asks for a refresh.
- When the key is missing or the provider fails, applications still submit, deterministic criteria still evaluate, and the panel shows an understated unavailable state.

---

## Important product rules

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
- No formal third-party accessibility audit has been carried out, and no compliance certification is claimed.

---

## Contact

hello@myresearchbridge.com
