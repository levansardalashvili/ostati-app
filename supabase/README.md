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
| `0026_fix_recursive_rls_policies.sql` | removes same-table self-select subqueries from `users`/`provider_profiles`/`job_posts` UPDATE policies (column-level GRANT/REVOKE + RPC-only writes instead) |
| `0027_reviews_hardening.sql` | `BEFORE INSERT` trigger derives `reviews.customer_id`/`provider_id` server-side from the job; RLS re-checks job status too |
| `0028_messages_hardening.sql` | INSERT requires a real Customer/Provider relationship (role-asymmetric); UPDATE column-locked to `offer_status`, sender can't respond to their own offer |
| `0029_conversations_lockdown.sql` | removes client INSERT/UPDATE entirely; new `mark_conversation_read()` RPC |
| `0030_provider_stats_function.sql` | `provider_stats` VIEW → `get_provider_stats()` function (fixes the "Security Definer View" lint warning) |
| `0031_favorite_providers.sql` | `favorite_providers` (new table) |
| `0032_job_cancellation.sql` | `job_posts`: +`cancelled_at`/`cancelled_by`/`cancellation_reason`; RPC `cancel_job` |
| `0033_job_cancellation_notify.sql` | `cancel_job` (0032) gains a notification insert for the assigned Provider |
| `0034_job_reports.sql` | `job_reports` (new table); RPC `create_job_report` |
| `0035_provider_verification_request.sql` | `provider_profiles`: +`verification_requested_at`/`verification_rejection_reason`; RPC `request_provider_verification` (unverified/rejected → pending only) |
| `0036_provider_job_cancellation.sql` | `job_posts`: +`cancellation_actor`/`cancellation_reason_code`; RPC `provider_cancel_job` (active → cancelled only, fixed reason codes); `cancel_job` now also stamps `cancellation_actor='customer'` |
| `0037_push_tokens.sql` | `push_tokens` (new table, RPC-only writes); RPCs `register_push_token`/`deactivate_push_token` |
| `0038_notifications_push_types.sql` | `notifications`: +`type` (+ best-effort backfill); all 8 existing notification-writing functions now also set `type` |
| `0039_new_job_provider_notify.sql` | new `specialty_to_category()` helper + `handle_new_job_notify` trigger on `job_posts` (type=`new_jobs_in_area`, specialty+area+availability matched) |

See `supabase/functions/send-push-notifications/README.md` for the Edge Function that actually sends pushes (deploy + Database Webhook setup — both manual, cannot be done from a migration).

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

## Job Reports / no-show reporting (0034)

`job_reports` — brand-new table, no UI reads or writes it yet (report
submission and moderation UI are both explicitly out of scope for this
task; only the backend exists). Reasons are a fixed enum
(`provider_no_show`/`customer_no_show`/`work_not_completed`/
`inappropriate_behavior`/`incorrect_information`/`other`), status a
fixed enum (`open`/`reviewing`/`resolved`/`dismissed`, defaulting to
`open`).

Writes are RPC-only (`create_job_report(p_job_id, p_reason,
p_details)`) — direct client INSERT/UPDATE/DELETE is revoked at the
grant level entirely, matching `job_posts`' (0026) and `reviews`' (0027)
established pattern. The RPC validates the caller is the job's own
customer or its assigned Provider (job_responses-only "interested"
Providers don't count — you can't report a no-show for a job you were
never assigned to), requires the reason be one of the fixed values, and
derives `reported_user_id` server-side as "the other participant"
(nullable — a Customer reporting a still-unassigned `pending` job has no
specific Provider to attach it to). `reporter_id` is always
`auth.uid()`, never client-supplied.

RLS has exactly one policy: reporter can SELECT their own reports
(`reporter_id = auth.uid()`). No policy grants the reported user, or
anyone else, read access, and no UPDATE policy exists at all — moderation
status can only ever change via a future `service_role`-authenticated
tool (bypasses RLS by Postgres/Supabase design), which does not exist
yet ("do not build Admin Panel").

## Job cancellation (0032–0033)

`job_posts.status` already accepted `'cancelled'` (0011's check
constraint), and `CustomerJobDetailScreen` already had a full "გაუქმება"
menu item + confirmation sheet — but `confirmCancel()` only ever set a
local `useState` boolean; nothing was ever persisted, and since 0026
revoked all direct client UPDATE on `job_posts`, a direct
`.update({status:'cancelled'})` would fail outright even if attempted.
Additive columns `cancelled_at`/`cancelled_by`/`cancellation_reason`
(all nullable) plus a new `cancel_job(p_job_id, p_reason default null)`
RPC — same SECURITY DEFINER pattern as the other four job-workflow RPCs
(0014): validates the caller is the job's own customer (never the
assigned Provider — there is no Provider-initiated cancellation path in
the UI, and none was added), validates the job is currently `pending` or
`active` (rejects `completed`/already-`cancelled`/anything past `active`
in the two-sided completion flow), then atomically stamps all four
columns. `cancellation_reason` is optional/nullable — the existing
cancel-confirmation sheet has no text-input field for a reason today
(out of scope to add one here — "do not redesign UI"), so the client
currently always passes `null`; the RPC itself has no issue accepting a
real reason whenever a future screen collects one.
`jobService.cancelJob()` calls the RPC; `CustomerJobDetailScreen`'s
`confirmCancel` is now async (loading state on the button, `Alert` on
failure) and updates the shared `JobStatusContext` on success instead of
its own local boolean, matching every other status transition in that
screen.

