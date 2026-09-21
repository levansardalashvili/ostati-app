-- Robustness limits: pending-job expiry + per-customer open-job cap, dispute retry cap, chat-offer expiry.

-- ---------------------------------------------------------------------------------------------
-- 1) Pending jobs expire after 30 days. The open feed hides them immediately (no write needed);
--    the owner's rows are cancelled lazily by expire_my_stale_jobs() (called on the job list / create_job).
-- ---------------------------------------------------------------------------------------------
create or replace function public.expire_my_stale_jobs()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'admin',
         cancellation_reason = 'ვადა გაუვიდა (30 დღე)'
   where customer_id = auth.uid() and status = 'pending' and created_at < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.expire_my_stale_jobs() from public, anon;
grant execute on function public.expire_my_stale_jobs() to authenticated;

create or replace function public.get_open_provider_feed()
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;
  return query
  select jp.id, jp.customer_id, jp.customer_name, jp.category, jp.description,
    coalesce(jp.area_label, public.job_safe_area_label(jp.address)) as address,
    false as address_is_exact,
    jp.date, jp.status, jp.photos, jp.provider_id, jp.provider_name,
    jp.agreed_price, jp.dispute_reason, jp.cancellation_actor,
    jp.preferred_date, jp.time_slot, jp.created_at
  from public.job_posts jp
  where jp.status = 'pending'
    and jp.created_at > now() - interval '30 days'
    and (jp.invited_provider_id is null or jp.invited_provider_id = auth.uid())
    and not public.is_blocked_pair(jp.customer_id, auth.uid())
  order by jp.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2) At most 10 open (draft + pending) jobs per customer. Abandoned drafts (>1 day) and expired
--    pending jobs are cleaned first so they never count against the cap.
-- ---------------------------------------------------------------------------------------------
create or replace function public.create_job(
  p_category text, p_description text, p_address text, p_date text,
  p_preferred_date date default null, p_time_slot text default null,
  p_invited_provider_id uuid default null)
returns public.job_posts language plpgsql security definer set search_path = '' as $$
declare
  v_customer_name text;
  v_area_label text;
  v_description text;
  v_open integer;
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can create a job';
  end if;
  if p_address is null or btrim(p_address) = '' then raise exception 'An exact address is required'; end if;

  v_description := btrim(coalesce(p_description, ''));
  if length(v_description) < 20 then raise exception 'Description must be at least 20 characters'; end if;
  if length(v_description) > 500 then raise exception 'Description must be at most 500 characters'; end if;

  if p_category is null or not exists (
    select 1 from public.categories c where c.id = p_category and c.is_active = true
  ) then
    raise exception 'Invalid or inactive category: %', p_category;
  end if;

  if p_preferred_date is not null and (
    p_time_slot is null or p_time_slot not in ('09-12', '12-15', '15-18', '18-21', 'flexible')
  ) then
    raise exception 'A valid time_slot is required when a preferred_date is set';
  end if;
  if p_preferred_date is null and p_time_slot is not null then
    raise exception 'time_slot requires a preferred_date';
  end if;

  if p_invited_provider_id is not null and not exists (
    select 1 from public.users u join public.provider_profiles pp on pp.id = u.id
    where u.id = p_invited_provider_id and u.role = 'provider'
  ) then
    raise exception 'Invited provider not found';
  end if;

  delete from public.job_posts
   where customer_id = auth.uid() and status = 'draft' and created_at < now() - interval '1 day';
  perform public.expire_my_stale_jobs();

  select count(*) into v_open from public.job_posts
   where customer_id = auth.uid() and status in ('draft', 'pending');
  if v_open >= 10 then
    raise exception 'TOO_MANY_OPEN_JOBS: at most 10 open jobs at a time';
  end if;

  select btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
    into v_customer_name from public.users u where u.id = auth.uid();
  v_area_label := public.job_safe_area_label(p_address);

  insert into public.job_posts (
    customer_id, customer_name, category, description, address, area_label,
    date, status, photos, preferred_date, time_slot, invited_provider_id
  ) values (
    auth.uid(), coalesce(v_customer_name, ''), p_category, v_description, btrim(p_address), v_area_label,
    coalesce(p_date, ''), 'draft', '{}', p_preferred_date, p_time_slot, p_invited_provider_id
  ) returning * into v_job;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3) A customer can raise a dispute on the same job at most twice (admin can reopen it once).
