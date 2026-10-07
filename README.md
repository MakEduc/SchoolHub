# SchoolHub

A Next.js school commons with anonymous questions, structured peer-study sessions, classroom debate lobbies, and a local noise monitor.

## Local development

Requires Node.js 22 or newer.

```powershell
npm install
Copy-Item .env.example .env.local
# Fill the environment variables. This workspace already has .env.local configured.
npm run dev
```

Open http://localhost:3000. `.env.local` is ignored by Git. The publishable key is browser-safe; `SUPABASE_SECRET_KEY` is used exclusively in server modules and administrative scripts.

## Connect the database

The REST API keys can access tables, but cannot execute schema migrations. Open the Supabase project's SQL Editor and run these files in order:

1. `supabase/migrations/202610060001_schoolhub.sql` — tables, constraints, public projection views, RLS policies, server-only RPCs, school-directory seed data, and Realtime publication.
2. `supabase/migrations/202610060002_cleanup.sql` — Supabase Cron cleanup for expired debate sessions, temporary rate-limit buckets, and study sessions older than seven days.
3. `supabase/migrations/202610060003_library_details.sql` — Grade I–IV for IB/National and required typed meeting places. Existing DP/National sessions and management links are preserved. Legacy MYP sessions remain stored but are excluded from the new board; a host must choose a school grade and programme before updating one.
4. `supabase/migrations/202610070001_question_replies.sql` — student-selected public/private visibility, anonymous receipt links, written teacher answers, a public Q&A feed, and database protection against publishing private questions. Existing questions default to private, so any previously pinned private question will disappear from public boards. Existing questions have no recoverable student receipt.

The core migration is transactional and intended to run once on an empty project. If Cron is unavailable, enable it in Supabase Integrations and run the second migration afterward. Expired studies/lobbies are excluded from active queries immediately, independently of cleanup timing.

Check the connection after applying the migration:

```powershell
npm run db:check
```

An uninitialized project returns a clear setup error. The app does not replace failed database writes with pretend success or local sample data.

## First teacher / administrator

In Supabase Authentication → URL Configuration, set the Site URL and redirect allowlist for your local and production domains. During development allow `http://localhost:3000/**`.

For reliable invitation links, set the Invite User email template to include:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Open SchoolHub</a>
```

The sign-in page supports Supabase magic links and email OTP codes. With the default magic-link template, the browser that requested the link must open it because Supabase SSR uses PKCE. To support opening links on another device, use this Magic Link template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in to SchoolHub</a>
<p>Or enter this code: {{ .Token }}</p>
```

Create the first school administrator:

```powershell
npm run teacher:invite -- "your-email@school.edu" "Your display name" admin
```

This sends an invitation and creates an authorized teacher profile. After sign-in, use School settings to invite additional teachers and assign department/general inbox access. Teacher emails are stored in Supabase Auth; student questions have no author, account, or email fields.

Enable email sign-in and allow new users in Supabase Auth for student verification. Signing up does not grant teacher permissions: staff still require a separately invited teacher profile. Unknown or unverified school domains cannot access SchoolHub content. Server-side admin invitations still work. Configure your school's SMTP provider in Supabase before inviting a large staff group; the built-in email provider is intended for limited development use.

This release uses invite-only email authentication. Native biometric/WebAuthn passkeys are not implemented.

## Feature behavior

- **Anonymous Q&A:** 280-character questions tagged to a teacher, department, or school life. Students choose public or private (the default). Teachers see only authorized inboxes and can write/edit answers, archive/restore, approve flagged text, and pin public questions to boards they own. Private questions cannot be published, including through the database RPC. Public approved questions/replies appear below the question form. Students receive a random private receipt link to read replies after verifying their school email; only a hash of its token is stored. The token stays in the URL fragment and is sent in a POST body, never a query string. Lost receipts cannot be recovered. English profanity screening flags questions for review.
- **Library Table:** Grade I–IV, IB/National programmes, subject/focus, typed meeting place, school-timezone date/time, optional first name/contact, and host-managed open spots. A private link with a token in its URL fragment allows editing/cancellation. Store that link: it cannot be recovered without identifying the host. Public views omit management-token hashes. Open spots do not represent reservations.
- **Debates:** teachers create 2–4 stances and a 1–60 minute preparation window. QR codes join an expiring lobby. Opaque HttpOnly cookies restore each participant's browser identity. Teacher rosters receive Supabase Realtime changes with a three-second polling fallback; student phones poll their own state every two seconds. The assignment RPC locks the session, verifies the roster, enforces balanced groups, and closes joining atomically. Reopening clears all assignments. Lobbies support up to 100 students and expire after 24 hours.
- **Noise monitor:** microphone amplitude is processed locally, smoothed, and shown on a green/yellow/red relative gauge. Sensitivity and three-second quiet-room calibration are available. Audio is never connected to playback, uploaded, or recorded. Microphone tracks are released on stop/navigation. HTTPS or localhost is required; this is not a calibrated decibel measurement.
- **Language and guidance:** English/Bosnian switcher with a saved browser preference; interface labels are translated, while user-written questions, replies, board titles, and debate content retain their original language. Each tool has a guide shown once per browser (with a Guide button to reopen it). Clearing browser storage resets this behavior. `/terms` and `/privacy` explain the school-use rules and implemented data handling in both languages. The school operator should confirm its contact and retention practices match these pages before a school-wide launch.

