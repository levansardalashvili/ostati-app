-- 0020_messages_notify_trigger.sql
-- Task 1 — replaces chatService.ts's old touchConversation() (JS-side
-- "read customer_unread/provider_unread -> increment in JS -> write back")
-- with a single atomic `INSERT ... ON CONFLICT DO UPDATE SET unread =
-- conversations.unread + 1` inside an AFTER INSERT trigger on `messages`.
-- Because it runs in the SAME transaction as the message insert, there is
-- no separate round trip that can race with a concurrent send from the
-- other participant (the old code's read-then-write in JS could lose an
-- increment if both sides sent near-simultaneously; a same-statement SQL
-- increment under Postgres's row lock on the conflicting unique key
-- cannot).
--
-- Task 3 — also replaces chatService.ts's old notifySender() (a plain
-- client `.insert()` into `notifications`, only possible because of the
-- now-removed open policy from 0018) with a notification insert done
-- here, server-side. Two things make this safe against a malicious
-- client in a way the old client-side call never was:
--   1. It only ever runs as a side effect of a message that already,
--      genuinely passed `messages`' own RLS/check-constraint (sender_id
--      = auth.uid(), sender is a participant) — a client cannot invoke
--      this trigger "on behalf of" a message it didn't actually send.
--   2. The notification body is derived from NEW.type/NEW.text/NEW.amount
--      (the row that was actually inserted), never from a client-supplied
--      free-text "body" parameter — a client cannot make this trigger
--      send a notification whose content doesn't match a real message.
--
-- Participant display names (customer_name/provider_name/initials) are
-- looked up here from `users`/`provider_profiles` directly (this
-- function is SECURITY DEFINER, so it bypasses their owner-only RLS) —
-- the client no longer needs to pass a ChatParticipants struct at all,
-- which removes what had been the last case in this file where the
-- client's own claim about someone's display name was trusted verbatim.
-- Avatar color has no per-user concept anywhere in this app (every
-- Customer/Provider avatar renders with the same brand blue,
-- src/theme/colors.ts's `colors.primary` = #2563EB) so it's hardcoded
-- here rather than plumbed through as a parameter.

create or replace function public.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_customer_initials text;
  v_provider_name text;
  v_provider_initials text;
  v_body text;
  v_recipient uuid;
  v_sender_name text;
  v_sender_initials text;
  v_inc_customer int;
  v_inc_provider int;
begin
  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'მომხმარებელი'),
         upper(left(coalesce(first_name, ''), 1) || left(coalesce(last_name, ''), 1))
    into v_customer_name, v_customer_initials
    from public.users where id = new.customer_id;

  select coalesce(nullif(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), ''), 'ოსტატი'),
         upper(left(coalesce(first_name, ''), 1) || left(coalesce(last_name, ''), 1))
    into v_provider_name, v_provider_initials
    from public.provider_profiles where id = new.provider_id;

  v_body := case new.type
    when 'offer' then 'შეთავაზებული ფასი: ' || trim(to_char(coalesce(new.amount, 0), 'FM999999990')) || ' ₾'
    when 'image' then '📷 ფოტო'
    else new.text
  end;

  v_inc_customer := case when new.sender_id = new.customer_id then 0 else 1 end;
  v_inc_provider := case when new.sender_id = new.customer_id then 1 else 0 end;

  insert into public.conversations (
    customer_id, provider_id, customer_name, customer_initials, customer_color,
    provider_name, provider_initials, provider_color, last_message, last_message_at,
    customer_unread, provider_unread
  ) values (
    new.customer_id, new.provider_id,
    coalesce(v_customer_name, ''), coalesce(v_customer_initials, ''), '#2563EB',
    coalesce(v_provider_name, ''), coalesce(v_provider_initials, ''), '#2563EB',
    v_body, new.created_at, v_inc_customer, v_inc_provider
  )
  on conflict (customer_id, provider_id) do update set
    customer_name = excluded.customer_name,
    customer_initials = excluded.customer_initials,
    provider_name = excluded.provider_name,
    provider_initials = excluded.provider_initials,
    last_message = excluded.last_message,
    last_message_at = excluded.last_message_at,
    customer_unread = public.conversations.customer_unread + v_inc_customer,
    provider_unread = public.conversations.provider_unread + v_inc_provider;

  v_recipient := case when new.sender_id = new.customer_id then new.provider_id else new.customer_id end;
  v_sender_name := case when new.sender_id = new.customer_id then v_customer_name else v_provider_name end;
  v_sender_initials := case when new.sender_id = new.customer_id then v_customer_initials else v_provider_initials end;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target)
  values (
    v_recipient,
    'ახალი შეტყობინება',
    v_body,
    '💬',
    '#2563EB',
    jsonb_build_object(
      'screen', 'ChatConversation',
      'chatId', new.sender_id,
      'name', coalesce(v_sender_name, ''),
      'initials', coalesce(v_sender_initials, ''),
      'color', '#2563EB'
    )
  );

  return new;
end;
$$;

comment on function public.handle_new_message() is
  'AFTER INSERT ON messages: atomically upserts the conversations summary row (last_message/last_message_at/unread counters, real SQL increment, no read-then-write race) and inserts a notification for the recipient — content derived entirely from the inserted row, never from client input.';

drop trigger if exists on_message_insert_notify on public.messages;
create trigger on_message_insert_notify
  after insert on public.messages
  for each row
  execute function public.handle_new_message();
