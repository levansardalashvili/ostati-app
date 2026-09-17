-- 0077_cold_dm_provider_reply_fix.sql
-- Real functional bug: StartJobChatSheet.tsx's "cold DM" flow (Customer
-- messages a Provider directly from their public profile, no prior job
-- interest) creates a real job_posts row and lets the Customer send the
-- first message — but the Provider could never reply. `messages`' INSERT
-- policy (0067) only allows Provider -> Customer when a job_responses row
-- already exists (still pending) OR the Provider is already assigned —
-- neither is ever true for a job the Customer just created and messaged
-- this ONE Provider about directly; the Provider never browsed the Job
-- Feed to create a job_responses row. Every reply attempt was silently
-- rejected by RLS (surfaced client-side as the message staying stuck in
-- 'sending'/'failed').
--
-- The same gap blocked the Provider's price-offer entirely: sending an
-- offer required a job_responses row to ALREADY exist (0066), which is
-- circular here (job_responses.offered_price must be > 0, but no price
-- exists before the Provider's own first offer message proposes one), and
-- respond_to_chat_offer() (accept step) separately required the same row
-- to exist, raising 'This provider has no response on file for this job'.
--
-- Fix, in one consistent rule applied everywhere this relationship is
-- checked: a Provider may also act as a legitimate participant when the
-- Customer has ALREADY sent at least one message to them directly — that
-- is exactly as strong a proof of a real relationship as job_responses/
-- assignment (arguably stronger: the Customer explicitly reached out to
-- THIS Provider by name). The offer-specific job_responses requirement is
-- dropped entirely (redundant once the outer relationship check already
-- covers it) and respond_to_chat_offer() creates the missing job_responses
-- row itself, on acceptance, from the offer message's own already-
-- validated amount.

drop policy if exists "Participant can send messages as self" on public.messages;
create policy "Participant can send messages as self"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and (type <> 'offer' or auth.uid() = provider_id)
    and exists (select 1 from public.users cu where cu.id = customer_id and cu.role = 'customer')
    and exists (select 1 from public.users pu where pu.id = provider_id and pu.role = 'provider')
    and (
      auth.uid() = customer_id
      or (
        auth.uid() = provider_id
        and (
          -- (a) a still-pending response on file for one of this customer's jobs.
          exists (
            select 1 from public.job_responses jr
            join public.job_posts jp on jp.id = jr.job_id
            where jr.provider_id = messages.provider_id
              and jp.customer_id = messages.customer_id
              and jp.status = 'pending'
          )
          -- (b) currently assigned, any status.
          or exists (
            select 1 from public.job_posts jp
            where jp.customer_id = messages.customer_id
              and jp.provider_id = messages.provider_id
          )
          -- (c) NEW — the Customer already messaged this Provider directly
          -- (cold-DM flow) — a Provider must always be able to reply to
          -- someone who has genuinely reached out to them.
          or exists (
            select 1 from public.messages m2
            where m2.customer_id = messages.customer_id
              and m2.provider_id = messages.provider_id
              and m2.sender_id = messages.customer_id
          )
        )
      )
    )
    and (
      type <> 'offer'
      or (
        job_id is not null
        and public.is_valid_job_price(amount)
        and exists (
          select 1 from public.job_posts jp
          where jp.id = messages.job_id
            and jp.customer_id = messages.customer_id
            and jp.status = 'pending'
        )
        -- NEW — job_responses is no longer required to already exist: the
        -- outer relationship check above (job_responses OR assignment OR
        -- "customer already messaged me") already proves this Provider is
        -- a legitimate participant; requiring job_responses here too was
        -- circular for a Provider's very FIRST offer on a cold-DM job.
      )
    )
  );

comment on policy "Participant can send messages as self" on public.messages is
  'Sender must be a named participant with the right role. Provider->Customer requires a still-pending job_responses row, current assignment, or the Customer having already messaged this Provider directly (0077 — cold-DM reply fix). Customer->Provider is unrestricted (directory browsing). type=offer additionally requires job_id/amount/job-still-pending validation; job_responses pre-existence is no longer required (0077) since the outer relationship check already covers it.';

