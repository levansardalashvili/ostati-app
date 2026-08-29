-- 0035_provider_verification_request.sql
-- Provider verification REQUEST flow. 0025 already made
-- provider_profiles.verification_status a real, RLS-locked column (a
-- Provider can never set it directly — the column is not in 0026's
-- column-level UPDATE grant allowlist), but nothing could ever move it
-- out of 'unverified' — there was no admin tool AND no request path.
-- This migration adds exactly one new capability: a Provider asking to
-- be reviewed. It does not build moderation/admin tooling (out of
-- scope) — 'pending' just sits there until a future service_role-backed
-- admin flow sets 'verified'/'rejected', same as before.
--
-- Two new columns, both nullable/optional metadata around the request
-- itself (not new state — verification_status alone still drives all
-- UI branching):
--   - verification_requested_at: when the current pending/rejected
--     cycle's request was filed. Lets a future admin queue sort oldest
--     first; not currently read by the app beyond display.
--   - verification_rejection_reason: set by a future trusted
--     admin/service_role tool (there is deliberately no client or RPC
--     path that writes anything other than NULL into it here) — a
--     Provider may read their own, never edit it. Cleared back to NULL
--     every time a new request is filed, so a stale reason from a prior
--     rejection cycle never lingers next to a fresh 'pending' state.
--
-- Both columns live on provider_profiles, which has been fully
-- public-read (`to authenticated using (true)`) since 0003 — every
-- other column on this row (about, certificates, photo_url, ...) is
-- already visible to any authenticated user, not just the owner. RLS is
-- row-level, not column-level, so partially hiding just these two new
-- columns from non-owners would require splitting this table's read
-- path behind a view — a real architectural change the task's "do not
-- overbuild" instruction argues against, especially for a plain
-- moderation note that is not a credential and not PII. Documented here
-- as a deliberate, considered choice rather than an oversight.

alter table public.provider_profiles add column if not exists verification_requested_at timestamptz;
alter table public.provider_profiles add column if not exists verification_rejection_reason text;

comment on column public.provider_profiles.verification_requested_at is
  'When the current pending/rejected verification cycle was requested. Set only by request_provider_verification(); NULL if never requested.';
comment on column public.provider_profiles.verification_rejection_reason is
  'Set only by a future trusted admin/service_role tool (not built here) — no client or RPC path in this migration ever writes a non-NULL value into it. Cleared on every new request.';

-- Deliberately NOT added to 0026's `grant update (...)` column allowlist
-- for `authenticated` — a column absent from every GRANT simply has no
-- client UPDATE privilege, so both new columns are exactly as
-- client-write-locked as verification_status already is, with no
-- REVOKE needed (there was never a grant to begin with).

create or replace function public.request_provider_verification()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider public.provider_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- Role check reads the caller's OWN `users` row (auth.uid() = id),
  -- which `users`' owner-only SELECT policy already permits regardless
  -- — but this function runs SECURITY DEFINER anyway, so RLS does not
  -- gate this read at all. Kept explicit and fully schema-qualified
  -- (search_path = '') per this project's established RPC pattern
  -- (0014/0034).
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can request verification';
  end if;

  select * into v_provider from public.provider_profiles where id = auth.uid() for update;
  if v_provider.id is null then
    raise exception 'Complete your provider profile before requesting verification';
  end if;

  -- The only two allowed source states. Explicitly excludes 'pending'
  -- (no re-request while already under review) and 'verified' (already
  -- verified, requesting again is meaningless and must not be able to
  -- reset a verified Provider back to pending).
  if v_provider.verification_status not in ('unverified', 'rejected') then
    raise exception 'Verification cannot be requested from status "%"', v_provider.verification_status;
  end if;

  -- verification_status is hardcoded to 'pending' here — the Provider
  -- has no parameter, and therefore no way, to choose the target
  -- status. Old rejection reason is cleared on every new request so it
  -- never carries over into the next review cycle.
  update public.provider_profiles
  set
    verification_status = 'pending',
    verification_requested_at = now(),
    verification_rejection_reason = null
  where id = auth.uid();
end;
$$;

comment on function public.request_provider_verification() is
  'Provider requests a verification review: unverified -> pending or rejected -> pending only (pending->pending and verified->pending both raise). Server always sets verification_status to the literal ''pending'' — the Provider can never pass or choose a target status. SECURITY DEFINER bypasses provider_profiles'' column-level UPDATE grant (0026), which deliberately excludes verification_status/verification_requested_at/verification_rejection_reason from what a Provider may write directly via .update()/.upsert().';

grant execute on function public.request_provider_verification() to authenticated;
