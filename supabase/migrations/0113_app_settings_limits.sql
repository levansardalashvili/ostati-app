-- 0113: ლიმიტები/ვადები ცხრილიდან (app_settings), ადმინ-პანელიდან იცვლება. ფუნქციები ცოცხალი განმარტებებიდანაა
-- გენერირებული — შეიცვალა მხოლოდ ჰარდქოდილი რიცხვები (ნაგულისხმევი მნიშვნელობები იგივეა, ქცევა არ იცვლება).
create table if not exists public.app_settings (
  key text primary key,
  value integer not null check (value > 0),
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
drop policy if exists "Admin can read app settings" on public.app_settings;
create policy "Admin can read app settings" on public.app_settings for select to authenticated using (public.is_admin());

insert into public.app_settings (key, value) values
  ('max_open_jobs', 10), ('job_expiry_days', 30), ('dispute_limit', 2),
  ('offer_expiry_days', 7), ('confirmation_grace_hours', 72), ('stale_interest_hours', 48)
on conflict (key) do nothing;

create or replace function public.app_setting(p_key text, p_default integer)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select s.value from public.app_settings s where s.key = p_key), p_default);
$$;
revoke execute on function public.app_setting(text, integer) from public, anon, authenticated;

create or replace function public.admin_set_app_setting(p_key text, p_value integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_min integer; v_max integer;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  select r.mn, r.mx into v_min, v_max from (values
    ('max_open_jobs', 1, 50), ('job_expiry_days', 7, 90), ('dispute_limit', 1, 10),
    ('offer_expiry_days', 1, 30), ('confirmation_grace_hours', 12, 336), ('stale_interest_hours', 12, 336)
  ) as r(k, mn, mx) where r.k = p_key;
  if v_min is null then raise exception 'Unknown setting'; end if;
  if p_value < v_min or p_value > v_max then raise exception 'Value out of range (% - %)', v_min, v_max; end if;
  update public.app_settings set value = p_value, updated_at = now() where key = p_key;
end;
$$;
revoke execute on function public.admin_set_app_setting(text, integer) from public, anon;
grant execute on function public.admin_set_app_setting(text, integer) to authenticated;

CREATE OR REPLACE FUNCTION public.check_stale_job_interest(p_job_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner may check its interest status';
  end if;

  if v_job.status <> 'pending' then
    return false;
  end if;
  if v_job.stale_interest_reminder_sent_at is not null then
    return false;
  end if;
  if v_job.created_at > now() - make_interval(hours => public.app_setting('stale_interest_hours', 48)) then
    return false;
  end if;
  if exists (select 1 from public.job_responses where job_id = p_job_id) then
    return false;
  end if;

  update public.job_posts set stale_interest_reminder_sent_at = now() where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.customer_id,
    'ჯერ არავინ დაინტერესებულა',
    public.job_category_label(v_job.category),
    '🕓',
    '#64748B',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id),
    'job_status_change'
  );

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_job(p_category text, p_description text, p_address text, p_date text, p_preferred_date date DEFAULT NULL::date, p_time_slot text DEFAULT NULL::text, p_invited_provider_id uuid DEFAULT NULL::uuid)
 RETURNS job_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_open >= public.app_setting('max_open_jobs', 10) then
    raise exception 'TOO_MANY_OPEN_JOBS: open job limit reached';
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
$function$;

