-- Real UX bug found via E2E testing: Provider-facing job cards showed the
-- generic fallback "ზუსტი რაიონი მიუწვდომელია" (district unavailable) far
-- more often than necessary. `area_label` (shown to a browsing Provider in
-- place of the exact address, #47) is derived purely by parsing the
-- free-text `address` string (job_safe_area_label()) and only falls back to
-- that generic string when nothing safe can be extracted. Since #109 added
-- a separate, STRUCTURED `job_posts.district` column (chosen by the
-- customer from the same fixed region/district list a Provider's own
-- `areas` uses) it is always a reliable, ready-made coarse label when
-- present — it was only ever being used for area-matching (notifications/
-- "my specialty" feed filter), never shown to the Provider as the label
-- itself. Fix: prefer `district` first, then the precomputed `area_label`,
-- then a live `job_safe_area_label(address)` computation — read-time only,
-- no change to any write path/backfill needed (older jobs without a
-- district keep the old address-parsing behavior unchanged).
create or replace function public.get_open_provider_feed(p_only_mine boolean default false)
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
    coalesce(jp.district, jp.area_label, public.job_safe_area_label(jp.address)) as address,
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

create or replace function public.get_feed_job_by_id(p_job_id uuid)
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_is_provider boolean;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  v_is_provider := exists (select 1 from public.users u where u.id = v_uid and u.role = 'provider');
  return query
  select jp.id, jp.customer_id, jp.customer_name, jp.category, jp.description,
    case when v_uid = jp.customer_id or v_uid = jp.provider_id then jp.address
         else coalesce(jp.district, jp.area_label, public.job_safe_area_label(jp.address)) end as address,
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
$function$;
