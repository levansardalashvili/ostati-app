-- An `active` job had exactly one way forward: the Provider pressing
-- "სამუშაო დავასრულე". If they never did, the job sat in `active` forever —
-- no review could be written and the Provider's completed-jobs/rating never
-- grew. Two paths are added:
--
-- (1) Provider reminder: once, N hours (default 24, app_setting
--     'provider_completion_reminder_hours') after the scheduled start, the
--     assigned Provider is reminded to mark the job done. Runs in the existing
--     15-minute run_time_rules() cron (#145) — rebuilt from the live
--     definition, only the new loop is appended.
-- (2) customer_mark_completed(): after the scheduled start, the Customer can
--     mark the job done themselves. It goes straight to
--     `confirmed_awaiting_rating` (the Customer IS the confirming party), so
--     the mandatory review still decides `completed` (#72).

alter table public.job_posts
  add column if not exists provider_completion_reminder_sent_at timestamptz;

create or replace function public.customer_mark_completed(p_job_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_job public.job_posts%rowtype;
  v_start timestamptz;
begin
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can mark a job completed';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.customer_id is distinct from auth.uid() then
    raise exception 'Only the job owner can mark it completed';
  end if;
  if v_job.status <> 'active' or v_job.provider_id is null then
    raise exception 'Job is not in progress (status=%)', v_job.status;
  end if;

  v_start := public.job_scheduled_start(v_job.preferred_date, v_job.time_slot);
  if v_start is not null and now() < v_start then
    raise exception 'SCHEDULED_TIME_NOT_REACHED: job is scheduled to start at %', v_start;
  end if;

  update public.job_posts set status = 'confirmed_awaiting_rating' where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.provider_id,
    'მომხმარებელმა სამუშაო დასრულებულად მონიშნა',
    public.job_category_label(v_job.category),
    '✅', '#059669',
    jsonb_build_object('screen', 'ProviderJobDetail', 'id', p_job_id, 'mode', 'selected'),
    'job_status_change'
  );
end;
$function$;

revoke execute on function public.customer_mark_completed(uuid) from public, anon;
grant execute on function public.customer_mark_completed(uuid) to authenticated;

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

  -- NEW (0149): remind the assigned Provider, once, to mark an active job done.
  -- Old jobs without a schedule fall back to when they last changed.
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
