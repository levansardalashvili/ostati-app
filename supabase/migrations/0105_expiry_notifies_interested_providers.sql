-- Known small gap (#131/#134 follow-up): when a pending job actually expires (30 days), the
-- providers who had already expressed interest on it just saw it vanish from job_responses
-- with no explanation — only the owning customer got a notification. Tell them too.

create or replace function public.expire_my_stale_jobs()
returns integer language plpgsql security definer set search_path = '' as $$
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
       and created_at < now() - interval '27 days'
       and created_at >= now() - interval '30 days'
    returning id, category
  )
  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  select auth.uid(), 'განცხადების ვადა იწურება', public.job_category_label(due.category) || ' — განაახლეთ, თუ ჯერ კიდევ გჭირდებათ', '⏳', '#D97706',
         jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', due.id), 'job_status_change'
    from due;

  select array_agg(id) into v_expired_ids
    from public.job_posts
   where customer_id = auth.uid() and status = 'pending' and created_at < now() - interval '30 days';

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
$$;

revoke execute on function public.expire_my_stale_jobs() from public, anon;
grant execute on function public.expire_my_stale_jobs() to authenticated;
