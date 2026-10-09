-- A private job (invited_provider_id, #126 — "მიწერა" / rehire) was visible
-- only to the invited Provider. If they ignored it, the Customer could do
-- nothing until it expired after 30 days. Two exits:
--
-- (1) decline_invited_job(): the invited Provider says no. They are added to
--     excluded_provider_ids (the job disappears for them everywhere, their
--     response — if any — is removed) and the Customer is notified.
-- (2) open_job_to_all(): the Customer turns their private job into a normal
--     public one (invited_provider_id -> null). The existing area-notification
--     trigger function handle_new_job_notify() is reused through a second
--     trigger on exactly that change — no duplicated matching logic.
--     handle_new_job_notify() now also skips excluded / blocked providers, so
--     a Provider who declined is never pinged about the same job again.
-- (3) get_my_job_invite(): tells the Provider screen whether the job is a
--     still-open invite for them (the feed RPCs don't return invited_provider_id).

alter table public.job_posts
  add column if not exists invite_declined_at timestamptz;

create or replace function public.decline_invited_job(p_job_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can decline a job invite';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null or v_job.invited_provider_id is distinct from auth.uid() then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is no longer open (status=%)', v_job.status;
  end if;
  if v_job.invite_declined_at is not null then
    return;
  end if;

  update public.job_posts
     set invite_declined_at = now(),
         excluded_provider_ids = array_append(excluded_provider_ids, auth.uid())
   where id = p_job_id;

  delete from public.job_responses where job_id = p_job_id and provider_id = auth.uid();

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.customer_id,
    'ოსტატმა მოთხოვნაზე უარი თქვა',
    'შეგიძლიათ განცხადება ყველა ოსტატისთვის გახსნათ — ' || public.job_category_label(v_job.category),
    'ℹ️', '#64748B',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id),
    'job_status_change'
  );
end;
$function$;

revoke execute on function public.decline_invited_job(uuid) from public, anon;
grant execute on function public.decline_invited_job(uuid) to authenticated;

create or replace function public.open_job_to_all(p_job_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can open a job to everyone';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can open it';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Job is no longer open (status=%)', v_job.status;
  end if;
  if v_job.invited_provider_id is null then
    return;
  end if;

  update public.job_posts set invited_provider_id = null where id = p_job_id;
end;
$function$;

revoke execute on function public.open_job_to_all(uuid) from public, anon;
grant execute on function public.open_job_to_all(uuid) to authenticated;

create or replace function public.get_my_job_invite(p_job_id uuid)
 returns boolean
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select exists (
    select 1 from public.job_posts jp
     where jp.id = p_job_id
       and jp.invited_provider_id = auth.uid()
       and jp.invite_declined_at is null
       and jp.status = 'pending'
  );
$function$;

revoke execute on function public.get_my_job_invite(uuid) from public, anon;
grant execute on function public.get_my_job_invite(uuid) to authenticated;

-- Live definition of handle_new_job_notify + excluded/blocked filters.
create or replace function public.handle_new_job_notify()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
    and not (p.id = any(new.excluded_provider_ids))
    and not public.is_blocked_pair(new.customer_id, p.id)
    and exists (select 1 from jsonb_array_elements(p.specialty) s
                where public.specialty_to_category(s->>'id') = new.category)
    and (
      (new.district is not null and new.district = any(p.areas))
      or (new.district is null and exists (select 1 from unnest(p.areas) as area where new.address ilike '%' || area || '%'))
    );
  return new;
end;
$function$;

drop trigger if exists on_job_opened_to_all_notify on public.job_posts;
create trigger on_job_opened_to_all_notify
  after update of invited_provider_id on public.job_posts
  for each row
  when (old.invited_provider_id is not null and new.invited_provider_id is null and new.status = 'pending')
  execute function public.handle_new_job_notify();
