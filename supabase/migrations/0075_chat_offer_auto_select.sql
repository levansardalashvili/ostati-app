-- Chat-accept now auto-selects the Provider — task: "when the Customer
-- accepts a price offer in chat, the Provider should be selected
-- automatically, no separate selection step needed".
--
-- Before this migration, accepting a chat offer (respond_to_chat_offer(),
-- 0049/0066) only synced job_responses.offered_price — actually assigning
-- the Provider to the job (job_posts.provider_id/agreed_price/status) still
-- required a *separate* trip to select_provider() from the Job Detail
-- screen. That's the redundant extra step this migration removes.
--
-- Shared helper `assign_job_provider()` factors out the state-transition +
-- notification that select_provider() already performed, so both callers
-- (select_provider() and respond_to_chat_offer()) share one implementation
-- instead of duplicating it — same pattern as job_category_label()/
-- specialty_to_category()/job_scheduled_start() (#96): an internal SQL
-- helper with no client EXECUTE grant, only ever invoked from inside
-- another SECURITY DEFINER function that has already done its own
-- authorization/validation. This helper trusts its inputs completely.
create or replace function public.assign_job_provider(
  p_job_id uuid,
  p_provider_id uuid,
  p_provider_name text,
  p_agreed_price numeric,
  p_category text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_posts
  set
    provider_id = p_provider_id,
    provider_name = p_provider_name,
    agreed_price = p_agreed_price,
    status = 'active'
  where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    p_provider_id,
    'შენ აგირჩიეს სამუშაოსთვის',
    public.job_category_label(p_category),
    '🏆',
    '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_selected'
  );
end;
$$;

revoke all on function public.assign_job_provider(uuid, uuid, text, numeric, text) from public, anon, authenticated;

-- select_provider() — unchanged validation/authorization, only the final
-- update+insert block is now delegated to the shared helper.
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

  perform public.assign_job_provider(p_job_id, p_provider_id, v_response.provider_name, v_response.offered_price, v_job.category);
end;
$$;

revoke all on function public.select_provider(uuid, uuid) from public, anon;
grant execute on function public.select_provider(uuid, uuid) to authenticated;

-- respond_to_chat_offer() — on acceptance, now also assigns the Provider
-- to the job (previously only synced job_responses.offered_price). All
-- the preconditions this needs (job still 'pending', job_responses row
-- exists, price valid) were already being checked here for the price-sync
-- — this just extends that same, already-validated path one step further.
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

  perform public.assign_job_provider(v_msg.job_id, v_msg.provider_id, v_response_row.provider_name, v_msg.amount, v_job.category);
end;
$$;

revoke all on function public.respond_to_chat_offer(uuid, text) from public, anon;
grant execute on function public.respond_to_chat_offer(uuid, text) to authenticated;
