-- Pending jobs expire after 30 days (0096). From day 27 the owner gets ONE reminder and can renew the job
-- (created_at = now()) instead of losing it silently.

alter table public.job_posts add column if not exists expiry_reminder_sent_at timestamptz;

create or replace function public.expire_my_stale_jobs()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  -- one reminder per job (the window is the last 3 days before expiry)
  with due as (
    update public.job_posts
       set expiry_reminder_sent_at = now()
     where customer_id = auth.uid() and status = 'pending'
       and expiry_reminder_sent_at is null
       and created_at < now() - interval '27 days'
       and created_at >= now() - interval '30 days'
    returning id, category
  )
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select auth.uid(), 'განცხადების ვადა იწურება', public.job_category_label(due.category) || ' — განაახლეთ, თუ ჯერ კიდევ გჭირდებათ', '⏳', '#D97706',
         jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', due.id), 'job_status_change'
    from due;

  update public.job_posts
     set status = 'cancelled', cancelled_at = now(), cancellation_actor = 'admin',
         cancellation_reason = 'ვადა გაუვიდა (30 დღე)'
   where customer_id = auth.uid() and status = 'pending' and created_at < now() - interval '30 days';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Renewing is allowed only inside the last 3 days, so a job cannot be bumped to the top indefinitely.
create or replace function public.renew_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null or v_job.customer_id <> auth.uid() then raise exception 'Job not found'; end if;
  if v_job.status <> 'pending' then raise exception 'Only a pending job can be renewed'; end if;
  if v_job.created_at > now() - interval '27 days' then
    raise exception 'RENEW_TOO_EARLY: a job can be renewed only in its last 3 days';
  end if;

  update public.job_posts
     set created_at = now(), expiry_reminder_sent_at = null, stale_interest_reminder_sent_at = null
   where id = p_job_id;
end;
$$;

revoke execute on function public.renew_job(uuid) from public, anon;
grant execute on function public.renew_job(uuid) to authenticated;

revoke execute on function public.expire_my_stale_jobs() from public, anon;
grant execute on function public.expire_my_stale_jobs() to authenticated;
