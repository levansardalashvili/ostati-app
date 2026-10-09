-- Three lifecycle follow-ups (publish→completion review):
--
-- (1) The 72h auto-confirm timer measured `updated_at`, which ANY later row
--     change (e.g. an admin removing a photo) silently reset. It now uses a
--     dedicated `completion_requested_at`, stamped by a trigger whenever a job
--     enters `awaiting_customer_confirmation` (Provider's request, or an admin
--     dispute "reopen" — a fresh 72h either way). Existing rows are backfilled
--     from updated_at; old rows without it keep the old fallback.
-- (2) reschedule_active_job(): once a Provider is selected, the date/time
--     could never change, so a job agreed for an earlier slot stayed blocked
--     by the "not before scheduled start" completion rule. The Customer (job
--     owner) can now change date/time of an `active` job; the Provider is
--     notified and gets a fresh completion reminder for the new slot.
--     Past dates are already rejected by the 0148 trigger.
-- (3) provider_respond_to_dispute(): a dispute only carried the Customer's
--     side. The assigned Provider can now write their side while the job is
--     `disputed`; the admin disputes page shows it. Cleared when a NEW dispute
--     is opened so a stale answer never sits under a new complaint.

alter table public.job_posts
  add column if not exists completion_requested_at timestamptz,
  add column if not exists dispute_provider_response text;

update public.job_posts
   set completion_requested_at = updated_at
 where status = 'awaiting_customer_confirmation' and completion_requested_at is null;

create or replace function public.job_status_side_effects()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.status is distinct from old.status then
    if new.status = 'awaiting_customer_confirmation' then
      new.completion_requested_at := now();
    elsif new.status = 'disputed' then
      new.dispute_provider_response := null;
    end if;
  end if;
  return new;
end;
$function$;

revoke execute on function public.job_status_side_effects() from public, anon, authenticated;

drop trigger if exists job_posts_status_side_effects on public.job_posts;
create trigger job_posts_status_side_effects
  before update of status on public.job_posts
  for each row execute function public.job_status_side_effects();

-- (1) live definition of expire_stale_job_confirmation; only the timer column changed.
create or replace function public.expire_stale_job_confirmation(p_job_id uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.job_posts%rowtype;
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

  if v_job.status <> 'awaiting_customer_confirmation' then
    return false;
  end if;
  if coalesce(v_job.completion_requested_at, v_job.updated_at) > now() - v_grace then
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

-- (1) run_time_rules (0149 definition); only the first loop's timer column changed.
create or replace function public.run_time_rules()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  r record;
begin
  for r in
    select id, customer_id from public.job_posts
     where status = 'awaiting_customer_confirmation' and customer_id is not null
       and coalesce(completion_requested_at, updated_at) < now() - make_interval(hours => public.app_setting('confirmation_grace_hours', 72))
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

  for r in
    select jp.id, jp.provider_id, jp.category from public.job_posts jp
     where jp.status = 'active' and jp.provider_id is not null
       and jp.provider_completion_reminder_sent_at is null
       and coalesce(public.job_scheduled_start(jp.preferred_date, jp.time_slot), jp.updated_at)
           < now() - make_interval(hours => public.app_setting('provider_completion_reminder_hours', 24))
  loop
    begin
      update public.job_posts set provider_completion_reminder_sent_at = now() where id = r.id;
      insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
      values (
        r.provider_id,
        'სამუშაო დაასრულე?',
        'თუ სამუშაო შესრულებულია, მონიშნე დასრულებულად — ' || public.job_category_label(r.category),
        '⏰', '#D97706',
        jsonb_build_object('screen', 'ProviderJobDetail', 'id', r.id, 'mode', 'selected'),
        'job_status_change'
      );
    exception when others then null;
    end;
  end loop;

  perform set_config('request.jwt.claims', '', true);
end;
$function$;

-- (2)
create or replace function public.reschedule_active_job(p_job_id uuid, p_preferred_date date, p_time_slot text, p_date text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.job_posts%rowtype;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can reschedule a job';
  end if;
  if p_preferred_date is null or p_time_slot is null then
    raise exception 'DATE_TIME_REQUIRED: preferred date and time are required';
  end if;
  if p_time_slot <> 'flexible' and (
    p_time_slot !~ '^(0[0-9]|1[0-9]|2[0-3])-(0[1-9]|1[0-9]|2[0-4])$'
    or split_part(p_time_slot, '-', 1)::int >= split_part(p_time_slot, '-', 2)::int
  ) then
    raise exception 'Invalid time_slot: %', p_time_slot;
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can reschedule it';
  end if;
  if v_job.status <> 'active' or v_job.provider_id is null then
    raise exception 'Only a job with a selected provider can be rescheduled (status=%)', v_job.status;
  end if;

  update public.job_posts
     set preferred_date = p_preferred_date,
         time_slot = p_time_slot,
         date = left(coalesce(btrim(p_date), ''), 80),
         provider_completion_reminder_sent_at = null
   where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.provider_id,
    'სამუშაოს დრო შეიცვალა',
    coalesce(nullif(left(btrim(coalesce(p_date, '')), 80), ''), public.job_category_label(v_job.category)),
    '📅', '#2563EB',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_status_change'
  );
end;
$function$;

revoke execute on function public.reschedule_active_job(uuid, date, text, text) from public, anon;
grant execute on function public.reschedule_active_job(uuid, date, text, text) to authenticated;

-- (3)
create or replace function public.provider_respond_to_dispute(p_job_id uuid, p_response text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.job_posts%rowtype;
  v_text text := btrim(coalesce(p_response, ''));
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can respond to a dispute';
  end if;
  if char_length(v_text) not between 5 and 1000 then
    raise exception 'Response must be 5–1000 characters';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.provider_id is distinct from auth.uid() then
    raise exception 'Only the assigned provider can respond to this dispute';
  end if;
  if v_job.status <> 'disputed' then
    raise exception 'Job is not disputed (status=%)', v_job.status;
  end if;

  update public.job_posts set dispute_provider_response = v_text where id = p_job_id;
end;
$function$;

revoke execute on function public.provider_respond_to_dispute(uuid, text) from public, anon;
grant execute on function public.provider_respond_to_dispute(uuid, text) to authenticated;
