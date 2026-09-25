-- 0103 — review-fix pass
-- (1) Account deletion: the app checks BEFORE it deletes any file, so a refused deletion (active jobs) cannot leave
--     the account without its photos. delete_my_account() runs the same check.
-- (2) A retained (anonymized) review loses its free text too — it may contain names / phone numbers.
-- (3) Feed filter: a provider with any custom ("სხვა") specialty sees every open job (no category to match against).
-- (4) Owner guards became null-safe (`is distinct from`): job_posts.customer_id can be null since 0102.

create or replace function public.can_delete_my_account()
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_role text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.users where id = auth.uid();
  if v_role is null then raise exception 'Account not found'; end if;
  if v_role = 'admin' then raise exception 'Admin accounts cannot be deleted from the app'; end if;
  if exists (
    select 1 from public.job_posts jp
    where (jp.customer_id = auth.uid() or jp.provider_id = auth.uid())
      and jp.status in ('active', 'awaiting_customer_confirmation', 'confirmed_awaiting_rating', 'disputed')
  ) then
    raise exception 'ACCOUNT_HAS_ACTIVE_JOBS: finish or cancel your active jobs before deleting the account';
  end if;
end;
$$;
revoke execute on function public.can_delete_my_account() from public, anon;
grant execute on function public.can_delete_my_account() to authenticated;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.can_delete_my_account();

  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'provider',
         cancellation_reason = 'ოსტატმა ანგარიში წაშალა'
   where invited_provider_id = auth.uid() and status in ('draft', 'pending');

  update public.job_posts set provider_name = 'წაშლილი ოსტატი' where provider_id = auth.uid();

  update public.reviews set photos = '[]'::jsonb, review_text = '' where customer_id = auth.uid();
  update public.job_posts
     set customer_id = null, customer_name = '', address = '', area_label = null, description = '—', photos = '{}'
   where customer_id = auth.uid() and status = 'completed';

  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.get_open_provider_feed(p_only_mine boolean default false)