CREATE OR REPLACE FUNCTION public.customer_report_problem(p_job_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can report a problem';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.customer_id is distinct from auth.uid() then raise exception 'Only the job owner can report a problem'; end if;
  if v_job.status <> 'awaiting_customer_confirmation' then
    raise exception 'Job is not awaiting confirmation (status=%)', v_job.status;
  end if;
  if p_reason is null or btrim(p_reason) = '' then raise exception 'A reason is required'; end if;
  if v_job.dispute_count >= public.app_setting('dispute_limit', 2) then
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
$function$;

CREATE OR REPLACE FUNCTION public.expire_my_stale_jobs()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_n integer;
  v_expired_ids uuid[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  -- one reminder per job (the window is the last 3 days before expiry)
  with due as (
    update public.job_posts
       set expiry_reminder_sent_at = now()
     where customer_id = auth.uid() and status = 'pending'
       and expiry_reminder_sent_at is null
       and created_at < now() - make_interval(days => public.app_setting('job_expiry_days', 30) - 3)
       and created_at >= now() - make_interval(days => public.app_setting('job_expiry_days', 30))
    returning id, category
  )
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select auth.uid(), 'განცხადების ვადა იწურება', public.job_category_label(due.category) || ' — განაახლეთ, თუ ჯერ კიდევ გჭირდებათ', '⏳', '#D97706',
         jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', due.id), 'job_status_change'
    from due;

  select array_agg(id) into v_expired_ids
    from public.job_posts
   where customer_id = auth.uid() and status = 'pending' and created_at < now() - make_interval(days => public.app_setting('job_expiry_days', 30));

  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'admin',
         cancellation_reason = 'ვადა გაუვიდა (30 დღე)'
   where id = any(v_expired_ids);

  v_n := coalesce(array_length(v_expired_ids, 1), 0);

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select jr.provider_id, 'განცხადების ვადა გავიდა', public.job_category_label(jp.category), 'ℹ️', '#64748B', null, 'job_status_change'
    from public.job_responses jr
    join public.job_posts jp on jp.id = jr.job_id
   where jr.job_id = any(v_expired_ids);

  return v_n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_stale_job_confirmation(p_job_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  -- Grace period before silence counts as implicit acceptance. Named
  -- here (not scattered as a magic literal) so it's the one place to
  -- retune later.
  v_grace interval := make_interval(hours => public.app_setting('confirmation_grace_hours', 72));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if auth.uid() <> v_job.customer_id and auth.uid() <> v_job.provider_id then
    raise exception 'Only a participant of this job may check its confirmation status';
  end if;

  -- Not an error — an opportunistic no-op is the expected outcome most of
  -- the time this is called (wrong status, or grace period not yet up).
  if v_job.status <> 'awaiting_customer_confirmation' then
    return false;
  end if;
  if v_job.updated_at > now() - v_grace then
    return false;
  end if;

  update public.job_posts set status = 'confirmed_awaiting_rating' where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values
    (v_job.customer_id, 'სამუშაო ავტომატურად დადასტურდა', '72 საათის განმავლობაში პასუხი არ მიგვიღია — გთხოვთ, შეაფასოთ ოსტატი.', '⏱️', '#2563EB', jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id), 'job_status_change'),
    (v_job.provider_id, 'სამუშაო ავტომატურად დადასტურდა', 'მომხმარებელმა 72 საათში არ უპასუხა — სამუშაო ავტომატურად ჩაითვალა დადასტურებულად.', '⏱️', '#2563EB', jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'), 'job_status_change');

  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_open_provider_feed(p_only_mine boolean DEFAULT false)
 RETURNS TABLE(id uuid, customer_id uuid, customer_name text, category text, description text, address text, address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text, agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_cats text[];
  v_areas text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;

  if p_only_mine then
    if not exists (
      select 1 from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
       where pp.id = auth.uid() and s->>'id' like 'custom:%'
    ) then
      select array_agg(distinct public.specialty_to_category(s->>'id')) into v_cats
        from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
       where pp.id = auth.uid();
    end if;
    select pp.areas into v_areas from public.provider_profiles pp where pp.id = auth.uid();
    if coalesce(array_length(v_areas, 1), 0) = 0 then v_areas := null; end if;
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
    and jp.created_at > now() - make_interval(days => public.app_setting('job_expiry_days', 30))
    and (jp.invited_provider_id is null or jp.invited_provider_id = auth.uid())
    and not (auth.uid() = any(jp.excluded_provider_ids))
    and not public.is_blocked_pair(jp.customer_id, auth.uid())
    and (v_cats is null or jp.category = any(v_cats) or jp.invited_provider_id = auth.uid())
    and (v_areas is null or jp.district is null or jp.district = any(v_areas) or jp.invited_provider_id = auth.uid())
  order by jp.created_at desc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.renew_job(p_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null or v_job.customer_id is distinct from auth.uid() then raise exception 'Job not found'; end if;
  if v_job.status <> 'pending' then raise exception 'Only a pending job can be renewed'; end if;
  if v_job.created_at > now() - make_interval(days => public.app_setting('job_expiry_days', 30) - 3) then
    raise exception 'RENEW_TOO_EARLY: a job can be renewed only in its last 3 days';
  end if;

  update public.job_posts
     set created_at = now(), expiry_reminder_sent_at = null, stale_interest_reminder_sent_at = null
   where id = p_job_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reopen_job(p_job_id uuid)
 RETURNS job_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  v_open integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can reopen a job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.customer_id is distinct from auth.uid() then raise exception 'Only the job owner can reopen it'; end if;
  if v_job.status <> 'cancelled' or v_job.cancellation_actor is distinct from 'provider' or v_job.provider_id is null then
    raise exception 'Only a job cancelled by its provider can be reopened';
  end if;
  if v_job.cancelled_at is null or v_job.cancelled_at < now() - make_interval(days => public.app_setting('job_expiry_days', 30)) then
    raise exception 'This job can no longer be reopened';
  end if;

  select count(*) into v_open from public.job_posts
   where customer_id = auth.uid() and status in ('draft', 'pending');
  if v_open >= public.app_setting('max_open_jobs', 10) then
    raise exception 'TOO_MANY_OPEN_JOBS: open job limit reached';
  end if;

  update public.job_posts
     set status = 'pending',
         provider_id = null, provider_name = null, agreed_price = null,
         cancelled_at = null, cancelled_by = null, cancellation_reason = null,
         cancellation_reason_code = null, cancellation_actor = null,
         invited_provider_id = null,
         excluded_provider_ids = array_append(excluded_provider_ids, v_job.provider_id),
         stale_interest_reminder_sent_at = null,
         created_at = now()
   where id = p_job_id
   returning * into v_job;

  -- the provider who cancelled is out of this job (his old response must not be selectable again)
  delete from public.job_responses
   where job_id = p_job_id and provider_id = any(v_job.excluded_provider_ids);

  -- tell the remaining interested providers the job is open again
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select r.provider_id, 'სამუშაო ისევ ღიაა', public.job_category_label(v_job.category), '🔄', '#2563EB',
         jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'browse'),
         'job_status_change'
    from public.job_responses r
   where r.job_id = p_job_id;

  return v_job;
end;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_chat_offer(p_message_id uuid, p_response text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if p_response = 'accepted' and v_msg.created_at < now() - make_interval(days => public.app_setting('offer_expiry_days', 7)) then
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
$function$;

CREATE OR REPLACE FUNCTION public.run_time_rules()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record;
begin
  for r in
    select id, customer_id from public.job_posts
     where status = 'awaiting_customer_confirmation' and customer_id is not null
       and updated_at < now() - make_interval(hours => public.app_setting('confirmation_grace_hours', 72))
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', r.customer_id, 'role', 'authenticated')::text, true);
      perform public.expire_stale_job_confirmation(r.id);
    exception when others then null;
    end;
  end loop;

  for r in
    select distinct customer_id from public.job_posts
     where status = 'pending' and customer_id is not null and created_at < now() - make_interval(days => public.app_setting('job_expiry_days', 30) - 3)
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', r.customer_id, 'role', 'authenticated')::text, true);
      perform public.expire_my_stale_jobs();
    exception when others then null;
    end;
  end loop;

  for r in
    select jp.id, jp.customer_id from public.job_posts jp
     where jp.status = 'pending' and jp.customer_id is not null
       and jp.created_at < now() - make_interval(hours => public.app_setting('stale_interest_hours', 48))
       and jp.stale_interest_reminder_sent_at is null
       and not exists (select 1 from public.job_responses jr where jr.job_id = jp.id)
  loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', r.customer_id, 'role', 'authenticated')::text, true);
      perform public.check_stale_job_interest(r.id);
    exception when others then null;
    end;
  end loop;

  perform set_config('request.jwt.claims', '', true);
end;
$function$;

