-- "Reopen for the others": when the SELECTED provider cancels an active job, the customer can put the job
-- back to `pending` — the remaining interested providers (and their prices) stay, the provider who
-- cancelled is excluded from that job for good.

alter table public.job_posts
  add column if not exists excluded_provider_ids uuid[] not null default '{}';

create or replace function public.reopen_job(p_job_id uuid)
returns public.job_posts language plpgsql security definer set search_path = '' as $$
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
  if v_job.customer_id <> auth.uid() then raise exception 'Only the job owner can reopen it'; end if;
  if v_job.status <> 'cancelled' or v_job.cancellation_actor is distinct from 'provider' or v_job.provider_id is null then
    raise exception 'Only a job cancelled by its provider can be reopened';
  end if;
  if v_job.cancelled_at is null or v_job.cancelled_at < now() - interval '30 days' then
    raise exception 'This job can no longer be reopened';
  end if;

  select count(*) into v_open from public.job_posts
   where customer_id = auth.uid() and status in ('draft', 'pending');
  if v_open >= 10 then
    raise exception 'TOO_MANY_OPEN_JOBS: at most 10 open jobs at a time';
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
$$;

revoke execute on function public.reopen_job(uuid) from public, anon;
grant execute on function public.reopen_job(uuid) to authenticated;

-- The excluded provider can neither see nor express interest in the job again.
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
    and not (auth.uid() = any(jp.excluded_provider_ids))
    and not public.is_blocked_pair(jp.customer_id, auth.uid())
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
          and (jp.invited_provider_id is null or jp.invited_provider_id = v_uid)
          and not (v_uid = any(jp.excluded_provider_ids)))
    );
end;
$$;

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
  if auth.uid() = any(v_job.excluded_provider_ids) then
    raise exception 'Job not found';
  end if;
  if public.is_blocked_pair(v_job.customer_id, auth.uid()) then
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