**0033** adds the in-app notification for it, folded into the same RPC
(`CREATE OR REPLACE`, same pattern as 0022/0023) rather than any
client-side insert — `notifications`' client INSERT policy stays
removed (0018). Only fires when the cancelled job had an assigned
Provider (`v_job.provider_id is not null`, i.e. the job was `active`,
not merely `pending`) — a Provider who only expressed interest via
`job_responses` is not "the assigned Provider" and is not notified.
Recipient and job details are read from the already-validated,
already-updated row inside the function, never from a client parameter.
Provider-initiated cancellation does not exist anywhere in this app (no
RPC, no UI), so there is nothing yet for the symmetric "notify the
Customer" case to hook into.

## Favorite Providers (0031)

`favorite_providers` — Customer's saved/favorite Providers (❤️ on
`ViewProviderProfileScreen`, `SavedProvidersScreen`). Previously pure
local React state (`FavoriteProvidersContext`) — lost on every app
restart, never synced across devices. Now a real table: composite
primary key `(user_id, provider_id)` (doubles as the "no duplicate save"
constraint), owner-only RLS on SELECT/DELETE, and an INSERT policy that
requires the caller to actually be a Customer (checked against their own
`users` row, which their own RLS permits reading) and `provider_id` to
reference a real Provider (checked against `provider_profiles`, which is
publicly readable — checking a non-owned row against `users` instead
would have been silently blocked by `users`' own owner-only SELECT
policy and made every insert fail, which is why two different tables are
used for the two checks). Only `provider_id` is stored — no snapshot of
the Provider's data — `SavedProvidersScreen` already fetches full
Provider objects separately and filters by these ids client-side.
`src/services/favoriteProviderService.ts` is the new service;
`FavoriteProvidersContext` now loads/persists through it, keyed off
`authService.subscribeToAuthState` (covers cold-start restore, login,
and logout in one code path — favorites clear immediately on logout
rather than leaking into the next session).

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

## Security audit — recursive RLS, reviews/messages/conversations hardening, provider_stats (0026–0030)

- **`0026`** — three UPDATE policies (`users`, `provider_profiles`,
  `job_posts`) had a same-table correlated subquery in their WITH CHECK
  (e.g. `role = (select role from users where id = auth.uid())`) — the
  documented Postgres/Supabase "recursive RLS" footgun: the policy
  re-triggers RLS evaluation against the very table it's protecting.
  Fixed per-table with a different safe pattern each time: `users`/
  `provider_profiles` now use column-level `REVOKE`/`GRANT` (the
  protected column simply can't appear in a client UPDATE's SET list —
  checked before RLS even runs, no subquery); `job_posts` had **no**
  legitimate direct-client UPDATE path left at all once the 0014 RPCs
  existed (verified: no screen calls `.from('job_posts').update(...)`),
  so its UPDATE grant is revoked entirely and the RLS policy is now a
  flat `using (false)` — RPC-only writes.
- **`0027`** — `reviews` INSERT didn't check the job's status, and
  never validated `provider_id` against the job's actual assigned
  provider at all — a Customer could attribute a review to an arbitrary
  Provider. A `BEFORE INSERT` trigger now derives both `customer_id`
  (`auth.uid()`) and `provider_id` (from `job_posts.provider_id`)
  server-side, discarding whatever the client sent, plus re-validates
  ownership/status — RLS keeps a second, independent check.
- **`0028`** — `messages` INSERT accepted any `(customer_id,
  provider_id)` pair with zero relationship required; UPDATE let either
  participant rewrite the entire row. Fixed with a role-asymmetric
  relationship check on INSERT (Customer → any Provider stays
  unrestricted — it's a real, working "message from the public
  directory" feature; Provider → Customer now requires a real job
  relationship) and a column-locked (`offer_status` only), sender-excluded
  UPDATE policy on top.
- **`0029`** — `conversations` had open client INSERT/UPDATE (either
  participant could rewrite the other's unread counter or fabricate
  history). Both revoked entirely; the existing message trigger (0020)
  remains the only writer, and a new `mark_conversation_read(customer_id,
  provider_id)` RPC replaces the client's one legitimate write (resetting
  only the caller's own unread counter). `chatService.markConversationRead`
  updated to call it.
- **`0030`** — resolves `0010`'s "Security Definer View" lint warning:
  `provider_stats` (a raw, directly-queryable view bypassing RLS) is
  replaced by `get_provider_stats(p_provider_id uuid default null)`, a
  narrowly-scoped SECURITY DEFINER function returning the same 4
  aggregate columns. Supabase's linter only flags views, not functions —
  this is the same pattern already used for every other cross-user
  aggregate/transition in this project. `userService.ts` updated to call
  `.rpc('get_provider_stats', ...)` instead of `.from('provider_stats')`.

(`0009_notifications.sql`'s open INSERT policy — previously listed here
as a known gap — is resolved as of 0018; see the section above. As of
0030, there are no further known RLS/security gaps documented in this
migration set.)