-- ============================================================
-- can_access_private_chat_media() — identical relationship-check change,
-- for chat image access (private-media storage).
-- ============================================================
create or replace function public.can_access_private_chat_media(
  p_customer_id uuid,
  p_provider_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  if not exists (select 1 from public.users cu where cu.id = p_customer_id and cu.role = 'customer') then
    return false;
  end if;
  if not exists (select 1 from public.users pu where pu.id = p_provider_id and pu.role = 'provider') then
    return false;
  end if;

  -- Customer side: unchanged — directory browsing is allowed.
  if v_uid = p_customer_id then
    return exists (
      select 1
      from public.provider_profiles pp
      where pp.id = p_provider_id
    );
  end if;

  -- Provider side: same relationship rule as the messages INSERT policy.
  if v_uid = p_provider_id then
    return (
      exists (
        select 1
        from public.job_responses jr
        join public.job_posts jp
          on jp.id = jr.job_id
        where jr.provider_id = p_provider_id
          and jp.customer_id = p_customer_id
          and jp.status = 'pending'
      )
      or exists (
        select 1
        from public.job_posts jp
        where jp.customer_id = p_customer_id
          and jp.provider_id = p_provider_id
      )
      -- NEW — the Customer already messaged this Provider directly.
      or exists (
        select 1
        from public.messages m2
        where m2.customer_id = p_customer_id
          and m2.provider_id = p_provider_id
          and m2.sender_id = p_customer_id
      )
    );
  end if;

  return false;
end;
$$;

-- ============================================================
-- respond_to_chat_offer() — accepting a Provider's FIRST offer on a
-- cold-DM job (no job_responses row yet) now creates that row instead of
-- raising 'This provider has no response on file for this job'. Uses the
-- offer message's own amount (already validated > 0 at INSERT time,
-- 0066/0077) and derives provider_name server-side from public.users —
-- never trusts a client-supplied value, matching this project's
-- established pattern (CLAUDE.md #53's create_job() precedent).
-- ============================================================
create or replace function public.respond_to_chat_offer(p_message_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.messages%rowtype;
  v_job public.job_posts%rowtype;
  v_response_row public.job_responses%rowtype;
  v_provider_name text;
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
  if auth.uid() <> v_msg.customer_id then
    raise exception 'Only the customer can respond to a price offer';
  end if;
  if v_msg.sender_id <> v_msg.provider_id then
    raise exception 'Only a Provider-sent offer can be responded to';
  end if;

  update public.messages set offer_status = p_response where id = p_message_id;

  if p_response <> 'accepted' then
    return;
  end if;

  if v_msg.job_id is null then
    return;
  end if;

  select * into v_job from public.job_posts where id = v_msg.job_id for update;
  if v_job.id is null then
    raise exception 'The job this offer refers to no longer exists';
  end if;
  if v_job.customer_id <> v_msg.customer_id then
    raise exception 'This offer''s job does not belong to this customer';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Price can no longer be changed once a provider is selected';
  end if;

  if not public.is_valid_job_price(v_msg.amount) then
    raise exception 'Offer has no valid amount';
  end if;

  select * into v_response_row from public.job_responses
    where job_id = v_msg.job_id and provider_id = v_msg.provider_id
    for update;

  if v_response_row.id is null then
    -- Cold-DM flow — no job_responses row yet. This offer message is
    -- itself the Provider's first real proposal (RLS-validated at INSERT
    -- time, 0077) — create the row now instead of rejecting acceptance.
    select btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
      into v_provider_name
      from public.users u
      where u.id = v_msg.provider_id;

    insert into public.job_responses (job_id, provider_id, provider_name, offered_price)
    values (v_msg.job_id, v_msg.provider_id, coalesce(v_provider_name, ''), v_msg.amount)
    returning * into v_response_row;
  else
    update public.job_responses
    set offered_price = v_msg.amount
    where job_id = v_msg.job_id and provider_id = v_msg.provider_id
    returning * into v_response_row;
  end if;

  perform public.assign_job_provider(v_msg.job_id, v_msg.provider_id, v_response_row.provider_name, v_msg.amount, v_job.category);
end;
$$;

revoke all on function public.respond_to_chat_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_chat_offer(uuid, text) to authenticated;
