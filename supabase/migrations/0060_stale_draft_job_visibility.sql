-- 0060_stale_draft_job_visibility.sql
-- Fourth hardening pass, item 3 (optional/recommended — "do not overbuild
-- a cron system unless simple"). This migration does NOT delete anything.
-- It documents the cleanup strategy and adds exactly one small, safe,
-- READ-ONLY building block for a future admin/cron script to use — no
-- scheduled job, no automatic deletion, added here.
--
-- ============================================================
-- The problem (documented, not new): an abandoned draft
-- ============================================================
-- create_job() (0053) creates a status='draft' job_posts row and, if the
-- Customer adds photos, private-media/job/{job_id}/{uid}/... storage
-- objects (0048/0054) BEFORE finalize_job_publish() ever runs. If the
-- Customer never finishes (closes the app, abandons the flow), that row
-- and those objects are permanently orphaned:
--   - the draft is invisible to every Provider read (get_open_provider_feed/
--     get_feed_job_by_id, 0052) and every workflow RPC (all require a
--     non-draft status) — inert, but not gone.
--   - it is still readable by its own Customer (`getJobPostById`), so it
--     is not entirely undiscoverable, but PostJobScreen never re-surfaces
--     an old draft on a fresh visit (draftJob only lives in that screen's
--     own React state, reset on remount) — in practice a Customer has no
--     UI path back to an old abandoned draft at all.
--   - its photos, if any, sit in the `private-media` bucket forever,
--     consuming storage with no product-visible purpose.
--
-- ============================================================
-- The safe strategy (documented for a FUTURE cleanup job — not built here)
-- ============================================================
-- 1. Only ever touch rows where status = 'draft' AND created_at is older
--    than some threshold (e.g. 24-48h — long enough that a slow/retried
--    publish flow is never caught mid-flight). NEVER touch 'pending' or
--    any later status — a published/active/completed job's media must
--    never be reachable by this path, and the WHERE clause below makes
--    that structurally true rather than just documented intent.
-- 2. Run as `service_role` only (a scheduled Edge Function, e.g. the same
--    pattern already used for supabase/functions/send-push-notifications,
--    or Supabase's pg_cron if enabled on the project) — never as
--    `authenticated`. No owner-triggered client path is needed: a
--    Customer has no product reason to ever explicitly "delete my draft",
--    and building one is out of scope here (task: do not redesign).
-- 3. Order of deletion for a given stale draft job_posts.id:
--      a. delete every `storage.objects` row under
--         `private-media/job/{id}/...` (via the Storage API/service_role
--         client — NOT by deleting storage.objects rows directly with raw
--         SQL, which does not reliably remove the underlying object from
--         the storage backend in every Supabase configuration; the
--         Storage HTTP API's remove() is the correct, safe way to do
--         this).
--      b. THEN delete the job_posts row itself. Safe FK-wise: a draft, by
--         construction, can never have any job_responses (Providers never
--         see it to respond to, get_open_provider_feed/get_feed_job_by_id
--         both require status<>'draft'/pending) or any messages
--         referencing it as job_id (an offer requires a job_responses row
--         to exist first, 0056) — so messages.job_id's `ON DELETE
--         RESTRICT` (0057) can never actually block deleting a genuinely
--         stale draft; it would only ever block deleting a job that has
--         real chat activity, which a draft cannot have.
--
-- ============================================================
-- What this migration actually adds: a read-only enumeration helper
-- ============================================================
-- Lets a future service_role script find what to clean up, without this
-- migration performing any deletion itself. No client role can call this.

create or replace function public.list_stale_draft_jobs(p_older_than interval default interval '24 hours')
returns setof public.job_posts
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.job_posts
  where status = 'draft'
    and created_at < now() - p_older_than;
$$;

comment on function public.list_stale_draft_jobs(interval) is
  'READ-ONLY enumeration of abandoned draft jobs (status=draft, older than p_older_than) for a future service_role cleanup script — see this file''s header for the full documented strategy. Deletes nothing itself. service_role-only; no client role may call it.';

revoke execute on function public.list_stale_draft_jobs(interval) from public, anon, authenticated;
grant execute on function public.list_stale_draft_jobs(interval) to service_role;