returns table(id uuid, customer_id uuid, customer_name text, category text, description text, address text,
  address_is_exact boolean, date text, status text, photos text[], provider_id uuid, provider_name text,
  agreed_price numeric, dispute_reason text, cancellation_actor text, preferred_date date, time_slot text,
  created_at timestamp with time zone)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cats text[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;

  if p_only_mine and not exists (
    select 1 from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
     where pp.id = auth.uid() and s->>'id' like 'custom:%'
  ) then
    select array_agg(distinct public.specialty_to_category(s->>'id')) into v_cats
      from public.provider_profiles pp, jsonb_array_elements(pp.specialty) s
     where pp.id = auth.uid();
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
    and (v_cats is null or jp.category = any(v_cats) or jp.invited_provider_id = auth.uid())
  order by jp.created_at desc;
end;
$$;
revoke execute on function public.get_open_provider_feed(boolean) from public, anon;
grant execute on function public.get_open_provider_feed(boolean) to authenticated;

-- (4) null-safe owner guards (generated from the live definitions; only `<>` → `is distinct from`)
CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can cancel this job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can cancel it';
  end if;

  if v_job.status not in ('pending', 'active') then
    raise exception 'Job cannot be cancelled from its current status (status=%)', v_job.status;
  end if;

  update public.job_posts
  set
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = auth.uid(),
    cancellation_actor = 'customer',
    cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_job_id;

  if v_job.provider_id is not null then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (
      v_job.provider_id,
      'მომხმარებელმა მოთხოვნა გააუქმა',
      public.job_category_label(v_job.category),
      '🚫',
      '#DC2626',
      jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
      'job_status_change'
    );
  end if;
end;
$function$;

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
  if v_job.created_at > now() - interval '48 hours' then
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

CREATE OR REPLACE FUNCTION public.customer_confirm_completion(p_job_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can confirm completion';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can confirm completion';
  end if;
  if v_job.status <> 'awaiting_customer_confirmation' then
    raise exception 'Job is not awaiting confirmation (status=%)', v_job.status;
  end if;

  update public.job_posts set status = 'confirmed_awaiting_rating' where id = p_job_id;
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
$function$;

CREATE OR REPLACE FUNCTION public.finalize_job_publish(p_job_id uuid)
 RETURNS job_posts
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
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can publish a job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can publish it';
  end if;
  if v_job.status <> 'draft' then
    raise exception 'Job is not a draft (already published, or in another state)';
  end if;

  -- NEW — `for share` locks the matching categories row so a concurrent
  -- deactivation cannot land between this check and the status write
  -- below; the lock is released automatically when this transaction ends
  -- (commit or rollback).
  if not exists (
    select 1 from public.categories c where c.id = v_job.category and c.is_active = true for share
  ) then
    raise exception 'This job''s category is no longer available — please choose a different category and try again';
  end if;

  update public.job_posts set status = 'pending' where id = p_job_id
  returning * into v_job;

  return v_job;
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
  if v_job.created_at > now() - interval '27 days' then
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
$function$;

CREATE OR REPLACE FUNCTION public.select_provider(p_job_id uuid, p_provider_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if v_job.customer_id is distinct from auth.uid() then
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
$function$;

CREATE OR REPLACE FUNCTION public.set_job_photos(p_job_id uuid, p_photos text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  v_prefix text;
  v_private_prefix text := 'private-media://';
  v_photo text;
  v_object_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can set job photos';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can set photos';
  end if;
  if v_job.status <> 'draft' then
    raise exception 'Photos can only be set while the job is still a draft';
  end if;

  if p_photos is null then
    update public.job_posts set photos = '{}' where id = p_job_id;
    return;
  end if;

  if array_length(p_photos, 1) > 3 then
    raise exception 'A job may have at most 3 photos';
  end if;

  -- Every reference must point at exactly THIS job's own upload prefix,
  -- uploaded by exactly THIS caller (unchanged, 0054), AND now must
  -- actually exist as an uploaded object (new, 0061) — never an arbitrary
  -- string, another job's/user's reference, or a fabricated/typo'd
  -- filename that was never really uploaded.
  v_prefix := v_private_prefix || 'job/' || p_job_id::text || '/' || auth.uid()::text || '/';
  foreach v_photo in array p_photos loop
    if v_photo is null or v_photo !~~ (v_prefix || '%') or length(v_photo) <= length(v_prefix) then
      raise exception 'Invalid photo reference — must be this job''s own private-media upload';
    end if;

    v_object_name := substring(v_photo from length(v_private_prefix) + 1);
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'private-media' and o.name = v_object_name
    ) then
      raise exception 'Photo reference does not correspond to an uploaded object — upload it before attaching it to the job';
    end if;
  end loop;

  update public.job_posts set photos = p_photos where id = p_job_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_review_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
begin
  select * into v_job from public.job_posts where id = new.job_id for update;
  if v_job.id is null then
    raise exception 'Review references a job that does not exist';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can review it';
  end if;
  if v_job.status <> 'confirmed_awaiting_rating' then
    raise exception 'Job must be confirmed by the customer before it can be reviewed (current status=%)', v_job.status;
  end if;
  if v_job.provider_id is null then
    raise exception 'Job has no assigned provider to review';
  end if;

  -- Whatever the client sent for these two columns is discarded —
  -- always derived from the job itself, never trusted from the insert.
  new.customer_id := auth.uid();
  new.provider_id := v_job.provider_id;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_job_draft(p_job_id uuid, p_category text, p_description text, p_address text, p_date text, p_preferred_date date DEFAULT NULL::date, p_time_slot text DEFAULT NULL::text)
 RETURNS job_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  v_description text;
  v_area_label text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can edit a job draft';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can edit this draft';
  end if;
  -- "Do not allow changing a job after it becomes pending" — draft-only,
  -- exactly like set_job_photos() (0054): once finalize_job_publish() has
  -- run, this RPC can no longer touch the row at all.
  if v_job.status <> 'draft' then
    raise exception 'Only a draft job can be edited (status=%)', v_job.status;
  end if;

  -- Same validation as create_job() (0053/0059), unchanged.
  if p_address is null or btrim(p_address) = '' then
    raise exception 'An exact address is required';
  end if;

  v_description := btrim(coalesce(p_description, ''));
  if length(v_description) < 20 then
    raise exception 'Description must be at least 20 characters';
  end if;
  if length(v_description) > 500 then
    raise exception 'Description must be at most 500 characters';
  end if;

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

  -- Area label recomputed server-side from the (possibly changed)
  -- address — never left stale from the original create_job() call.
  v_area_label := public.job_safe_area_label(p_address);

  update public.job_posts
  set
    category = p_category,
    description = v_description,
    address = btrim(p_address),
    area_label = v_area_label,
    date = coalesce(p_date, ''),
    preferred_date = p_preferred_date,
    time_slot = p_time_slot
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_pending_job(p_job_id uuid, p_category text, p_description text, p_address text, p_date text, p_preferred_date date DEFAULT NULL::date, p_time_slot text DEFAULT NULL::text)
 RETURNS job_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job public.job_posts%rowtype;
  v_description text;
  v_area_label text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can edit a job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can edit this job';
  end if;
  -- run, this RPC can no longer touch the row at all.
  if v_job.status <> 'pending' then
    raise exception 'Only a pending job can be edited (status=%)', v_job.status;
  end if;

  -- Same validation as create_job() (0053/0059), unchanged.
  if p_address is null or btrim(p_address) = '' then
    raise exception 'An exact address is required';
  end if;

  v_description := btrim(coalesce(p_description, ''));
  if length(v_description) < 20 then
    raise exception 'Description must be at least 20 characters';
  end if;
  if length(v_description) > 500 then
    raise exception 'Description must be at most 500 characters';
  end if;

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

  -- Area label recomputed server-side from the (possibly changed)
  -- address — never left stale from the original create_job() call.
  v_area_label := public.job_safe_area_label(p_address);

  update public.job_posts
  set
    category = p_category,
    description = v_description,
    address = btrim(p_address),
    area_label = v_area_label,
    date = coalesce(p_date, ''),
    preferred_date = p_preferred_date,
    time_slot = p_time_slot
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$function$;

