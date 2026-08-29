-- 0017_notification_preferences.sql
-- Task 3 — NotificationSettingsScreen.tsx toggles, previously local
-- `useState` only (reset every time the screen unmounted/app restarted).
-- One row per user, a single `prefs jsonb` map (toggle-key -> boolean)
-- rather than one column per toggle: the toggle set already differs by
-- role (4 customer toggles, 5 provider toggles) and is UI copy that may
-- grow/change — a jsonb map keyed by a stable slug (defined in
-- src/screens/NotificationSettingsScreen.tsx, e.g. 'new_chat_message')
-- avoids a schema migration every time a toggle is added or reworded.
--
-- A missing key inside `prefs` (new user, or a toggle added after the
-- user last visited this screen) means "never touched" and the client
-- treats it as enabled-by-default — see getPreferences/setPreference in
-- src/services/notificationService.ts. This table has no relation today
-- to whether a notification is actually sent (all notification-creation
-- call sites still fire unconditionally, per CLAUDE.md #70) — it exists
-- so a future push-notification sender can look up and respect these
-- preferences without a UI change.

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "Owner can read own notification preferences" on public.notification_preferences;
create policy "Owner can read own notification preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "Owner can insert own notification preferences" on public.notification_preferences;
create policy "Owner can insert own notification preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owner can update own notification preferences" on public.notification_preferences;
create policy "Owner can update own notification preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_updated_at on public.notification_preferences;
create trigger set_updated_at
  before update on public.notification_preferences
  for each row
  execute function public.set_updated_at();
