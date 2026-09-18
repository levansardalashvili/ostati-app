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
| `0068_job_posts_provider_name_column.sql` | Bug fix — `job_posts.provider_name` had been folded into 0004's `create table if not exists`, which is a no-op on any database where `job_posts` already existed before that edit; the column was silently never added there, breaking `get_open_provider_feed()`/`get_feed_job_by_id()` (0052) with "column jp.provider_name does not exist". Adds it via a standalone `alter table ... add column if not exists` — safe to run regardless of whether the column is already present |
| `0069_provider_profiles_update_grant_fix.sql` | Bug fix (found via Maestro E2E testing) — every brand-new Provider registration failed at ProviderSetupScreen ("permission denied for table provider_profiles", hint pointed at a missing `GRANT UPDATE`). 0026 already contains the correct column-scoped grant, but a direct REST test against the live project showed it never actually took effect there (same live-database-vs-migration-file drift as 0068). Re-asserts the same grant from 0026 — idempotent, changes nothing else |
| `0070_admin_role.sql` | Foundation for the admin panel (separate Next.js project, `ostati-admin` — its own folder/repo, not part of this one). Adds `'admin'` as a legal `users.role` value (provisioned manually, no self-service path) and opens `categories` INSERT/UPDATE/DELETE to admin accounts only — RLS-gated via a `users.role='admin'` subquery (safe: queries a different table than the one being protected, not the same self-referencing pattern 0026 moved away from). Provider verification approval and job_reports moderation are deferred to a later milestone |
| `0071_site_content.sql` | Backend for the new public marketing site (`ostati-site`, another separate project — describes the app, how it works, privacy policy, store links) and its editor, folded into the existing `ostati-admin` panel rather than a third separate CMS/login. New `site_pages` (slug/title/markdown `content`) and `site_settings` (key/value — store URLs, contact email) — both admin-write (same pattern as 0070) but **public-read to `anon`**, not just `authenticated`, since marketing-site visitors are never signed in to Supabase at all |
| `0072_admin_verification_and_reports.sql` | Third admin-panel milestone — Provider verification approval and job_reports moderation (both previously "future service_role tool", 0025/0034/0051). New `is_admin()` SECURITY DEFINER helper — needed because the new admin-read policy on `users` itself would otherwise be a self-referencing RLS subquery (the exact recursion footgun 0026 moved away from); 0070/0071's inline `role='admin'` subqueries are also swapped to call it, no behavior change. `admin_review_provider_verification(provider_id, approve, rejection_reason)` RPC is the only way pending -> verified/rejected (RPC, not a grant, since provider_profiles already has a permissive self-serve UPDATE policy a broad grant could collide with). `job_reports` gets a direct admin-only UPDATE(status) grant+policy instead (no existing user-facing UPDATE policy to collide with) |
| `0073_categories_public_read.sql` | Opens `categories`' existing SELECT policy to `anon` (was `to authenticated` only, 0043) — the new public marketing site's `/services` page has no Supabase session at all, same situation site_pages/site_settings were in before 0071 |
| `0074_site_blocks.sql` | Converts the last hardcoded marketing-site content into admin-editable data. New `site_blocks` table (block_key/sort_order/icon_key/title/description) for the two ORDERED-LIST sections that don't fit `site_pages`' single-title+body shape — home page's 4 feature cards (`block_key='home_features'`) and the 3 how-it-works steps (`block_key='how_it_works_steps'`, shared between the home preview and the full page). Same public-read/admin-write pattern as 0071/0073. Also seeds a new ordinary `site_pages` row (`slug='home_cta'`) for the home page's "დაიწყე დღესვე" CTA heading+subtext — that one IS just title+body, no new table needed for it |
| `0075_chat_offer_auto_select.sql` | Accepting a chat price offer now auto-selects the Provider (assigns `job_posts.provider_id`/`agreed_price`/`status` directly) instead of requiring a separate `select_provider()` trip from Job Detail; new internal helper `assign_job_provider()` factors the shared state-transition+notification logic out of both `select_provider()` and `respond_to_chat_offer()` |
| `0076_fix_job_area_label_masking.sql` | Privacy bug fix — `job_safe_area_label()` (0052) was leaving the street name in the "coarse" label shown to non-assigned Providers (only the house-number segment was stripped); now only trusts the LAST comma segment as the area name (with a ≥3-segment guard, and a second pass for untrimmed Nominatim strings that also carry postcode/country) |
| `0077_cold_dm_provider_reply_fix.sql` | `StartJobChatSheet`'s cold-DM flow (Customer messages a Provider directly, no prior `job_responses`) left the Provider unable to reply or send a price offer — `messages` INSERT policy and `respond_to_chat_offer()` now also treat "Customer already messaged this Provider directly" as a valid relationship, on par with `job_responses`/assignment; `respond_to_chat_offer()` creates the missing `job_responses` row itself on acceptance |
| `0078_admin_dispute_resolution.sql` | New `admin_resolve_job_dispute(job_id, resolution)` RPC — the first (and only) way out of `job_posts.status='disputed'`, which every prior migration could write but none could leave; `'reopen'` → `awaiting_customer_confirmation` (sides with the Provider), `'cancel'` → `cancelled` with `cancellation_actor='admin'` (sides with the Customer); both notify both parties |
| `0079_stale_confirmation_expiry.sql` | New lazy/opportunistic RPC `expire_stale_job_confirmation(job_id)` — any participant can call it; only acts once `job_posts.updated_at` is ≥72h old while `status='awaiting_customer_confirmation'`, moving the job to `confirmed_awaiting_rating` (never straight to `completed` — rating stays mandatory, #18/#47) |
| `0080_admin_job_posts_read.sql` | New `is_admin()`-gated SELECT policy on `job_posts` — it never had one, so the admin disputes UI (`0078`) silently saw nothing despite real disputed rows existing; write access is still RPC-only, unchanged |
| `0081_job_taking_improvements.sql` | Extends the shared `assign_job_provider()` helper (0075) to also notify every *other* `job_responses` provider on assignment ("job went to someone else"); new `withdraw_interest(job_id)` RPC (row-locked, `pending`-only) lets a Provider retract their expressed interest |
| `0082_offer_supersede_and_stale_interest.sql` | New `AFTER INSERT` trigger `supersede_prior_offers()` — a Provider's new chat price offer on a job now marks their own older `pending` offer on that same job as `'superseded'` (new `messages.offer_status` value) instead of leaving it stuck accept/decline-able forever; new lazy RPC `check_stale_job_interest(job_id)` sends the job's Customer at most one reminder (`job_posts.stale_interest_reminder_sent_at`) once a job has sat `pending` with zero responses for ≥48h |
| `0083_users_phone_column.sql` | `users`: +`phone text not null default ''` — backing column for phone/SMS-OTP registration and login (additive alongside the existing Email/Password + Google flow, see CLAUDE.md decision #107); no RLS change needed, the existing owner-only row policies already cover the whole row |
| `0084_provider_verification_gate.sql` | Product decision — an unverified Provider can no longer express interest in a job. `express_interest()` now requires the caller's own `provider_profiles.verification_status = 'verified'` (raises `PROVIDER_NOT_VERIFIED` otherwise); the `messages` INSERT policy's `type='offer'` branch gets the same check, closing the cold-DM chat-offer bypass (0077) that could otherwise let an unverified Provider originate a price without ever calling `express_interest()` |

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

(Note: this file's per-migration writeups stop being kept current after
0030 — migrations 0031–0074 exist and are applied, but were not indexed
here. `0075` below picks the narrative back up for this one change; it
does not attempt to backfill the missing 0031–0074 writeups.)

## Chat offer acceptance auto-selects the Provider (0075)

- **`0075`** — accepting a price offer in chat (`respond_to_chat_offer()`,
  0049/0066) previously only synced `job_responses.offered_price` — the
  Customer still had to separately open the job's detail screen and pick
  the same Provider again via `select_provider()` to actually assign
  them. New shared helper `assign_job_provider(job_id, provider_id,
  provider_name, agreed_price, category)` (SECURITY DEFINER, no client
  EXECUTE grant — same "internal helper" pattern as
  `job_category_label()`/`specialty_to_category()`/`job_scheduled_start()`)
  factors out the actual state transition (`job_posts.provider_id`/
  `agreed_price`/`status='active'` + the "შენ აგირჩიეს" notification) so
  both `select_provider()` and `respond_to_chat_offer()` call the same
  code instead of duplicating it. On acceptance, `respond_to_chat_offer()`
  now calls this helper right after its existing (unchanged)
  `job_responses.offered_price` sync — all the preconditions it needs
  (job still `pending`, a real `job_responses` row, a valid price) were
  already being checked there. `select_provider()`'s own authorization/
  validation is untouched, only its final update+insert block now
  delegates to the helper. Client-side: `ChatConversationScreen.tsx`
  syncs the local `JobStatusContext` cache to `'active'` on a successful
  accept (so screens reading the cache reflect this immediately without
  waiting on a refetch), and a new "სამუშაოს დეტალების ნახვა" banner link
  (visible whenever the chat has a `jobId`) opens the job's detail screen
  directly from the chat — `CustomerJobDetailScreen`/`CustomerJobsScreen`
  now also pass `jobId` when opening a job-scoped chat (previously only
  the three Provider-side job-context screens did).

## `job_safe_area_label()` under-masking fix (0076)

- **`0076`** — real privacy bug, not just a cosmetic one: the coarse
  address label shown to a Provider before they're assigned/have
  confirmed a price (`get_open_provider_feed()`/`get_feed_job_by_id()`,
  0052) only stripped the FIRST comma-delimited segment of the address
  (the house number). For the app's own short address format
  (`AddressAutocompleteField`: "house number, street, area", e.g.
  "12, შორაპნის ქუჩა, ვაკე"), that left the STREET NAME itself in the
  "coarse" label — not coarse at all. Live data also revealed a second,
  longer address shape (full untrimmed Nominatim output through
  postcode+country) whose LAST segment is the country, not an area either
  — so a first attempt at "just take the last segment" was itself wrong
  and was corrected before shipping. Final rule, in `job_safe_area_label()`:
  (1) any segment literally containing "რაიონი" (district) is trusted
  verbatim wherever it sits; (2) otherwise, trailing postcode (all-digit)
  and "საქართველო" segments are dropped, then the new last segment is
  trusted only with >= 3 segments still remaining — never fewer, which
  could still be the street. Every existing `job_posts.area_label` is
  recomputed with the fixed function. No client-side change — every
  Provider-facing surface (Job Feed cards, Job Detail, the in-chat job-
  summary card) already reads this same server-computed value.

## Cold-DM Provider reply fix (0077)

- **`0077`** — the new `StartJobChatSheet` cold-DM flow (Customer messages
  a Provider directly from their public profile, no prior job interest)
  creates a real job and lets the Customer send the first message, but the
  Provider could never reply — `messages`' INSERT policy (0067) only
  allowed Provider -> Customer when a `job_responses` row already existed
  (still pending) or the Provider was already assigned; neither is ever
  true for a job the Customer just created and messaged this ONE Provider
  about directly. The same gap blocked the Provider's first price offer
  entirely (`respond_to_chat_offer()`, 0049/0066, required a pre-existing
  `job_responses` row — circular for a first offer). Fix: a third
  condition — "the Customer has already sent this Provider at least one
  message directly" — is exactly as strong a proof of a real relationship
  as `job_responses`/assignment, added to both the `messages` policy and
  `can_access_private_chat_media()`. The offer-specific `job_responses`
  pre-existence check is dropped (redundant once the outer relationship
  check covers it); `respond_to_chat_offer()` now creates the missing
  `job_responses` row itself on acceptance, from the offer message's own
  already-validated amount, deriving `provider_name` server-side.

## Admin dispute resolution (0078)

- **`0078`** — closes a real dead-end: every RPC that touches `disputed`
  (`customer_report_problem`, 0014/0022/0038/0045) only ever writes INTO
  it — nothing transitioned a job OUT of `disputed`, so once a Customer
  disputed a Provider's completion request, that job was stuck forever
  (couldn't reach `completed` — no review can attach without a prompt —
  and `cancel_job`/`provider_cancel_job`, 0032/0036, both explicitly
  reject `disputed` as a source status by design). New admin-only RPC
  `admin_resolve_job_dispute(job_id, resolution)` — same pattern as
  0072's `admin_review_provider_verification()` (`is_admin()` gate,
  `for update` lock, fixed-enum outcome, not a free-form status). Two
  resolutions: `'reopen'` (admin sides with the Provider — back to
  `awaiting_customer_confirmation`, `dispute_reason` cleared, Customer
  gets another confirm/dispute cycle) or `'cancel'` (admin sides with the
  Customer — `cancelled`, stamping the same columns `cancel_job()` does:
  `cancelled_at`/`cancelled_by=auth.uid()`/`cancellation_actor='admin'`
  — a value 0036 already reserved in its check constraint but no RPC had
  ever actually used — `/cancellation_reason` carried forward from the
  original `dispute_reason`). Both outcomes notify both participants
  (`type='job_status_change'`, same pattern as every other job-workflow
  RPC). No UI wiring in `ostati-app` — this is called from the separate
  `ostati-admin` panel, matching 0072's other admin actions.

## Stale-confirmation auto-expiry (0079)

- **`0079`** — the second gap found alongside 0078: `awaiting_customer_confirmation`
  has no timeout either. `provider_request_completion()` notifies the
  Customer exactly once (`completion_reminder`) and nothing ever prompts
  again — a Customer who never opens the app leaves the job stuck forever,
  with no recourse for the Provider. Unlike 0078 (needs a human admin
  decision), this has an unambiguous default: silence past a grace period
  is implicit acceptance — standard in marketplaces with no payment/escrow
  to hold (this app has neither). No cron/scheduled-function infrastructure
  exists in this project (the push pipeline, 0037-0039, is event-driven via
  a Database Webhook, not time-based) — rather than add pg_cron as new
  infrastructure for one narrow check, new RPC `expire_stale_job_confirmation(job_id)`
  is lazy/opportunistic: callable by either participant, but only actually
  transitions the job once >=72h have elapsed since `job_posts.updated_at`
  (already auto-stamped by the shared `set_updated_at` trigger on every
  UPDATE — no new timestamp column needed, since nothing else touches a
  job_posts row while it sits in `awaiting_customer_confirmation`).
  Returns `false` (not an error) if called too early or on any other
  status — only raises for auth/not-found/non-participant. Deliberately
  preserves "review is always mandatory" (#18/#47): transitions to
  `confirmed_awaiting_rating` (the exact state `customer_confirm_completion()`
  reaches explicitly), never straight to `completed`. Notifies both
  participants either way. Client wiring: `ProviderJobDetailScreen`/
  `CustomerJobDetailScreen` call this fire-and-forget whenever either
  loads a job in that status — the job self-heals the next time either
  party happens to look, no background infrastructure required. Verified
  live against real data: too-early call returns `false` with no state
  change; after backdating `updated_at` past 72h (trigger temporarily
  disabled to simulate elapsed time, a test-only maneuver — the trigger
  fires normally on every real update), the RPC correctly transitions the
  job and notifies both sides; a second call after transition is a no-op
  (`false`, no duplicate notification); a non-participant caller is
  rejected.
  - **Adjacent pre-existing bug, also fixed while here:** `ProviderJobDetailScreen`
    had no `variant` case for `confirmed_awaiting_rating` at all (reachable
    even before 0079, via the Customer's ordinary explicit "დადასტურება"
    tap) — it fell through to `'active'`, re-showing "სამუშაო დავასრულე"
    even though the job was no longer `active` (the RPC would then reject
    the tap). Now maps to the existing `'completed'` variant/banner, whose
    title is accurate either way and whose star-rating block already
    renders conditionally on a review existing.

## Admin `job_posts` read access (0080)

- **`0080`** — caught live, minutes after building the `ostati-admin`
  "დავები" page on top of 0078: the page queries `job_posts where
  status='disputed'` as the logged-in admin, through the anon-key +
  cookie session (RLS-enforced, `ostati-site`'s
  `src/lib/supabase-admin/server.ts` — never a service_role bypass).
  `job_posts` only ever had three SELECT policies (0004): the job's own
  Customer, a Provider on still-`pending` jobs, and the assigned
  Provider — none match an admin who is neither. The query didn't error,
  it silently returned zero rows (RLS filtering, not a failure) — the
  disputes page showed "no disputes" for a job that was genuinely sitting
  there disputed. 0072 added the identical "Admin can read all X" pattern
  for `users`/`provider_verification_requests`/`job_reports` when
  building the first two admin sections; `job_posts` was simply never
  touched since no admin feature had needed to read it until now. New
  policy, same `is_admin()` helper, read-only — `job_posts`
  INSERT/UPDATE stay fully RPC-only (0026/0050/0052/0053) regardless;
  `admin_resolve_job_dispute()` (0078) already does its own independent
  `is_admin()` check before writing, so this changes nothing about who
  can mutate a job. Verified live end-to-end through the actual admin UI
  (not just direct SQL): clicking "ოსტატს ვემხრობი" on the one real
  disputed test job correctly transitioned it to
  `awaiting_customer_confirmation` with `dispute_reason` cleared.

## Job-taking improvements (0081)

- **`0081`** — two gaps in the "Provider takes a job" flow
  (`express_interest` -> `select_provider`), found the same way as
  0078/0079: reading the actual code, not guessing. (1) A Provider who
  expressed interest but was NOT selected was never told —
  `select_provider()`/`assign_job_provider()` (0075) only ever notified
  the WINNING Provider; the job just silently vanished from every other
  interested Provider's feed (`get_open_provider_feed()`, 0052, hard-
  filters to `status='pending'`). Fixed inside the shared
  `assign_job_provider()` helper (used by both `select_provider()` and
  `respond_to_chat_offer()`'s chat-offer-acceptance auto-select, 0075) so
  both assignment paths get it for free — one `INSERT ... SELECT`
  notifies every other `job_responses` row on that job
  (`type='job_status_change'`, `target` intentionally `null`: once
  `active`, a non-selected Provider is neither the job's `customer_id`
  nor `provider_id`, so there's no screen left that would actually show
  it to them — `navigateToNotificationTarget()` already no-ops on a null
  target). (2) No way to withdraw an expressed interest at all —
  `express_interest()` was the only writer to `job_responses`, nothing
  ever deleted a row. New `withdraw_interest(job_id)` RPC — same locking
  pattern as `express_interest()`'s own 0066 race fix (`job_posts` locked
  `for update` before checking `status='pending'`, so this can't race a
  concurrent `select_provider()` on the same job), only allowed while
  still `pending` (raises `'Interest can no longer be withdrawn once a
  provider is selected'` otherwise). Client: `quoteService.withdrawInterest()`,
  a small "X" button next to the expressed-interest footer button on
  `ProviderJobDetailScreen` (`variant === 'browse'` only — the same
  state the RPC itself requires), confirm dialog before calling. Verified
  live against real data: selecting a Provider on a job with 2 responses
  correctly notified both the winner (`job_selected`) and the loser
  (`job_status_change`); withdrawing removed the `job_responses` row and
  a second withdrawal attempt correctly raised "no response on file";
  attempting to withdraw on a job that had just gone `active` correctly
  raised "no longer pending".

## Offer superseding and stale-interest nudge (0082)

- **`0082`** — two more findings from the same job-taking review, both
  user-approved before starting. (A) A Provider could send a new chat
  price offer while an older one on the same job was still
  `offer_status='pending'` — nothing prevented it (offers are direct
  client INSERTs under RLS, 0066, not funneled through one RPC), and
  accepting the new one never touched the old row, leaving a stale,
  still-"actionable-looking" offer card in chat history forever. New
  `AFTER INSERT` trigger `supersede_prior_offers()` (SECURITY DEFINER —
  the UPDATE it performs, a Provider's own prior offer, is exactly what
  "Participant can update messages" forbids a Provider from doing
  directly, 0028/0097) marks a Provider's own still-pending prior offers
  on the same `(job_id, provider_id)` as `'superseded'` whenever they send
  a new one — scoped to `(job_id, provider_id)` together, not `job_id`
  alone, since multiple different Providers can each run their own
  separate offer thread on one open job. `messages_offer_status_check`
  extended to allow the new value; client (`ChatConversationScreen`)
  renders it with the existing muted/pending-style badge, new label
  "მოძველებულია — ახალი შეთავაზება გაიგზავნა", accept/decline buttons
  correctly hidden (`canRespond` already only matches `'pending'`).
  (B) A job with ZERO interest just sat `pending` forever with no signal
  to the Customer — contrast with a job that DOES get a response, which
  already notifies the Customer every time (0021). Same lazy/opportunistic
  pattern as 0079/0081 (no cron infrastructure in this project): new RPC
  `check_stale_job_interest(job_id)`, callable only by the job's own
  customer_id, sends **at most one** reminder ever per job — idempotency
  via a new `job_posts.stale_interest_reminder_sent_at` timestamp, not a
  notifications-table dedupe query — once `>=48h` old, still `pending`,
  and zero `job_responses` exist. Does not change `job_posts.status` at
  all (unlike 0078/0079) — there is no automatic resolution for "nobody
  is interested," only a nudge. Client: `CustomerJobDetailScreen` calls it
  fire-and-forget whenever it loads a `pending` job. Verified live against
  real data: a genuinely-old (created 2026-09-04), zero-response job
  correctly returned `true` and created the notification on first call,
  `false` on a second call (no duplicate), and a non-owner caller was
  correctly rejected. The offer-supersede trigger was verified by
  inserting a second real offer message on a job with an existing
  pending one from the same Provider — the old message flipped to
  `superseded`, the new one stayed `pending`, and a different Provider's
  unrelated offer on the same job was left untouched.

## Phone/SMS-OTP auth column (0083) — REQUIRES manual Dashboard/Twilio setup

- **`0083`** — pure additive column, `users.phone text not null default
  ''` — backs the new phone-number registration/login flow (Sign in with
  Apple was added alongside it; Apple needs no schema change since it
  reuses `signInWithIdToken()` exactly like Google, see CLAUDE.md #107).
  No RLS change: the existing owner-only row policies on `users` already
  cover this column like every other one on the row. `UserRecord`/
  `CustomerProfile` (TS) and `userService.ts`'s row-mapping gained a
  matching `phone`/`row.phone` field, mirrored on `email` exactly.

  **This column alone does not make phone auth work** — Supabase's Phone
  provider (backed by Twilio Verify, not plain Twilio Messaging) has to
  be configured in the Dashboard before `authService.sendPhoneOtp()`/
  `verifyPhoneOtp()` (`supabase.auth.signInWithOtp({phone})`/
  `verifyOtp({phone, token, type:'sms'})`) can succeed:
  1. Create a Twilio account + a **Verify Service** (this, not plain
     Messaging, is what Supabase's Phone provider expects).
  2. Dashboard → Authentication → Providers → Phone: enable it, select
     Twilio Verify, paste Account SID / Auth Token / Verify Service SID.

  Until this is done, `sendPhoneOtp()` fails gracefully (mapped Georgian
  error banner, confirmed live on the emulator — no crash) rather than
  silently succeeding. Georgia-only app: phone numbers are always
  `+995`-prefixed, validated client-side against `/^5\d{8}$/` before ever
  calling the RPC.

  Sign in with Apple similarly needs `expo-apple-authentication` +
  `usesAppleSignIn: true` (already in `app.json`) plus, on Apple's/
  Supabase's side: Sign in with Apple capability on the `com.ostati.app`
  identifier, a Services ID + private key, and Dashboard → Authentication
  → Providers → Apple configured with them — none of which can be done
  from a migration. It also needs a new native rebuild (`eas build`) for
  the native module to actually function — the Android JS-level fallback
  (`isAvailableAsync()` returning `false`, hiding the button) already
  works today without a rebuild, confirmed live on the emulator.
