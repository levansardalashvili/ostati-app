-- 0066_express_interest_lock_and_price_rule.sql
-- Focused backend hardening pass, items 1 and 2 (part 2).
--
-- ITEM 1 — CONFIRMED race condition. express_interest() (0064) read
-- job_posts WITHOUT locking the row before checking status='pending':
--   1. Provider B's express_interest() reads status='pending'.
--   2. Concurrently, the Customer's select_provider() (which DOES lock
--      the row, 0045) assigns Provider A and commits, status -> 'active'.
--   3. Provider B's express_interest(), still holding its stale read,
--      inserts a job_responses row anyway.
-- This is not harmless: job_responses existing for (customer_id,
-- provider_id) is also what authorizes Provider -> Customer chat/media
-- (0046's `can_access_private_chat_media`/messages INSERT policy — "this
-- provider has responded to one of this customer's jobs"), and the
-- INSERT fires a real "new interest" Customer notification
-- (0021's trigger). A stale-read interest after the job already went
-- active would grant Provider B a chat relationship they should never
-- have gotten, and a notification about a job that already isn't open.
--
-- Fix: `select ... for update` on the job_posts row, exactly like
-- select_provider() already does, BEFORE the status check. Same single
-- resource (one job_posts row) both functions lock — no lock-ordering
-- deadlock is possible (a deadlock needs two transactions each holding a
-- lock the other one is waiting for, on two or more DIFFERENT resources
-- acquired in reverse order; here there is only ever one contended
-- resource, so the second transaction to arrive simply blocks until the
-- first commits or rolls back, then proceeds against the now-current
-- row). Required outcomes, both achieved by this ordering:
--   - express_interest locks first -> validates pending -> inserts ->
--     commits -> select_provider proceeds afterward against a job that
--     now has this response (unaffected, this is the normal case).
--   - select_provider locks first -> job goes active -> commits ->
--     express_interest's lock is granted -> it re-reads the NOW-current
--     row (a `for update` read, once granted, always sees the latest
--     committed data, not a stale snapshot) -> status is no longer
--     'pending' -> raises -> no job_responses row, no notification, no
--     new chat relationship. Exactly the required behavior.
--
-- ITEM 2 — every price check here (offered_price, agreed_price, amount)
-- now uses the single shared public.is_valid_job_price() rule (0065)
-- instead of its own ad hoc `is null or <= 0` check.

create or replace function public.express_interest(p_job_id uuid, p_offered_price numeric)
returns public.job_responses
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_profile public.provider_profiles%rowtype;
  v_provider_name text;
  v_initials text;
  v_response public.job_responses%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can express interest';
  end if;

  if not public.is_valid_job_price(p_offered_price) then
    raise exception 'A valid, positive offered price is required';
  end if;

  -- NEW (item 1) — locks the row so a concurrent select_provider() on
  -- the same job cannot race this check.
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for interest (status=%)', v_job.status;
  end if;
  if v_job.customer_id = auth.uid() then
    raise exception 'A customer cannot express interest in their own job';
  end if;

  select * into v_profile from public.provider_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'A provider profile is required before expressing interest';
  end if;

  v_provider_name := nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), '');
  v_provider_name := coalesce(v_provider_name, 'ოსტატი');
  v_initials := upper(
    coalesce(nullif(left(btrim(coalesce(v_profile.first_name, '')), 1), ''), '')
    || coalesce(nullif(left(btrim(coalesce(v_profile.last_name, '')), 1), ''), '')
  );
  if v_initials = '' then
    v_initials := 'O';
  end if;

  insert into public.job_responses (job_id, provider_id, provider_name, provider_initials, provider_color, offered_price)
  values (p_job_id, auth.uid(), v_provider_name, v_initials, '#2563EB', p_offered_price)
  returning * into v_response;

  return v_response;
end;
$$;

comment on function public.express_interest(uuid, numeric) is
  'The only way to create a job_responses row. Locks the target job_posts row (for update) BEFORE validating status=pending, so a concurrent select_provider() on the same job cannot race this into inserting a response after the job already went active (0066) — whichever transaction acquires the lock first wins; the other sees the up-to-date status once its own lock is granted. provider_id/provider_name/provider_initials/provider_color are always derived server-side, never client-supplied. offered_price is validated by is_valid_job_price() (0065).';

