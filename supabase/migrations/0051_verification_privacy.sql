-- 0051_verification_privacy.sql
-- Second hardening pass, item 8. `provider_profiles` has been fully
-- public-read (`to authenticated using (true)`) since 0003 — correct
-- for the profile fields that make up the public directory (name,
-- specialty, about, photo, ...), but `verification_requested_at`/
-- `verification_rejection_reason` (added in 0035) rode along on that
-- same public-read policy. A moderation rejection note was readable by
-- any authenticated user, not just the Provider it's about. This
-- migration moves both columns to a new, owner-only table.
-- `verification_status` itself stays on provider_profiles — it is
-- exactly the "safe public verification state" the task says should
-- stay public (the VerifiedBadge shown on 5 screens depends on it).

create table if not exists public.provider_verification_requests (
  provider_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz,
  rejection_reason text,
  updated_at timestamptz not null default now()
);

alter table public.provider_verification_requests enable row level security;

-- Owner-only read — the one thing this table's RLS needs to guarantee.
drop policy if exists "Provider can read own verification request" on public.provider_verification_requests;
create policy "Provider can read own verification request"
  on public.provider_verification_requests for select
  using (provider_id = auth.uid());

-- No client INSERT/UPDATE/DELETE grant — request_provider_verification()
-- (redefined below) is the only writer, same "RPC-only" pattern as
-- everywhere else a Provider must not be able to touch their own
-- moderation state directly.
revoke insert, update, delete on public.provider_verification_requests from authenticated;

drop trigger if exists set_updated_at on public.provider_verification_requests;
create trigger set_updated_at
  before update on public.provider_verification_requests
  for each row
  execute function public.set_updated_at();

-- One-time migration of existing data, then drop the old columns.
insert into public.provider_verification_requests (provider_id, requested_at, rejection_reason)
select id, verification_requested_at, verification_rejection_reason
from public.provider_profiles
where verification_requested_at is not null or verification_rejection_reason is not null
on conflict (provider_id) do update set
  requested_at = excluded.requested_at,
  rejection_reason = excluded.rejection_reason;

alter table public.provider_profiles drop column if exists verification_requested_at;
alter table public.provider_profiles drop column if exists verification_rejection_reason;

-- ============================================================
-- request_provider_verification() — writes to the new table instead of
-- provider_profiles. Same transitions/validation as 0035 (unverified or
-- rejected -> pending only); a Provider still can never set their own
-- verification_status, and now cannot touch their own rejection_reason
-- either (there was never a write path to it, this doesn't change that —
-- only where the READ-only history lives).
-- ============================================================
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

  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can request verification';
  end if;

  select * into v_provider from public.provider_profiles where id = auth.uid() for update;
  if v_provider.id is null then
    raise exception 'Complete your provider profile before requesting verification';
  end if;

  if v_provider.verification_status not in ('unverified', 'rejected') then
    raise exception 'Verification cannot be requested from status "%"', v_provider.verification_status;
  end if;

  update public.provider_profiles
  set verification_status = 'pending'
  where id = auth.uid();

  insert into public.provider_verification_requests (provider_id, requested_at, rejection_reason)
  values (auth.uid(), now(), null)
  on conflict (provider_id) do update set
    requested_at = excluded.requested_at,
    rejection_reason = null;
end;
$$;

comment on function public.request_provider_verification() is
  'Provider requests a verification review: unverified -> pending or rejected -> pending only. Server always sets verification_status to the literal ''pending''. Request metadata (requested_at, and any future rejection_reason set by a trusted admin tool) lives in provider_verification_requests, readable only by the Provider it belongs to — not the public provider_profiles row.';

revoke execute on function public.request_provider_verification() from public, anon;
grant execute on function public.request_provider_verification() to authenticated;
