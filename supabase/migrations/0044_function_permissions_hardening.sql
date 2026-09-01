-- 0044_function_permissions_hardening.sql
-- Supabase Security Advisor hardening pass. Root cause behind almost
-- every warning here: PostgreSQL grants EXECUTE on a newly created
-- function to PUBLIC by default, and every prior migration in this
-- project only ever ADDED `grant execute ... to authenticated` on top
-- of that default — none of them first revoked the implicit PUBLIC
-- grant (the two exceptions, can_access_private_chat_media/
-- can_access_private_job_media in 0040, already did this correctly).
-- Since every role (including `anon`) is implicitly a member of PUBLIC,
-- this means every RPC in this project has been directly callable by
-- an unauthenticated `anon`-key caller this whole time — each function's
-- own internal auth.uid() checks correctly reject such calls (they all
-- either raise on a null/mismatched identity or fail an ownership
-- check), but Advisor is right to flag the privilege model itself as
-- looser than it needs to be. This migration does not change what any
-- function DOES — only who is allowed to even attempt calling it.
--
-- Four groups, treated differently (see the task's own categories):
--   A. Client-callable RPCs (verified against every `supabase.rpc(...)`
--      call in src/services/*.ts) — PUBLIC/anon revoked, authenticated
--      keeps EXECUTE, each re-verified to have its own auth.uid()-based
--      ownership/role check (see the table in the final report).
--   B. Trigger-only functions — never called via RPC, only invoked by
--      the trigger mechanism itself when their table fires. PostgreSQL
--      does not gate trigger *firing* on the acting role's EXECUTE
--      privilege on the trigger function (this is standard, documented
--      Postgres behavior, not something specific to this schema) — so
--      revoking EXECUTE from every role here does not stop these
--      triggers from running, it only stops someone from invoking the
--      function directly as if it were an RPC (which would fail
--      anyway — a trigger function called outside trigger context has
--      no NEW/OLD row and errors immediately).
--   C. Internal SQL helpers, called only from within OTHER
--      SECURITY DEFINER functions' bodies (job_category_label,
--      specialty_to_category, job_scheduled_start) — never called
--      directly by the client (verified: zero matches for these names
--      in src/services/*.ts's `.rpc(...)` calls). A function call made
--      from inside a SECURITY DEFINER function's body is privilege-
--      checked against that function's OWNER, not the original caller —
--      so revoking direct EXECUTE from authenticated/anon/PUBLIC here
--      does not break select_provider/provider_request_completion/
--      customer_report_problem/cancel_job/provider_cancel_job/
--      handle_new_job_notify calling them internally.
--   D. Private-media RLS authorization helpers
--      (can_access_private_chat_media/can_access_private_job_media) —
--      genuinely different from B/C: these are invoked BY the
--      storage.objects RLS policy expressions themselves, evaluated in
--      the querying (authenticated) session's context, so `authenticated`
--      MUST keep EXECUTE or every private-media read/upload breaks.
--      0040 already granted this correctly; restated here, idempotently,
--      for a single complete picture of this project's function grants.
--
-- Every REVOKE/GRANT below is idempotent (safe to re-run) and touches
-- only privileges — no function body, table, or RLS policy is altered,
-- and no old migration is modified.

-- ============================================================
-- A. Client-callable RPCs — PUBLIC/anon revoked, authenticated only
-- ============================================================
revoke execute on function public.select_provider(uuid, uuid) from public, anon;
grant execute on function public.select_provider(uuid, uuid) to authenticated;

revoke execute on function public.provider_request_completion(uuid) from public, anon;
grant execute on function public.provider_request_completion(uuid) to authenticated;

revoke execute on function public.customer_confirm_completion(uuid) from public, anon;
grant execute on function public.customer_confirm_completion(uuid) to authenticated;

revoke execute on function public.customer_report_problem(uuid, text) from public, anon;
grant execute on function public.customer_report_problem(uuid, text) to authenticated;

revoke execute on function public.cancel_job(uuid, text) from public, anon;
grant execute on function public.cancel_job(uuid, text) to authenticated;

revoke execute on function public.provider_cancel_job(uuid, text, text) from public, anon;
grant execute on function public.provider_cancel_job(uuid, text, text) to authenticated;

revoke execute on function public.create_job_report(uuid, text, text) from public, anon;
grant execute on function public.create_job_report(uuid, text, text) to authenticated;

revoke execute on function public.request_provider_verification() from public, anon;
grant execute on function public.request_provider_verification() to authenticated;

revoke execute on function public.mark_conversation_read(uuid, uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;

revoke execute on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

revoke execute on function public.deactivate_push_token(text) from public, anon;
grant execute on function public.deactivate_push_token(text) to authenticated;

revoke execute on function public.respond_to_chat_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_chat_offer(uuid, text) to authenticated;

-- get_provider_stats — audited separately (task item 3). SECURITY
-- DEFINER is genuinely required: completed_jobs/review aggregates must
-- read job_posts/reviews rows across ALL customers per provider, which
-- SECURITY INVOKER could never do (job_posts' own RLS only lets a
-- caller see rows where they are the customer or assigned provider —
-- a security-invoker version of this function would silently return
-- wrong, caller-scoped numbers for every OTHER provider, not an error,
-- which is worse). Confirmed safe to keep DEFINER: it returns only
-- (provider_id, avg_rating, review_count, completed_jobs) — four
-- aggregate numbers already meant to be public (the same numbers the
-- Provider directory already shows to every Customer), no row content,
-- no PII, no email/address/name.
revoke execute on function public.get_provider_stats(uuid) from public, anon;
grant execute on function public.get_provider_stats(uuid) to authenticated;

-- ============================================================
-- B. Trigger-only functions — no direct EXECUTE for any role
-- ============================================================
revoke execute on function public.handle_new_message() from public, anon, authenticated;
revoke execute on function public.handle_job_response_notify() from public, anon, authenticated;
revoke execute on function public.handle_review_completion() from public, anon, authenticated;
revoke execute on function public.handle_new_job_notify() from public, anon, authenticated;
revoke execute on function public.set_review_identity() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- ============================================================
-- C. Internal SQL helpers — called only from inside other
-- SECURITY DEFINER functions, never directly by the client
-- ============================================================
revoke execute on function public.job_category_label(text) from public, anon, authenticated;
revoke execute on function public.specialty_to_category(text) from public, anon, authenticated;
revoke execute on function public.job_scheduled_start(date, text) from public, anon, authenticated;

-- ============================================================
-- D. Private-media RLS authorization helpers — authenticated must
-- keep EXECUTE (invoked by storage.objects RLS policy evaluation in
-- the querying session's own context, not from inside another
-- function). Restated idempotently; 0040 already set this correctly.
-- ============================================================
revoke execute on function public.can_access_private_chat_media(uuid, uuid) from public, anon;
grant execute on function public.can_access_private_chat_media(uuid, uuid) to authenticated;

revoke execute on function public.can_access_private_job_media(uuid) from public, anon;
grant execute on function public.can_access_private_job_media(uuid) to authenticated;

-- ============================================================
-- Item 4 — "Function Search Path Mutable" on public.set_updated_at.
-- The one SECURITY-relevant function in this schema that never had an
-- explicit search_path (it's plain plpgsql, not SECURITY DEFINER, but
-- Advisor flags any function without a fixed search_path on general
-- principle). CREATE OR REPLACE — every table's existing
-- `before update ... execute function public.set_updated_at()` trigger
-- keeps working unchanged; triggers reference the function by name, not
-- a frozen copy, so no per-table re-attachment is needed. `now()`
-- resolves fine under `search_path = ''` — pg_catalog (which owns
-- `now()`) is always implicitly searched regardless of this setting.
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Shared BEFORE UPDATE trigger function — sets updated_at = now() on any row update. Attached per-table in each table''s own migration. Not SECURITY DEFINER (no elevated access needed); search_path fixed per Supabase Advisor''s "Function Search Path Mutable" recommendation.';
