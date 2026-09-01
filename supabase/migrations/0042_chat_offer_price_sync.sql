-- 0042_chat_offer_price_sync.sql
-- Price consistency (audit finding #4). Two independent price sources
-- existed: `job_responses.offered_price` (canonical — select_provider()
-- copies it atomically into job_posts.agreed_price, 0014/0022) and a
-- chat "offer" message's own `amount` (structured price card, #2/#66).
-- A Provider could negotiate a DIFFERENT number in chat than what their
-- job_responses row held, the Customer could accept that chat number,
-- and select_provider() would still copy the STALE job_responses price —
-- silently inconsistent with what was actually agreed in the chat.
--
-- Fix: a new SECURITY DEFINER RPC (respond_to_chat_offer) becomes the
-- ONLY way to accept/decline a chat price offer. On acceptance, if
-- exactly one unambiguous, still-open (job status = 'pending') job
-- connects this Customer/Provider pair, its job_responses.offered_price
-- is updated to the accepted amount, atomically, in the same statement
-- as the offer_status change. `messages` has no job_id column (a chat
-- "conversation" is scoped only by (customer_id, provider_id), #57) —
-- if a Provider has responded to more than one of this Customer's still-
-- open jobs, which one the chat offer refers to is genuinely ambiguous
-- with the current schema, so the sync is deliberately skipped in that
-- case (details in the function's own comment) rather than guessing.
--
-- Declining never touches job_responses at all. A plain text message
-- can never reach this function (there is no message id/type check that
-- would let a text message be "accepted") — pricing can only ever move
-- through a genuine type='offer' row.

-- ============================================================
-- INSERT hardening — only a Provider may send a structured price offer
-- ============================================================
-- Previously (0028) `type` was not restricted at all for a Customer's
-- otherwise-unrestricted "message any Provider" path — a Customer could
-- insert a type='offer' row naming themselves as sender, which (before
-- this migration) a Provider could then "accept", polluting
-- job_responses.offered_price with a Customer-fabricated number. CREATE
-- OR REPLACE is not available for policies, so this is the same
-- drop+recreate 0028 itself used on 0006's original.
drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (type <> 'offer' or auth.uid() = provider_id)
    and (
      auth.uid() = customer_id
      or (
        auth.uid() = provider_id
        and (
          exists (
            select 1 from public.job_responses jr
            join public.job_posts jp on jp.id = jr.job_id
            where jr.provider_id = messages.provider_id
              and jp.customer_id = messages.customer_id
          )
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.provider_id = messages.provider_id
          )
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.status = 'pending'
          )
        )
      )
    )
  );

-- ============================================================
-- UPDATE (offer_status) — RPC-only from here on
-- ============================================================
-- 0028 granted column-level UPDATE(offer_status) + a matching RLS policy
-- for plain client `.update()` calls. Both are superseded by
-- respond_to_chat_offer() below (SECURITY DEFINER, bypasses RLS/grants
-- entirely) — same "RPC-only writes" pattern already used for job_posts
-- (0026), conversations (0029), push_tokens (0037).
revoke update on public.messages from authenticated;
drop policy if exists "Participant can respond to a pending offer they did not send" on public.messages;

create or replace function public.respond_to_chat_offer(p_message_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.messages%rowtype;
  v_match_count int;
  v_target_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_response not in ('accepted', 'declined') then
    raise exception 'Invalid response: %', p_response;
  end if;

  select * into v_msg from public.messages where id = p_message_id for update;
  if v_msg.id is null then
    raise exception 'Message not found';
  end if;
  if v_msg.type <> 'offer' then
    raise exception 'Message is not a price offer';
  end if;
  if v_msg.offer_status <> 'pending' then
    raise exception 'Offer has already been responded to';
  end if;
  -- Only the job owner Customer may accept/decline (task requirement).
  if auth.uid() <> v_msg.customer_id then
    raise exception 'Only the customer can respond to a price offer';
  end if;
  -- Defense in depth — the INSERT policy above already guarantees this
  -- for every NEW offer, but re-checking here costs nothing and protects
  -- any offer row that predates this migration.
  if v_msg.sender_id <> v_msg.provider_id then
    raise exception 'Only a Provider-sent offer can be responded to';
  end if;

  update public.messages set offer_status = p_response where id = p_message_id;

  if p_response = 'accepted' and v_msg.amount is not null and v_msg.amount > 0 then
    -- Find the unique still-open job connecting this Customer/Provider
    -- pair (a message has no job_id — see this migration's header
    -- comment). `jp.status = 'pending'` is also the "once a Provider is
    -- selected/job becomes active, lock price mutation" rule: the
    -- instant select_provider() runs, status flips to 'active' and no
    -- job for this pair matches here any more, atomically closing the
    -- window.
    select count(*), min(jr.job_id) into v_match_count, v_target_job_id
    from public.job_responses jr
    join public.job_posts jp on jp.id = jr.job_id
    where jp.customer_id = v_msg.customer_id
      and jr.provider_id = v_msg.provider_id
      and jp.status = 'pending';

    -- Exactly one match required — zero (no open job_responses row at
    -- all, e.g. this Provider never formally expressed interest yet) or
    -- more than one (this Provider has open responses on several of the
    -- Customer's jobs — genuinely ambiguous which one the chat offer is
    -- about) both skip the sync rather than guessing. The offer_status
    -- change above still succeeds either way.
    if v_match_count = 1 then
      update public.job_responses
      set offered_price = v_msg.amount
      where job_id = v_target_job_id and provider_id = v_msg.provider_id;
    end if;
  end if;
end;
$$;

comment on function public.respond_to_chat_offer(uuid, text) is
  'Customer accepts/declines a Provider-sent chat price offer. On acceptance, if exactly one still-open (pending) job connects this Customer/Provider pair, that job''s job_responses.offered_price is updated to the accepted amount atomically — keeping job_responses the single canonical current price. Declining, or an ambiguous/no match, never touches job_responses.';

grant execute on function public.respond_to_chat_offer(uuid, text) to authenticated;
