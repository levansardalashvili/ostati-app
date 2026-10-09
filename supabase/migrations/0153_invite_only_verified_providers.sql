-- A private job ("მიწერა" / rehire, 0094/0152) sent to an unverified Provider
-- dead-ended: they cannot send a price offer (0084). The app no longer offers
-- "მიწერა" for unverified Providers; create_job() now enforces the same rule.
-- Rebuilt from the live definition — only the extra check was added.

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
    p_time_slot is null or (case
      when p_time_slot = 'flexible' then false
      when p_time_slot !~ '^(0[0-9]|1[0-9]|2[0-3])-(0[1-9]|1[0-9]|2[0-4])$' then true
      else split_part(p_time_slot, '-', 1)::int >= split_part(p_time_slot, '-', 2)::int
    end)
  ) then
    raise exception 'A valid time_slot is required when a preferred_date is set';
  end if;
  if p_preferred_date is null or p_time_slot is null then
    raise exception 'DATE_TIME_REQUIRED: preferred date and time are required';
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
  if p_invited_provider_id is not null and not exists (
    select 1 from public.provider_profiles pp
    where pp.id = p_invited_provider_id and pp.verification_status = 'verified'
  ) then
    raise exception 'PROVIDER_NOT_VERIFIED: a private job can only be sent to a verified provider';
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
