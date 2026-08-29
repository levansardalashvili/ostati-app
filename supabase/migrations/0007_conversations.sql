-- 0007_conversations.sql
-- `conversations` — one denormalized summary row per (customer, provider)
-- pair: last message + per-side unread counters. Exists purely to make
-- the chat list (D1) and unread badges fast/possible, since Realtime's
-- postgres_changes filter can't express "customer_id = me OR
-- provider_id = me" against `messages` directly (CLAUDE.md #68). Kept in
-- sync by chatService.ts's touchConversation() on every message send —
-- not a DB trigger.

create table if not exists public.conversations (
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null default '',
  customer_initials text not null default '',
  customer_color text not null default '#2563EB',
  provider_name text not null default '',
  provider_initials text not null default '',
  provider_color text not null default '#2563EB',
  last_message text not null default '',
  last_message_at timestamptz not null default now(),
  customer_unread int not null default 0,
  provider_unread int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (customer_id, provider_id)
);

alter table public.conversations add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_conversations_provider_id on public.conversations(provider_id);

alter table public.conversations enable row level security;

drop policy if exists "Participant can read conversations" on public.conversations;
create policy "Participant can read conversations"
  on public.conversations for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);

drop policy if exists "Participant can insert conversations" on public.conversations;
create policy "Participant can insert conversations"
  on public.conversations for insert
  with check (auth.uid() = customer_id or auth.uid() = provider_id);

drop policy if exists "Participant can update conversations" on public.conversations;
create policy "Participant can update conversations"
  on public.conversations for update
  using (auth.uid() = customer_id or auth.uid() = provider_id)
  with check (auth.uid() = customer_id or auth.uid() = provider_id);

drop trigger if exists set_updated_at on public.conversations;
create trigger set_updated_at
  before update on public.conversations
  for each row
  execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
