-- 0029_conversations_lockdown.sql
-- Security audit — conversations. 0007's INSERT/UPDATE policies let
-- either participant write ANY column of their own conversation row
-- directly — including the OTHER side's unread counter, last_message,
-- last_message_at, or the denormalized display names. In practice the
-- only writer has been chatService.ts's markConversationRead() (setting
-- its own unread counter to 0) plus the on_message_insert_notify trigger
-- (0020, SECURITY DEFINER, does the real create/update atomically on
-- every message) — but RLS is the actual boundary, not what today's
-- client happens to send. A modified client could set the other
-- participant's unread counter, rewrite the last-message preview, or
-- forge conversation rows with no real messages behind them at all.
--
-- Fix: remove direct client INSERT/UPDATE entirely. The message trigger
-- (which is SECURITY DEFINER and therefore unaffected by revoking the
-- client's own grants) remains the only writer for conversation
-- creation/last-message/unread-increment. A new narrowly-scoped RPC
-- replaces the one legitimate direct write a client still needs: resetting
-- their OWN unread counter to 0 when they open a chat.

revoke insert, update on public.conversations from authenticated;

drop policy if exists "Participant can insert conversations" on public.conversations;
drop policy if exists "Participant can update conversations" on public.conversations;

-- "Participant can read conversations" (0007) is untouched — clients
-- still need to read their own chat list normally.

create or replace function public.mark_conversation_read(p_customer_id uuid, p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is distinct from p_customer_id and auth.uid() is distinct from p_provider_id then
    raise exception 'Only a participant can mark this conversation read';
  end if;

  if auth.uid() = p_customer_id then
    update public.conversations set customer_unread = 0
    where customer_id = p_customer_id and provider_id = p_provider_id;
  else
    update public.conversations set provider_unread = 0
    where customer_id = p_customer_id and provider_id = p_provider_id;
  end if;
end;
$$;

comment on function public.mark_conversation_read(uuid, uuid) is
  'Resets only the CALLING participant''s own unread counter (customer_unread if called as the customer, provider_unread if called as the provider) to 0 — the only conversations write a client legitimately needs, now that direct INSERT/UPDATE is revoked.';

grant execute on function public.mark_conversation_read(uuid, uuid) to authenticated;
