-- 0025_provider_verification_status.sql
-- Task 3 — replaces `provider_profiles.verified` (a bare boolean, added
-- in 0003 as a forward-looking placeholder that the app never actually
-- read or wrote — src/services/userService.ts hardcoded `verified: false`
-- for every Provider) with a proper 4-state `verification_status`:
-- 'unverified' | 'pending' | 'verified' | 'rejected'. 'pending'/'rejected'
-- give a future admin verification flow (out of scope here, per the
-- task) somewhere to put "submitted, awaiting review" and "reviewed,
-- declined" — states a plain boolean can't represent.
--
-- Provider cannot set themselves verified (or pending/rejected): the
-- INSERT/UPDATE policies below lock this column exactly the way 0003
-- locked `verified` — a Provider can freely update every other field on
-- their own profile, but `verification_status` in the submitted row must
-- already match what's currently stored (UPDATE) or must be 'unverified'
-- (INSERT). The only way to actually change it is a Postgres role that
-- bypasses RLS (the service_role key, from a future trusted admin
-- backend/Edge Function) — there is deliberately no client-callable RPC
-- for it, since this task explicitly excludes building that admin flow
-- now. Public reads (existing `provider_profiles` SELECT policy, `to
-- authenticated using (true)`, unchanged) return the real, trustworthy
-- value — the public "verified" badge is only ever as true as this
-- column, which only a trusted backend can move.

alter table public.provider_profiles add column if not exists verification_status text not null default 'unverified';

-- One-time backfill from the old boolean, before it's dropped below —
-- lossless: `verified` was always false in every live row (never
-- written), so this only matters if that ever changed out-of-band.
update public.provider_profiles set verification_status = 'verified' where verified = true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_profiles_verification_status_check') then
    alter table public.provider_profiles
      add constraint provider_profiles_verification_status_check
      check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
  end if;
end $$;

create index if not exists idx_provider_profiles_verification_status on public.provider_profiles(verification_status);

-- Replace 0003's insert/update policies to lock verification_status
-- instead of the old verified column (must happen before dropping
-- `verified` below, since 0003's policy expressions still reference it).
drop policy if exists "Provider can insert own profile" on public.provider_profiles;
create policy "Provider can insert own profile"
  on public.provider_profiles for insert
  with check (auth.uid() = id and verification_status = 'unverified');

drop policy if exists "Provider can update own profile except verified" on public.provider_profiles;
create policy "Provider can update own profile except verified"
  on public.provider_profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and verification_status = (select p.verification_status from public.provider_profiles p where p.id = auth.uid())
  );

-- Safe to drop now: no policy references it any more, and the app never
-- read/wrote it (userService.ts hardcoded `verified: false`) — fully
-- superseded by verification_status above.
alter table public.provider_profiles drop column if exists verified;

comment on column public.provider_profiles.verification_status is
  'unverified (default) | pending | verified | rejected. Client-locked via RLS — only a service_role backend (future admin verification flow) can change it.';
