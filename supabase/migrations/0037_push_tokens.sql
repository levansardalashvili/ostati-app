-- 0037_push_tokens.sql
-- Expo Push Notifications, step 1 — the device-token registry. Nothing
-- in this migration sends a push; it only stores where to send one.
--
-- One row per physical device/app-install (not per user) — a user can
-- have several (phone + tablet, or a reinstall that gets a new Expo
-- token), and the SAME device can legitimately belong to different
-- users over time (shared device, logout/login as someone else). Both
-- are handled by the two RPCs below rather than plain client
-- `.insert()`/`.update()` — see their comments for why a plain RLS
-- policy can't safely cover device reassignment.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  device_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_tokens_platform_check check (platform in ('ios', 'android')),
  -- The natural key: an Expo push token identifies one app install. This
  -- is what "avoid duplicate token rows" hangs off of, and what makes
  -- `on conflict (expo_push_token) do update` in register_push_token()
  -- below correct rather than accidental.
  constraint push_tokens_token_unique unique (expo_push_token)
);

create index if not exists idx_push_tokens_user_id on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

-- SELECT/DELETE: plain owner-scoped RLS is sufficient and safe — a user
-- reading or deleting a row they already own has no cross-user edge case
-- (unlike INSERT/reassignment, see below).
drop policy if exists "Owner can read own push tokens" on public.push_tokens;
create policy "Owner can read own push tokens"
  on public.push_tokens for select
  using (user_id = auth.uid());

drop policy if exists "Owner can delete own push tokens" on public.push_tokens;
create policy "Owner can delete own push tokens"
  on public.push_tokens for delete
  using (user_id = auth.uid());

-- INSERT/UPDATE: RPC-only (revoked from `authenticated` entirely — same
-- "no direct client write" pattern as job_posts, 0026). Reason this
-- can't just be a plain owner-scoped INSERT/UPDATE policy like most
-- other owner-scoped tables in this schema: `ON CONFLICT (expo_push_token)
-- DO UPDATE` checks the UPDATE policy's USING clause against the
-- EXISTING (pre-conflict) row. If a device was last registered by a
-- DIFFERENT user (shared device, previous user never logged out
-- cleanly), that existing row's user_id won't match the new caller's
-- auth.uid(), so a plain RLS UPDATE policy would reject the reassignment
-- outright — a legitimate case (same device, new logged-in user should
-- now receive its pushes), not one to just work around. A SECURITY
-- DEFINER RPC sidesteps this correctly instead of loosening RLS: it
-- always writes user_id = auth.uid() (never a parameter), so it still
-- cannot register/reassign a token to an arbitrary other user — it just
-- isn't blocked by the previous owner's row the way plain RLS would be.
revoke insert, update on public.push_tokens from authenticated;

create or replace function public.register_push_token(p_expo_push_token text, p_platform text, p_device_id text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Invalid platform: %', p_platform;
  end if;
  if p_expo_push_token is null or btrim(p_expo_push_token) = '' then
    raise exception 'A push token is required';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform, device_id, is_active, updated_at)
  values (auth.uid(), p_expo_push_token, p_platform, p_device_id, true, now())
  on conflict (expo_push_token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_id = excluded.device_id,
    is_active = true,
    updated_at = now();
end;
$$;

comment on function public.register_push_token(text, text, text) is
  'Registers/reactivates this device''s Expo push token for the calling user, reassigning it if a different user previously owned this exact token (shared/reused device) — user_id is always auth.uid(), never a parameter, so a caller can only ever register a token for themselves.';

grant execute on function public.register_push_token(text, text, text) to authenticated;

create or replace function public.deactivate_push_token(p_expo_push_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.push_tokens
  set is_active = false, updated_at = now()
  where expo_push_token = p_expo_push_token and user_id = auth.uid();
end;
$$;

comment on function public.deactivate_push_token(text) is
  'Marks one of the caller''s own push tokens inactive (logout) — scoped to user_id = auth.uid() even though SECURITY DEFINER bypasses RLS, so a caller cannot deactivate anyone else''s token.';

grant execute on function public.deactivate_push_token(text) to authenticated;
