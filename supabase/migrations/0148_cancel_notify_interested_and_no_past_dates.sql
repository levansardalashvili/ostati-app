-- Two lifecycle fixes found in the publish→completion review.
--
-- (1) cancel_job(): when a Customer cancels a still-PENDING job, Providers who
--     had already sent a price offer (job_responses) were never told — the job
--     just vanished from their feed. Job expiry (0105) and provider selection
--     (0081) already notify them; cancellation now does too. Rebuilt from the
--     live definition — the only change is the extra insert at the end.
--
-- (2) No job may be (re)scheduled to a past date. The calendar already blocks
--     past days client-side, but create_job / update_job_draft /
--     update_pending_job never checked it. One trigger covers all three
--     (and any future writer): it fires only when preferred_date is set or
--     CHANGED, so editing other fields of an older job whose date has since
--     passed keeps working. "Today" is Georgia's date (Asia/Tbilisi, #91).

create or replace function public.cancel_job(p_job_id uuid, p_reason text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

  -- NEW: pending job — tell every Provider who already offered a price.
  -- (On an active job the other responders were already told at selection.)
  if v_job.status = 'pending' then
    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    select jr.provider_id, 'მომხმარებელმა განცხადება გააუქმა',
           public.job_category_label(v_job.category), '🚫', '#64748B', null, 'job_status_change'
      from public.job_responses jr
     where jr.job_id = p_job_id;
  end if;
end;
$function$;

create or replace function public.reject_past_preferred_date()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.preferred_date is not null
     and (tg_op = 'INSERT' or new.preferred_date is distinct from old.preferred_date)
     and new.preferred_date < (now() at time zone 'Asia/Tbilisi')::date then
    raise exception 'DATE_IN_PAST: preferred date cannot be in the past';
  end if;
  return new;
end;
$function$;

revoke execute on function public.reject_past_preferred_date() from public, anon, authenticated;

drop trigger if exists job_posts_reject_past_date on public.job_posts;
create trigger job_posts_reject_past_date
  before insert or update of preferred_date on public.job_posts
  for each row execute function public.reject_past_preferred_date();
