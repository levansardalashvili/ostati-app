-- 0049_job_scoped_price_offers.sql
-- Second hardening pass, item 5. `messages` has never had a job_id
-- column — a "conversation" is only ever (customer_id, provider_id),
-- #57's deliberate simplification. 0042's respond_to_chat_offer() had
-- to INFER which job a chat price offer was about by looking for a
-- unique still-open job_responses row connecting the pair — and
-- silently skipped the price sync whenever that inference was
-- ambiguous (a Provider with open responses on 2+ of the same
-- Customer's jobs). This migration makes every future offer message
-- explicitly carry its own job_id, removing the inference entirely.

alter table public.messages add column if not exists job_id uuid references public.job_posts(id) on delete set null;

-- NOT VALID: enforced for every new/updated row going forward, but does
-- not require (or fail on) a full-table scan against existing
-- pre-migration offer rows, which have job_id = null by definition
-- (the column didn't exist when they were inserted) — those legacy
-- offers remain valid rows; respond_to_chat_offer() below handles a
-- null job_id explicitly (accepts, but cannot sync a canonical price —
-- documented backward-compat behavior, not an error).
alter table public.messages
  add constraint messages_offer_requires_job_id
  check (type <> 'offer' or job_id is not null)
  not valid;

create index if not exists idx_messages_job_id on public.messages(job_id);

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
  -- Only the job owner Customer may accept/decline.
  if auth.uid() <> v_msg.customer_id then
    raise exception 'Only the customer can respond to a price offer';
  end if;
  -- Only a genuinely Provider-sent offer is eligible (defense in depth —
  -- messages' INSERT policy, 0042/0046, already guarantees this for
  -- every new row; re-checked here for any pre-existing row too).
  if v_msg.sender_id <> v_msg.provider_id then
    raise exception 'Only a Provider-sent offer can be responded to';
  end if;

  update public.messages set offer_status = p_response where id = p_message_id;

  if p_response <> 'accepted' then
    return;
  end if;

  -- Legacy (pre-0049) offer, created before job_id existed — the
  -- response is recorded, but there is nothing to sync a canonical
  -- price to. Documented backward-compat gap, not an error.
  if v_msg.job_id is null then
    return;
  end if;

  select * into v_job from public.job_posts where id = v_msg.job_id for update;
  if v_job.id is null then
    raise exception 'The job this offer refers to no longer exists';
  end if;
  -- Message's own customer must match the job's actual customer — the
  -- message's job_id is never trusted at face value.
  if v_job.customer_id <> v_msg.customer_id then
    raise exception 'This offer''s job does not belong to this customer';
  end if;
  -- Once a Provider is selected (or the job left pending for any other
  -- reason), price mutation is locked — matches select_provider()'s own
  -- "pending -> active" gate exactly.
  if v_job.status <> 'pending' then
    raise exception 'Price can no longer be changed once a provider is selected';
  end if;

  select * into v_response_row from public.job_responses
    where job_id = v_msg.job_id and provider_id = v_msg.provider_id;
  if v_response_row.id is null then
    raise exception 'This provider has no response on file for this job';
  end if;

  if v_msg.amount is null or v_msg.amount <= 0 then
    raise exception 'Offer has no valid amount';
  end if;

  update public.job_responses
  set offered_price = v_msg.amount
  where job_id = v_msg.job_id and provider_id = v_msg.provider_id;
end;
$$;

comment on function public.respond_to_chat_offer(uuid, text) is
  'Customer accepts/declines a Provider-sent, job-scoped chat price offer. Acceptance re-validates: sender is the named provider_id, caller is the job''s real customer_id, the job is still pending, a job_responses row exists for that (job_id, provider_id), and amount > 0 — then atomically syncs job_responses.offered_price. A legacy pre-job-scoping offer (job_id null) is still accepted/declined but cannot sync a price. No job is ever inferred from the (customer_id, provider_id) pair.';

revoke execute on function public.respond_to_chat_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_chat_offer(uuid, text) to authenticated;
