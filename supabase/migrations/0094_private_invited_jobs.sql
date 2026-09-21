-- A job created from a direct "message this provider" (StartJobChatSheet) is PRIVATE to that
-- provider: the sheet promises "visible only to this provider", but the job used to land in the
-- public open feed and notify every matching provider. `invited_provider_id` makes the promise true.

alter table public.job_posts
  add column if not exists invited_provider_id uuid references public.users(id);

-- create_job: new optional p_invited_provider_id (old 6-arg signature replaced).
drop function if exists public.create_job(text, text, text, text, date, text);

create or replace function public.create_job(
  p_category text, p_description text, p_address text, p_date text,
  p_preferred_date date default null, p_time_slot text default null,
  p_invited_provider_id uuid default null)
returns public.job_posts language plpgsql security definer set search_path = '' as $$
declare
  v_customer_name text;
  v_area_label text;
  v_description text;
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

revoke execute on function public.create_job(text, text, text, text, date, text, uuid) from public, anon;
grant execute on function public.create_job(text, text, text, text, date, text, uuid) to authenticated;

-- Feed: hide private jobs from everyone except the invited provider.
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
    and (jp.invited_provider_id is null or jp.invited_provider_id = auth.uid())
  order by jp.created_at desc;
end;
$$;

create or replace function public.get_feed_job_by_id(p_job_id uuid)
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_is_provider boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_is_provider := exists (select 1 from public.users u where u.id = v_uid and u.role = 'provider');
  return query
  select jp.id, jp.customer_id, jp.customer_name, jp.category, jp.description,
    case when v_uid = jp.customer_id or v_uid = jp.provider_id then jp.address
         else coalesce(jp.area_label, public.job_safe_area_label(jp.address)) end as address,
    (v_uid = jp.customer_id or v_uid = jp.provider_id) as address_is_exact,
    jp.date, jp.status, jp.photos, jp.provider_id, jp.provider_name,
    jp.agreed_price, jp.dispute_reason, jp.cancellation_actor,
    jp.preferred_date, jp.time_slot, jp.created_at
  from public.job_posts jp
  where jp.id = p_job_id
    and (
      v_uid = jp.customer_id
      or v_uid = jp.provider_id
      or (jp.status = 'pending' and v_is_provider
          and (jp.invited_provider_id is null or jp.invited_provider_id = v_uid))
    );
end;
$$;

-- Only the invited provider can express interest in a private job.
create or replace function public.express_interest(p_job_id uuid, p_offered_price numeric)
returns public.job_responses language plpgsql security definer set search_path = '' as $$
declare
  v_job public.job_posts%rowtype;
  v_profile public.provider_profiles%rowtype;
  v_provider_name text;
  v_initials text;
  v_response public.job_responses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can express interest';
  end if;
  if not public.is_valid_job_price(p_offered_price) then
    raise exception 'A valid, positive offered price is required';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is not open for interest (status=%)', v_job.status;
  end if;
  if v_job.customer_id = auth.uid() then
    raise exception 'A customer cannot express interest in their own job';
  end if;
  if v_job.invited_provider_id is not null and v_job.invited_provider_id <> auth.uid() then
    raise exception 'Job not found';
  end if;

  select * into v_profile from public.provider_profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'A provider profile is required before expressing interest';
  end if;
  if v_profile.verification_status <> 'verified' then
    raise exception 'PROVIDER_NOT_VERIFIED: complete verification before expressing interest in a job';
  end if;

  v_provider_name := nullif(btrim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, '')), '');
  v_provider_name := coalesce(v_provider_name, 'ოსტატი');
  v_initials := upper(
    coalesce(nullif(left(btrim(coalesce(v_profile.first_name, '')), 1), ''), '')
    || coalesce(nullif(left(btrim(coalesce(v_profile.last_name, '')), 1), ''), '')
  );
  if v_initials = '' then v_initials := 'O'; end if;

  insert into public.job_responses (job_id, provider_id, provider_name, provider_initials, provider_color, offered_price)
  values (p_job_id, auth.uid(), v_provider_name, v_initials, '#2563EB', p_offered_price)
  returning * into v_response;
  return v_response;
end;
$$;

-- No area-wide "new job" broadcast for private jobs (the chat message already notifies the invitee).
create or replace function public.handle_new_job_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status <> 'pending' or new.invited_provider_id is not null then
    return new;
  end if;
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select p.id, 'ახალი მოთხოვნა შენს არეალში', public.job_category_label(new.category), '🆕', '#2563EB',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', new.id, 'mode', 'browse'),
    'new_jobs_in_area'
  from public.provider_profiles p
  where p.is_available = true
    and exists (select 1 from jsonb_array_elements(p.specialty) s
                where public.specialty_to_category(s->>'id') = new.category)
    and exists (select 1 from unnest(p.areas) as area where new.address ilike '%' || area || '%');
  return new;
end;
$$;

-- Job photos: a pending private job's photos are visible only to the invited provider.
create or replace function public.can_access_private_job_photo(p_job_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.job_posts jp
    where jp.id = p_job_id
      and (
        jp.customer_id = auth.uid()
        or jp.provider_id = auth.uid()
        or (jp.status = 'pending'
            and (jp.invited_provider_id is null or jp.invited_provider_id = auth.uid())
            and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider'))
      )
  );
$$;
