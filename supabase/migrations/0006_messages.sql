-- 0006_messages.sql
-- `messages` — chat messages between one Customer/Provider pair.
-- Conversation identity is the (customer_id, provider_id) pair itself
-- (CLAUDE.md #57 — deliberately no separate "conversation id" concept
-- at the message level; see 0007_conversations.sql for the summary
-- table used by the chat list). Supports plain text, structured price
-- offers (#66), and images (#68). Source: src/services/chatService.ts
-- (MessageRow).

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'text',
  text text not null default '',
  image_url text,
  amount numeric,
  comment text,
  offer_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_type_check check (type in ('text', 'offer', 'image')),
  constraint messages_offer_status_check check (offer_status is null or offer_status in ('pending', 'accepted', 'declined')),
  constraint messages_sender_is_participant check (sender_id = customer_id or sender_id = provider_id)
);

alter table public.messages add column if not exists updated_at timestamptz not null default now();
alter table public.messages add column if not exists image_url text;

create index if not exists idx_messages_conversation on public.messages(customer_id, provider_id, created_at);

alter table public.messages enable row level security;

-- Only the two participants (Customer + Provider on this row) can read.
drop policy if exists "Participant can read messages" on public.messages;
create policy "Participant can read messages"
  on public.messages for select
  using (auth.uid() = customer_id or auth.uid() = provider_id);

-- sender_id must equal auth.uid(), and the sender must be one of the two
-- participants on the row they're inserting.
drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (auth.uid() = customer_id or auth.uid() = provider_id)
  );

-- Needed for structured price-offer accept/decline (#66) — either
-- participant can update offer_status on a message in their own
-- conversation.
drop policy if exists "Participant can update messages" on public.messages;
create policy "Participant can update messages"
  on public.messages for update
  using (auth.uid() = customer_id or auth.uid() = provider_id)
  with check (auth.uid() = customer_id or auth.uid() = provider_id);

drop trigger if exists set_updated_at on public.messages;
create trigger set_updated_at
  before update on public.messages
  for each row
  execute function public.set_updated_at();

-- Realtime — required for the live chat (#59) and offer-status updates
-- (#66) to push to the other participant without a manual refresh.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
