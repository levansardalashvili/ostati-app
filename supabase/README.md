# Supabase migrations

This directory is the version-controlled source of truth for the app's
Postgres schema, reconstructed from the live SQL history documented in
`CLAUDE.md` (decisions #51–#71) and cross-checked against every
`src/services/*.ts` file that actually queries Supabase.

## Applying

Run the files in `migrations/` **in filename order** (they're numbered
for exactly that reason) via the Supabase SQL Editor, or with the
Supabase CLI:

```bash
supabase db push
```

Most files are **idempotent** — safe to run again against a database
that already has this schema (uses `create table if not exists`,
`create index if not exists`, `alter table ... add column if not
exists`, `drop policy if exists` + recreate, existence-checks before
`alter publication ... add table`). **Exceptions:** `0011` and `0012`
each contain one genuine, one-time schema change (dropping the `title`
column; converting `offered_price` from text to numeric) — see their
own header comments and the "Job workflow hardening" section below
before applying them. None of the files drop tables.

## Tables

| File | Table / object |
| --- | --- |
| `0001_extensions_and_helpers.sql` | `pgcrypto` extension, shared `set_updated_at()` trigger function |
| `0002_users.sql` | `users` |
| `0003_provider_profiles.sql` | `provider_profiles` |
| `0004_job_posts.sql` | `job_posts` |
| `0005_job_responses.sql` | `job_responses` |
| `0006_messages.sql` | `messages` |
| `0007_conversations.sql` | `conversations` |
| `0008_reviews.sql` | `reviews` |
| `0009_notifications.sql` | `notifications` |
| `0010_provider_stats_view.sql` | `provider_stats` (view) |
| `0011_job_posts_workflow_columns.sql` | `job_posts`: +`agreed_price`, +`dispute_reason`, status check gains `confirmed_awaiting_rating`, drops `title` |
| `0012_job_responses_price_numeric.sql` | `job_responses.offered_price` text → numeric, `check (> 0)` |
| `0013_job_posts_lock_critical_columns.sql` | tightens `job_posts` UPDATE policies (status/provider_id/agreed_price/dispute_reason client-write-locked) |
| `0014_job_workflow_rpcs.sql` | RPCs: `select_provider`, `provider_request_completion`, `customer_confirm_completion`, `customer_report_problem` |
| `0015_review_completion_trigger.sql` | trigger: reviews insert → job_posts.status = 'completed' |
| `0016_provider_availability.sql` | `provider_profiles`: +`is_available boolean not null default true` |
| `0017_notification_preferences.sql` | `notification_preferences` (new table) |
| `0018_notifications_lock_down.sql` | drops `notifications`' open INSERT policy — no client INSERT at all now |
| `0019_job_category_label_helper.sql` | `job_category_label()` helper (category id → Georgian label, for server-generated notification text) |
| `0020_messages_notify_trigger.sql` | trigger: messages insert → atomic `conversations` upsert (real SQL increment) + notification |
| `0021_job_responses_notify_trigger.sql` | trigger: job_responses insert → notifies job owner |
| `0022_job_workflow_rpcs_notify.sql` | `select_provider`/`provider_request_completion`/`customer_report_problem` (0014) gain notification inserts |
| `0023_review_completion_notify.sql` | `handle_review_completion` (0015) gains a notification insert |
| `0024_storage_ownership_policies.sql` | `storage.objects` policies: uploads/updates/deletes restricted to the uploader's own uid path segment, for `job-photos` and `user-media` |
| `0025_provider_verification_status.sql` | `provider_profiles`: `verified boolean` → `verification_status text` (unverified/pending/verified/rejected), client-locked |

## Job workflow hardening (0011–0015)

These five files replace client-driven `UPDATE job_posts SET status =
...` calls with server-validated RPCs, matching the new status flow:

```
pending → active → awaiting_customer_confirmation → confirmed_awaiting_rating → completed
                              ↓
                          disputed
```

- A job can only reach `completed` as a side effect of a review being
  inserted (0015's trigger) — there is deliberately no RPC that sets
  `completed` directly, because rating is mandatory.
- `agreed_price` is only ever set by `select_provider()`, copied
  server-side from the selected response's `offered_price` — the client
  never sends a price for this column.
- 0013 locks `job_posts.status` / `provider_id` / `agreed_price` /
  `dispute_reason` against direct client `.update()` calls entirely;
  only the RPCs (which run as SECURITY DEFINER and bypass RLS) can
  change them.

## Session restore + availability + notification prefs (0016–0017)

- `0016` adds `provider_profiles.is_available` — read/written directly by
  the client (no RPC needed, it's not a critical multi-party transition),
  restored on `ProviderHomeScreen` mount via `userService.getProviderAvailability`.
  It does not filter the job feed or gate anything else yet — reserved for
  a future push-notification sender.
- `0017` adds `notification_preferences` (one row per user, `prefs jsonb`
  keyed by a stable toggle slug defined in `NotificationSettingsScreen.tsx`).
  A missing key means "user has never touched this toggle" and the client
  treats it as enabled — not "disabled". Nothing reads this table yet to
  decide whether to actually send a notification (out of scope, per the
  task); it exists so a future push sender can.
- Cold-start session restore (`RootNavigator.tsx` + `authService.waitForSession()`)
  needed no schema change — it only reads the already-existing `users`/
  `provider_profiles` tables before the navigator's first render.

## Atomic chat counters + server-side notification creation (0018–0023)

The client-side `notificationService.create()` method is gone, and with
it the open `notifications` INSERT policy (0009) that made it possible —
0018 removes that policy with no replacement, so a direct client
`.insert()` into `notifications` is now unconditionally denied. Every
notification in the app is created by one of five SECURITY DEFINER
triggers/RPCs instead, each re-deriving both the recipient and the
content from data that already passed that table's own RLS/ownership
checks, never from a client-supplied "notify this user with this text"
call:

- **New chat message** (0020) — an `AFTER INSERT ON messages` trigger
  does two things in the same transaction as the insert: atomically
  upserts `conversations` via `INSERT ... ON CONFLICT DO UPDATE SET
  customer_unread = conversations.customer_unread + 1` (a real SQL
  increment, not a JS read-then-write — this is the fix for the old
  race condition, see below), and inserts a notification whose body is
  derived from the actual inserted row (`NEW.type`/`NEW.text`/`NEW.amount`).
  `chatService.ts`'s `sendRealMessage`/`sendRealOffer`/`sendRealImage`
  are now plain `messages` inserts — no more separate `touchConversation`/
  `notifySender` calls, and no more `ChatParticipants` parameter (the
  trigger reads display names straight from `users`/`provider_profiles`).
- **Provider interest** (0021) — an `AFTER INSERT ON job_responses`
  trigger notifies the job's owner. `quoteService.expressInterest()` no
  longer takes/uses a `customerId` parameter.
- **Provider selected** / **completion requested** / **problem reported**
  (0022) — folded into the existing `select_provider` /
  `provider_request_completion` / `customer_report_problem` RPCs (0014)
  via `CREATE OR REPLACE`, same signatures, one extra `insert into
  notifications` each, after the state transition is committed.
- **Job completed** (0023) — folded into 0015's `handle_review_completion`
  trigger the same way; fires only once the review insert has actually
  flipped the job to `completed`.

**Why the old counter logic was unsafe:** `chatService.ts`'s old
`touchConversation()` did `select customer_unread, provider_unread ...`
then `update ... set customer_unread = <that value> + 1` as two separate
round trips. Two messages arriving close together (either side sending
near-simultaneously) could both read the same starting count and both
write `count + 1`, losing an increment. The new trigger does the
increment as part of one `INSERT ... ON CONFLICT DO UPDATE` statement,
which Postgres serializes correctly under the table's own unique-key row
lock — concurrent sends can no longer race.

## Storage ownership policies (0024) — REQUIRES a manual Dashboard step

`job-photos` and `user-media` (covering job photos, profile photos,
certificates, portfolio, review/completed-work photos, and chat images —
see `UserMediaKind` in `src/services/storageService.ts`) were created by
hand in the Dashboard (CLAUDE.md #61/#62) with only a blanket "any
authenticated user can INSERT" policy — no check that the path being
written actually belongs to the uploader. Both buckets already namespace
uploads under the uploader's own uid (`job-photos`: `{uid}/{file}`;
`user-media`: `{kind}/{uid}/{file}`), so 0024 adds INSERT/UPDATE/DELETE
policies on `storage.objects` that enforce it: `(storage.foldername(name))[1]`
(job-photos) / `[2]` (user-media) must equal `auth.uid()`.

**This alone does not close the hole** — Postgres RLS OR-combines every
permissive policy for the same command, so the *old* blanket policy, if
left in place, still grants access on its own. After running 0024, go to
Dashboard → Storage → Policies for both buckets and delete whatever
INSERT (and UPDATE, if any) policy predates the ones 0024 created (all of
0024's are named "Owner can ..."). 0024's own header comment repeats
this. Buckets stay **public** for reads — `getPublicUrl()`-based
rendering is untouched, since public-bucket reads bypass `storage.objects`
RLS entirely; only writes are now ownership-checked.

**Future privacy work, not done here (task said not to do a large
public-to-private rewrite unless necessary):** both buckets are still
publicly readable by anyone with the URL — fine for job photos/portfolio/
certificates (already semi-public, shown in a public directory /
job-feed), less fine for chat images and completed-work review photos,
which are only ever meant to be seen by the two chat participants /
whoever reads that job's public review. Making those specifically
private (a separate bucket or path prefix + `createSignedUrl()` instead
of `getPublicUrl()`, with a SELECT policy scoped to participants) is a
real follow-up, deliberately out of scope for this pass.

## Deliberately not included

- **`favorites`/`saved_providers`** — the app's "შენახული ოსტატები"
  feature (`src/state/FavoriteProvidersContext.tsx`) is still pure local
  React state; it has never been wired to Supabase, so there is nothing
  in the live database to reconstruct. Adding a table for it now would
  be inventing schema the app doesn't use yet.

## Provider verification status (0025)

`provider_profiles.verified boolean` (added in 0003 as a placeholder the
app never actually read — `userService.ts` always returned `verified:
false`) is replaced by `verification_status text` with a check
constraint on `'unverified' | 'pending' | 'verified' | 'rejected'`. Same
client-lock pattern as everything else in this set: the owner's INSERT/
UPDATE policies pin it to `'unverified'` on create and require it be
unchanged on every update — a Provider cannot move it to any other value
themselves, including 'pending'. There is deliberately no client-callable
way to request verification yet (no RPC, no UI) — this task was schema
preparation only, not the verification flow itself. The only way to
change this column today is the `service_role` key (bypasses RLS
entirely), which is where a future admin verification tool/Edge Function
would write from. `userService.ts` now reads the real column
(`verified: row.verification_status === 'verified'`) instead of the old
hardcoded `false`, so the public "verified" badge (already present in 5
screens) reflects genuine backend state — currently always `false` in
practice, since nothing sets it to `'verified'` yet, exactly as it should
be until a real verification flow exists.

## Env config (not a migration — client-side only)

`src/services/supabaseClient.ts` no longer hardcodes the project URL/anon
key; both come from `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`,
read from a gitignored `.env` in the repo root (copy `.env.example` and
fill in the real values from Supabase Dashboard → Project Settings →
API). This has no SQL counterpart — it doesn't change what the database
allows, only how the client obtains connection info. The app throws a
clear startup error if `.env` is missing, instead of silently connecting
to `undefined`.

## Known gaps, read before relying on this as "fully secure"

- **`0010_provider_stats_view.sql`** — the view runs without
  `security_invoker`, which Supabase's linter flags as "Security
  Definer View". It needs the elevated read today because its
  `completed_jobs` aggregate spans `job_posts` rows across every
  Customer. A proper fix is a narrowly-scoped SECURITY DEFINER function
  instead of a view — out of scope here.

(`0009_notifications.sql`'s open INSERT policy — previously listed here
as a known gap — is resolved as of 0018; see the section above.)
