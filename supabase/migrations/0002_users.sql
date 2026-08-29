-- 0002_users.sql
-- `users` table — base account record (role + identity), one row per
-- auth.users row. Source: src/services/userService.ts (UserRow),
-- src/types/user.ts (UserRecord). Written by RegisterScreen/GoogleCompleteScreen,
-- read by LoginScreen (to route to the right Home), updated by
-- CustomerEditProfileScreen.
--
-- Privacy: this table holds email + default_address, which must NEVER be
-- publicly readable (unlike provider_profiles) — only the owner can read
-- their own row. See CLAUDE.md #52/#60 for why provider-facing public
-- data was denormalized into provider_profiles instead of opening this
-- table up.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  default_address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check check (role in ('customer', 'provider'))
);

alter table public.users add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_users_role on public.users(role);

alter table public.users enable row level security;

-- Owner-only read — email/default_address must not leak to other users.
drop policy if exists "Users can read own profile" on public.users;
create policy "Users can read own profile"
  on public.users for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.users;
create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Owner can update their own row, but the `with check` re-reads the
-- CURRENT stored role for this same row and requires the submitted role
-- to match it — this blocks a user from changing their own role via a
-- normal UPDATE, while still allowing every other field to be edited.
drop policy if exists "Users can update own profile except role" on public.users;
create policy "Users can update own profile except role"
  on public.users for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select u.role from public.users u where u.id = auth.uid())
  );

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row
  execute function public.set_updated_at();