-- ---------------------------------------------------------------------------------------------
alter table public.job_posts add column if not exists dispute_count integer not null default 0;

create or replace function public.customer_report_problem(p_job_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can report a problem';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.customer_id <> auth.uid() then raise exception 'Only the job owner can report a problem'; end if;
  if v_job.status <> 'awaiting_customer_confirmation' then
    raise exception 'Job is not awaiting confirmation (status=%)', v_job.status;
  end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required'; end if;
  if v_job.dispute_count >= 2 then
    raise exception 'DISPUTE_LIMIT_REACHED: this job was already disputed twice';
  end if;

  update public.job_posts
     set status = 'disputed', dispute_reason = p_reason, dispute_count = dispute_count + 1
   where id = p_job_id;

  if v_job.provider_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (
      v_job.provider_id,
      'მომხმარებელმა პრობლემა აღნიშნა',
      public.job_category_label(v_job.category),
      '⚠️',
      '#DC2626',
      jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
      'job_status_change'
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4) A chat price offer can be accepted for 7 days only.
-- ---------------------------------------------------------------------------------------------
create or replace function public.respond_to_chat_offer(p_message_id uuid, p_response text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_msg public.messages%rowtype;
  v_job public.job_posts%rowtype;
  v_response_row public.job_responses%rowtype;
  v_provider_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_response not in ('accepted', 'declined') then
    raise exception 'Invalid response: %', p_response;
  end if;

  select * into v_msg from public.messages where id = p_message_id for update;
  if v_msg.id is null then raise exception 'Message not found'; end if;
  if v_msg.type <> 'offer' then raise exception 'Message is not a price offer'; end if;
  if v_msg.offer_status <> 'pending' then raise exception 'Offer has already been responded to'; end if;
  if auth.uid() <> v_msg.customer_id then
    raise exception 'Only the customer can respond to a price offer';
  end if;
  if v_msg.sender_id <> v_msg.provider_id then
    raise exception 'Only a Provider-sent offer can be responded to';
  end if;
  if p_response = 'accepted' and v_msg.created_at < now() - interval '7 days' then
    raise exception 'OFFER_EXPIRED: this offer is older than 7 days';
  end if;

  update public.messages set offer_status = p_response where id = p_message_id;

  if p_response <> 'accepted' then return; end if;
  if v_msg.job_id is null then return; end if;

  select * into v_job from public.job_posts where id = v_msg.job_id for update;
  if v_job.id is null then raise exception 'The job this offer refers to no longer exists'; end if;
  if v_job.customer_id <> v_msg.customer_id then
    raise exception 'This offer''s job does not belong to this customer';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Price can no longer be changed once a provider is selected';
  end if;
  if not public.is_valid_job_price(v_msg.amount) then raise exception 'Offer has no valid amount'; end if;

  select * into v_response_row from public.job_responses
    where job_id = v_msg.job_id and provider_id = v_msg.provider_id
    for update;

  if v_response_row.id is null then
    select btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
      into v_provider_name from public.users u where u.id = v_msg.provider_id;
    insert into public.job_responses (job_id, provider_id, provider_name, offered_price)
    values (v_msg.job_id, v_msg.provider_id, coalesce(v_provider_name, ''), v_msg.amount)
    returning * into v_response_row;
  else
    update public.job_responses set offered_price = v_msg.amount
    where job_id = v_msg.job_id and provider_id = v_msg.provider_id
    returning * into v_response_row;
  end if;

  perform public.assign_job_provider(v_msg.job_id, v_msg.provider_id, v_response_row.provider_name, v_msg.amount, v_job.category);
end;
$$;
