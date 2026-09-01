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
| `0040_private_media_storage.sql` | new `private-media` bucket (non-public) + `can_access_private_chat_media()`/`can_access_private_job_media()` helpers + path-scoped `storage.objects` policies, for chat images and completion/rating photos |
| `0041_job_schedule.sql` | `job_posts`: +`preferred_date`/`time_slot` (additive, alongside the unchanged free-text `date`); new `job_scheduled_start()` helper (Asia/Tbilisi); `provider_request_completion` now rejects completion requests before the job's scheduled window starts |
| `0042_chat_offer_price_sync.sql` | `messages` INSERT policy: only a Provider may send `type='offer'`; UPDATE(offer_status) is now RPC-only (`respond_to_chat_offer`), which also syncs `job_responses.offered_price` on acceptance when exactly one open job matches |
| `0043_categories.sql` | new `categories` table (id/name/icon_key/sort_order/is_active/featured), public-read, no client write; seeded with the existing 15 category ids |
| `0044_function_permissions_hardening.sql` | Security Advisor hardening — revokes the implicit PUBLIC/anon EXECUTE every function had by default (client RPCs → authenticated-only; trigger/internal-helper functions → no direct EXECUTE for anyone); fixes `set_updated_at`'s missing search_path |
| `0045_role_enforcement.sql` | `job_posts`/`job_responses`/`provider_profiles` INSERT policies now check `users.role`; `select_provider`/`provider_request_completion`/`provider_cancel_job`/`cancel_job`/`customer_confirm_completion`/`customer_report_problem` all re-verify caller role server-side; `select_provider` also rejects self-selection and verifies `p_provider_id` is a real Provider |
| `0046_chat_role_and_relationship.sql` | `messages` INSERT: removed the "customer has any pending job" exception for Provider→Customer (now requires a real `job_responses`/assignment relationship) + role verification on both parties; `can_access_private_chat_media` mirrors the same rule |
| `0047_job_address_privacy.sql` | `job_posts`: +`area_label` (coarse, best-effort); new `job_posts_feed` view (`security_invoker=true`) masks `address` down to `area_label` for anyone who isn't the job's own customer/assigned provider |
| `0048_job_photo_privacy.sql` | new `can_access_private_job_photo()` + `storage.objects` policies for `private-media/job/...` — job customer, assigned provider, or any Provider while the job is pending |
| `0049_job_scoped_price_offers.sql` | `messages`: +`job_id` (NOT VALID check requiring it for new `type='offer'` rows); `respond_to_chat_offer` now requires and validates a real job_id instead of inferring one from the (customer_id, provider_id) pair |
| `0050_create_job_rpc.sql` | new `create_job`/`set_job_photos` RPCs — the only way to create a job post (direct client INSERT revoked); validates category exists/is_active, non-empty address, and time_slot-if-preferred_date |
| `0051_verification_privacy.sql` | new owner-only `provider_verification_requests` table; `verification_requested_at`/`verification_rejection_reason` moved off the publicly-readable `provider_profiles`; `request_provider_verification` writes to the new table |
| `0052_secure_provider_job_feed.sql` | Third hardening pass, priority 1 — drops the leaky `"Provider can read open jobs"` base-table policy on `job_posts` (a Provider could bypass `job_posts_feed` and read exact addresses directly); Provider open-job reads move to new SECURITY DEFINER RPCs `get_open_provider_feed()`/`get_feed_job_by_id()`; new `job_safe_area_label()` helper never falls back to the raw address; `job_posts_feed` view dropped (superseded) |
| `0053_job_publish_draft_flow.sql` | Third hardening pass, priorities 2/3/4 — `job_posts.status` gains `'draft'`; `create_job()` now creates a draft (invisible to Providers) instead of an immediately-published row, no longer accepts `p_customer_name` (server-derives it from `users`), and validates description length (20..500) + time_slot-without-preferred_date; new `finalize_job_publish()` RPC flips draft → pending |
| `0054_harden_set_job_photos.sql` | Third hardening pass, priority 5 — `set_job_photos()` now requires `role=customer`, draft-only status, max 3 references, and every reference must exactly match `private-media://job/{this job}/{auth.uid()}/...` (no arbitrary strings, no other job's/user's references, no legacy public URLs) |
| `0055_split_job_photo_storage_auth.sql` | Third hardening pass, priority 6 — new `can_upload_private_job_photo()` (Customer-own, draft-only) replaces `can_access_private_job_photo()` on the private job-photo storage **INSERT** policy specifically (SELECT stays broad); prevents any Provider from uploading into another Customer's job path |
| `0056_validate_offer_insert.sql` | Third hardening pass, priority 7 — `messages` INSERT policy rewritten to also validate `type='offer'` rows at insert time: job_id must reference a real, still-pending job owned by that exact customer_id, the sending provider_id must have a `job_responses` row for that job, and amount > 0 |
| `0057_messages_job_id_delete_policy.sql` | Third hardening pass, priority 8 — `messages.job_id` FK changed from `ON DELETE SET NULL` to `ON DELETE RESTRICT` (the old SET NULL could conflict with the offer-requires-job_id CHECK constraint on job deletion; job_posts rows are never hard-deleted by this product, so RESTRICT is a safe, contradiction-free invariant) |
| `0058_new_job_notify_on_publish.sql` | Fourth hardening pass, item 1 — fixes a regression from `0053`'s draft/publish split: the new-job notification trigger moves from `AFTER INSERT` (which no longer fires notifications at all, since jobs are created as `draft`) to `AFTER UPDATE OF status ... WHEN (OLD.status='draft' AND NEW.status='pending')`, firing exactly once at `finalize_job_publish()` time |
| `0059_finalize_publish_category_revalidation.sql` | Fourth hardening pass, item 2 — `finalize_job_publish()` now re-validates `categories.is_active` immediately before flipping draft → pending, closing the window where a category could be deactivated after `create_job()` but before publish |
| `0060_stale_draft_job_visibility.sql` | Fourth hardening pass, item 3 (documentation + one read-only helper) — documents the safe cleanup strategy for abandoned drafts and their `private-media/job/...` objects; adds `list_stale_draft_jobs()` (service_role-only, read-only) for a future admin/cron script — no deletion is implemented |
| `0061_set_job_photos_verify_object_exists.sql` | Fourth hardening pass, item 4 — `set_job_photos()` now also verifies each reference corresponds to a real row in `storage.objects` (bucket_id='private-media'), not just a correctly-shaped string; all of `0054`'s prefix/ownership/max-3/status checks are preserved unchanged |
| `0062_update_job_draft.sql` | Final pre-beta audit, item 1 (confirmed integrity bug) — new owner-only, draft-only `update_job_draft()` RPC, same validation as `create_job()`, so PostJobScreen's retry flow can sync current form values into an already-created draft instead of silently publishing stale field values from before an edit |
| `0063_finalize_publish_category_lock.sql` | Final pre-beta audit, item 2 (confirmed low-severity race) — `finalize_job_publish()`'s category re-check (`0059`) now takes a `for share` row lock on the matching `categories` row, closing (not just narrowing) the window against a concurrent category deactivation between check and write |
| `0064_express_interest_rpc.sql` | Confirmed integrity fix — new `express_interest(p_job_id, p_offered_price)` RPC replaces direct client INSERT on `job_responses`: `offered_price > 0` is now enforced server-side, and `provider_name`/`provider_initials`/`provider_color` are always derived from the caller's own `provider_profiles` row (never client-supplied) — closes a display-identity spoofing path that `select_provider()` later copies into `job_posts.provider_name`. Direct client INSERT on `job_responses` is revoked afterward |
| `0065_job_price_validation_rule.sql` | Focused backend hardening — new shared `is_valid_job_price()` rule (finite, positive, ≤1,000,000; structurally rejects NaN/Infinity via the upper bound, since Postgres `numeric` sorts NaN as greater than every non-NaN value); tightens the CHECK constraints on `job_responses.offered_price` and `job_posts.agreed_price` (both previously bare `> 0`, which does NOT reject NaN) and adds one to `messages.amount` (previously had none at the column level) |
| `0066_express_interest_lock_and_price_rule.sql` | Focused backend hardening — CONFIRMED race fix: `express_interest()` now locks the target `job_posts` row (`for update`) before validating `status='pending'`, closing a window where a Provider could insert a `job_responses` row (which also grants chat authorization and fires a notification) after the job had already gone `active` via a concurrent `select_provider()`; also wires `is_valid_job_price()` (0065) into `express_interest()`, `select_provider()`, `respond_to_chat_offer()`, and the chat-offer `messages` INSERT policy, replacing each function's own ad hoc price check |
| `0067_chat_relationship_lifecycle.sql` | Access-control fix — the Provider->Customer branch of the `messages` INSERT policy and `can_access_private_chat_media()` no longer treat ANY historical `job_responses` row as a permanent messaging relationship; a response now only grants access while that specific job is still `status='pending'` — current assignment (`job_posts.provider_id`) still grants access regardless of status, unchanged. No historical rows are deleted; only the authorization predicate changes |

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
