-- 0003_provider_profiles.sql
-- `provider_profiles` — Provider's own editable profile (specialty,
-- areas, experience, about, photo, certificates/portfolio, sqm prices),
-- plus first_name/last_name denormalized from `users` for the public
-- directory (CLAUDE.md #53/#60 — `users` can never be public-read since
-- it holds email/address, so provider-facing public fields live here
-- instead). Source: src/services/userService.ts (ProviderProfileRow).
--
-- NOTE (assumption): the app's `Provider` TS type (src/types/provider.ts)
-- has a `verified: boolean` field, but it is currently hardcoded to
-- `false` in fromProviderProfileRowToPublicProvider() — there is no
-- `verified` column in the live table today. This migration adds one
-- (default false) because the task's security requirements explicitly
-- require "Provider must not be able to set themselves verified", which
-- needs a real column to enforce against. This is additive/safe and the
-- app does not currently read or write this column, so it has zero
-- effect on existing behavior until a future admin/service-role flow
-- sets it.

create table if not exists public.provider_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  specialty jsonb not null default '[]'::jsonb,
  areas text[] not null default '{}',
  experience text,
  about text not null default '',
  photo_url text,
  certificates jsonb not null default '[]'::jsonb,
  portfolio jsonb not null default '[]'::jsonb,
  sqm_prices jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Additive columns not guaranteed to exist on an already-live table.
alter table public.provider_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.provider_profiles add column if not exists verified boolean not null default false;

alter table public.provider_profiles enable row level security;

-- Public directory read — safe, non-sensitive fields only (no email/phone
-- lives on this table). CLAUDE.md #60.
drop policy if exists "Provider profiles are publicly readable" on public.provider_profiles;
create policy "Provider profiles are publicly readable"
  on public.provider_profiles for select
  to authenticated
  using (true);

drop policy if exists "Provider can insert own profile" on public.provider_profiles;
create policy "Provider can insert own profile"
  on public.provider_profiles for insert
  with check (auth.uid() = id and verified = false);

-- Owner can update their own row, but `verified` in the submitted row
-- must match whatever is currently stored — a Provider can never flip
-- their own verified flag via a normal client update.
drop policy if exists "Provider can update own profile except verified" on public.provider_profiles;
create policy "Provider can update own profile except verified"
  on public.provider_profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and verified = (select p.verified from public.provider_profiles p where p.id = auth.uid())
  );

drop trigger if exists set_updated_at on public.provider_profiles;
create trigger set_updated_at
  before update on public.provider_profiles
  for each row
  execute function public.set_updated_at();
