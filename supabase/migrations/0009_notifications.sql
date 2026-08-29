-- 0009_notifications.sql
-- `notifications` — in-app notification feed (CLAUDE.md #70). Rows are
-- created client-side, from whichever service method corresponds to the
-- real event (new chat message, new job interest, job status change) —
-- not via a DB trigger or service-role backend.
--
-- ** KNOWN GAP, read before applying **
-- The task's security spec asks that "a random client must not be able
-- to create arbitrary notifications for unrelated users." The app's
-- CURRENT, actually-deployed design does not satisfy this: because
-- notification rows are inserted directly by the client (e.g. a
-- Provider inserts a row addressed to the Customer when expressing
-- interest), the INSERT policy below intentionally allows any
-- authenticated user to insert a notification for any user_id — this
-- matches what's live today (CLAUDE.md #70's own policy comment says
-- exactly this). Tightening it (e.g. requiring a real relationship
-- between auth.uid() and the target user_id, or moving creation into a
-- SECURITY DEFINER function) would be a real behavior change and was
-- called out as out of scope for this migration ("do not continue into
-- unrelated backend work yet") — flagged here as a follow-up, not
-- silently fixed or silently ignored.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  icon_emoji text not null default '',
  icon_bg text not null default '',
  target jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notifications add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_notifications_user_unread on public.notifications(user_id, read);

alter table public.notifications enable row level security;

drop policy if exists "Owner can read own notifications" on public.notifications;
create policy "Owner can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Owner can update own notifications" on public.notifications;
create policy "Owner can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- See the KNOWN GAP note above — this intentionally mirrors the current
-- live policy (permissive insert for any authenticated caller), not the
-- stricter "only for a related user" rule the task's security spec asks
-- for.
drop policy if exists "Any authenticated user can insert notifications" on public.notifications;
create policy "Any authenticated user can insert notifications"
  on public.notifications for insert
  to authenticated
  with check (true);

drop trigger if exists set_updated_at on public.notifications;
create trigger set_updated_at
  before update on public.notifications
  for each row
  execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