revoke execute on function public.express_interest(uuid, numeric) from public, anon;
grant execute on function public.express_interest(uuid, numeric) to authenticated;

-- ============================================================
-- select_provider() — price check now uses the shared rule. Locking
-- behavior (`for update` on job_posts) is unchanged; it was already
-- correct and is the other half of the race fix above.
-- ============================================================
create or replace function public.select_provider(p_job_id uuid, p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_response public.job_responses%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can select a provider';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can select a provider';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for provider selection (status=%)', v_job.status;
  end if;

  if p_provider_id = v_job.customer_id then
    raise exception 'A job cannot be assigned to its own customer';
  end if;
  if not exists (select 1 from public.users u where u.id = p_provider_id and u.role = 'provider') then
    raise exception 'Selected id does not belong to a Provider account';
  end if;

  select * into v_response from public.job_responses
    where job_id = p_job_id and provider_id = p_provider_id;
  if v_response.id is null then
    raise exception 'Selected provider has not responded to this job';
  end if;
  if not public.is_valid_job_price(v_response.offered_price) then
    raise exception 'Selected provider response has no valid price';
  end if;

  update public.job_posts
  set
    provider_id = p_provider_id,
    provider_name = v_response.provider_name,
    agreed_price = v_response.offered_price,
    status = 'active'
  where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    p_provider_id,
    'შენ აგირჩიეს სამუშაოსთვის',
    public.job_category_label(v_job.category),
    '🏆',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_selected'
  );
end;
$$;

comment on function public.select_provider(uuid, uuid) is
  'Customer selects a Provider: pending -> active, notifies the selected Provider (type=job_selected). Requires caller.role=customer, rejects self-selection, requires p_provider_id to belong to a real Provider account, and validates the selected response''s price with is_valid_job_price() (0065/0066) instead of a bare > 0 check.';

revoke execute on function public.select_provider(uuid, uuid) from public, anon;
grant execute on function public.select_provider(uuid, uuid) to authenticated;

-- ============================================================
-- respond_to_chat_offer() — price check now uses the shared rule.
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

  select * into v_response_row from public.job_responses
    where job_id = v_msg.job_id and provider_id = v_msg.provider_id;
  if v_response_row.id is null then
    raise exception 'This provider has no response on file for this job';
  end if;

  if not public.is_valid_job_price(v_msg.amount) then
    raise exception 'Offer has no valid amount';
  end if;

  update public.job_responses
  set offered_price = v_msg.amount
  where job_id = v_msg.job_id and provider_id = v_msg.provider_id;
end;
$$;

comment on function public.respond_to_chat_offer(uuid, text) is
  'Customer accepts/declines a Provider-sent, job-scoped chat price offer. Acceptance re-validates: sender is the named provider_id, caller is the job''s real customer_id, the job is still pending, a job_responses row exists for that (job_id, provider_id), and the amount passes is_valid_job_price() (0065/0066) — then atomically syncs job_responses.offered_price. A legacy pre-job-scoping offer (job_id null) is still accepted/declined but cannot sync a price.';

revoke execute on function public.respond_to_chat_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_chat_offer(uuid, text) to authenticated;

-- ============================================================
-- messages INSERT policy — the offer-amount branch now uses the shared
-- rule instead of `amount is not null and amount > 0`. Every other
-- condition (role checks, Customer<->Provider relationship rule,
-- job_id/job_responses/pending checks) is carried over unchanged from
-- 0056 — only the amount check changes.
-- ============================================================
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
        and exists (
          select 1 from public.job_responses jr
          where jr.job_id = messages.job_id
            and jr.provider_id = messages.provider_id
        )
      )
    )
  );

comment on policy "Participant can send messages as self" on public.messages is
  'Sender must be a named participant with the right role; Provider->Customer requires a real relationship (0046). A type=offer message additionally requires job_id set (referencing a real, still-pending job owned by this exact customer_id), the sending provider_id to have a job_responses row for that job, and amount to pass is_valid_job_price() (0065/0066) — rejected at INSERT.';