Default school timezone: `Europe/Warsaw`. Change `NEXT_PUBLIC_SCHOOL_TIMEZONE` to an IANA timezone before deployment. Programme/grade options are defined in `src/lib/domain.ts` and the database's `programme_grades` table; update both if your school uses different labels.

## Architecture and privacy

Server-rendered routes and interactive React components use the Next.js App Router. All mutations enter validated Next.js endpoints. Teacher authorization is checked with Supabase Auth and an active teacher profile; table reads are also protected by RLS. Public directory, study-board, and published-question views expose explicit column lists. Only server-side service credentials can call mutation RPCs.

Anonymous submissions use temporary browser cookies and hashed, expiring rate-limit buckets. These are not stored on or linked to question rows. On Vercel, a broader shared-network limit uses the trusted `x-vercel-forwarded-for` header. Other hosts currently share a development network bucket; adapt this to that host's trusted proxy header before production use. Question bodies and student contacts are not written to application logs. Infrastructure may still log ordinary request metadata, so anonymity means no student identity is attached to a submitted question, not zero infrastructure logs.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

The test suite covers form/domain constraints, timezone/DST conversion, balanced shuffling, and the actual core SQL migration in embedded Postgres (PGlite). Database tests verify anonymous/teacher RLS, public-board moderation boundaries, hidden host secrets, expiration, atomic rate limits, and debate state transitions. PGlite substitutes Supabase's Auth helpers and omits the provider's Realtime publication transport; it does not validate a remote Supabase deployment or email delivery.

Run `npm run verify:client-secrets` after a production build to verify the configured privileged key does not appear in client bundles.

With a server running, `npm run smoke -- http://localhost:3100` checks public pages, teacher/admin redirects, unauthorized API access, input rejection, and cross-site submission rejection. It creates no database records. Replace the URL with your running server's address.

## Deploy

Import this repository into Vercel, set the variables from `.env.example`, and deploy. Set `NEXT_PUBLIC_SITE_URL` to the production HTTPS URL. Apply migrations to the production Supabase project and configure the production auth URLs/email templates. Use a separate Supabase project for preview deployments.

Before a school pilot, test sign-in/invitations with the actual email provider, question visibility with two teachers from different departments, QR joining from real phones, and microphone behavior on the classroom projector browser.

## Class boards

Students open **Class boards** (`/boards`) in the main navigation or use a teacher’s `/board/<slug>` link. Students must verify their school email through Supabase Auth. Teachers create boards in their workspace, select a board in their inbox, and pin approved questions to publish them. **Edit board** opens `/teacher/boards/<id>` to rename the board, remove pinned questions, and copy the student link. Renaming preserves existing shared links. Removing a question only removes that board’s publication; the original question stays in the teacher inbox. Teachers can write answers directly in their inbox and mark questions answered.
# School email verification with Supabase Auth

Apply `202610070001_question_replies.sql`, then `202610070002_school_isolation.sql` before deploying. Existing content is assigned to Druga gimnazija; map any other legacy schools explicitly first. No new migration is required when switching from the earlier SMTP implementation to Supabase Auth.

Both students and teachers now use Supabase Auth email delivery. No application-level SMTP_HOST/SMTP_USER/SMTP_PASSWORD/SMTP_FROM variables are needed. In Supabase Authentication, enable email sign-in and allow new users for students. Teacher roles are never granted by signup or user metadata: they require a separately invited active teacher profile. Only registered exact school domains are accepted by SchoolHub. For another school, add a schools row and school_domains entry, populate its directories (including an Other location), then invite its administrator using npm run teacher:invite.

Configure the Site URL and redirect allowlist for both localhost and your Vercel deployment. Email redirect callbacks route verified students to their school space and invited staff to the teacher workspace. To display codes in emails, include `{{ .Token }}` in both the Confirm signup and Magic Link templates (for example `<p>Your SchoolHub code is {{ .Token }}</p>`). The form accepts 6–8 digits; links also work. Code expiry and provider limits are controlled by Supabase, rather than the legacy custom-code table.

Supabase's default email service only sends to project team members and has a low development rate limit. To send to real students, configure custom SMTP in Supabase Authentication: https://supabase.com/docs/guides/auth/auth-smtp. This replaces app-level SMTP configuration; it does not remove the provider's delivery requirements. Verify delivery with an authorized school mailbox after configuration. Do not enable request-body logging.

Supabase Auth stores student and teacher email addresses, auth identifiers and sign-in metadata. Authentication cookies contain session credentials and may contain email/account data. Questions contain no student email or account ID, and no identity is attached when submitting. Other school records can contain voluntarily supplied host/contact or participant names. All content APIs, private receipt and management links, and debate codes require the same verified school. Students cannot use direct Supabase REST to bypass these routes, and do not receive staff privileges. Existing anonymous school cookies remain valid only until their original seven-day expiry; new sessions use Supabase's configured session policy. Contact school administrators for Auth account deletion or retention requests.
