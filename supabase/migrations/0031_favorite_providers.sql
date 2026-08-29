-- 0031_favorite_providers.sql
-- `favorite_providers` — Customer's saved/favorite Providers
-- (SavedProvidersScreen, the ❤️ button on ViewProviderProfileScreen).
-- Previously pure local React state (`FavoriteProvidersContext`, never
-- connected to Supabase — CLAUDE.md's "Deliberately not included" list)
-- so favorites were lost on every app restart/reinstall and never
-- synced across devices. This table replaces that with real persistence.
--
-- Composite primary key (user_id, provider_id) does double duty: it's
-- the natural key for "one row per saved provider" AND it structurally
-- guarantees "one Provider cannot be saved twice by the same user" —
-- a second INSERT of the same pair fails with a unique-violation, no
-- separate unique constraint needed.
--
-- Storing only provider_id (not a snapshot of the Provider's data) is
-- deliberate and matches every other denormalization decision in this
-- schema being the exception, not the rule here: favorites are a pure
-- membership relation, and SavedProvidersScreen already re-fetches full
-- Provider objects from provider_profiles/get_provider_stats — there is
-- nothing to keep in sync by duplicating fields onto this row.

create table if not exists public.favorite_providers (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);

create index if not exists idx_favorite_providers_user_id on public.favorite_providers(user_id);
create index if not exists idx_favorite_providers_provider_id on public.favorite_providers(provider_id);

alter table public.favorite_providers enable row level security;

-- Read: owner-only. No policy allows reading anyone else's favorites.
drop policy if exists "Customer can read own favorites" on public.favorite_providers;
create policy "Customer can read own favorites"
  on public.favorite_providers for select
  using (user_id = auth.uid());

-- Insert: user_id must be the caller (never someone else's uid), the
-- caller must actually be a Customer, and provider_id must reference a
-- real Provider. The role check reads the caller's OWN `users` row
-- (auth.uid() = id), which `users`' own RLS already permits — it does
-- NOT try to read anyone else's row (that would be silently blocked by
-- users' owner-only SELECT policy and make every insert fail). The
-- provider-existence check instead reads `provider_profiles`, which is
-- publicly readable to any authenticated user (0003), so checking an
-- arbitrary provider_id's existence there works correctly regardless of
-- who is asking — this is why two different tables are used for the two
-- checks, not one.
drop policy if exists "Customer can add own favorites" on public.favorite_providers;
create policy "Customer can add own favorites"
  on public.favorite_providers for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer')
    and exists (select 1 from public.provider_profiles pp where pp.id = provider_id)
  );

-- Delete: owner-only (unfavoriting).
drop policy if exists "Customer can delete own favorites" on public.favorite_providers;
create policy "Customer can delete own favorites"
  on public.favorite_providers for delete
  using (user_id = auth.uid());

-- No UPDATE policy — a favorite is either present or absent, there is
-- no in-place edit, so no policy is added (default-deny covers it).
