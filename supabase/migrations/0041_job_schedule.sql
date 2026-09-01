-- 0041_job_schedule.sql
-- Job date/time canonicalization (audit finding #2). `job_posts.date`
-- has always been a free-text DISPLAY string composed client-side
-- (PostJobScreen: formatted date + time-slot label, e.g. "20 დეკ.
-- 9:00–12:00") — there was no structured column a server-side RPC could
-- ever validate against. This migration adds two new, purely additive
-- columns alongside the existing `date` text column (left completely
-- unchanged, still written the same way, for every existing screen that
-- already reads it):
--
--   preferred_date date   — the calendar day the Customer picked, or
--                            NULL if none was picked (job has no
--                            scheduling preference at all).
--   time_slot text         — one of the app's fixed time-slot codes
--                            below, or NULL (date picked but no time
--                            slot chosen).
--
-- Existing rows (created before this migration) get NULL for both —
-- exactly "no schedule constraint", which is what they've always
-- effectively had. No backfill is possible or needed (the old free-text
-- `date` column was never structured enough to parse back out reliably,
-- and nothing in the product ever required it to be).
--
-- TIMEZONE RULE (documented once, here, and reused everywhere this data
-- is interpreted — job_scheduled_start() below, and CLAUDE.md): all job
-- date/time input is Georgia local time — the 'Asia/Tbilisi' IANA zone,
-- fixed UTC+04:00 with no DST since 2017. Every server-side computation
-- of "when does this job's scheduled window start" uses
-- `make_timestamptz(..., 'Asia/Tbilisi')`, not the Postgres session
-- timezone (which may differ) and not a hardcoded '+04' offset literal
-- (the named zone is self-documenting and stays correct if Georgia's
-- offset rules were ever revised again). The client (PostJobScreen)
-- builds `preferred_date` from the CalendarPicker's plain local `Date`
-- fields (getFullYear/getMonth/getDate) — never `.toISOString()`, which
-- converts to UTC and can shift the calendar date near midnight
-- depending on the device's own timezone.

alter table public.job_posts add column if not exists preferred_date date;
alter table public.job_posts add column if not exists time_slot text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'job_posts_time_slot_check') then
    alter table public.job_posts
      add constraint job_posts_time_slot_check
      check (time_slot is null or time_slot in ('09-12', '12-15', '15-18', '18-21', 'flexible'));
  end if;
end $$;

comment on column public.job_posts.preferred_date is
  'Customer-picked calendar day (Georgia/Asia-Tbilisi local), or NULL if no date was picked. Additive alongside the existing free-text `date` display column.';
comment on column public.job_posts.time_slot is
  'One of 09-12/12-15/15-18/18-21/flexible, or NULL (date picked without a time). See job_scheduled_start() for how this becomes an actual instant in time.';

-- ============================================================
-- job_scheduled_start() — the single place the Georgia-timezone rule
-- and the time-slot -> start-hour mapping are encoded, so
-- provider_request_completion() (and any future caller) never
-- duplicates it.
-- ============================================================
create or replace function public.job_scheduled_start(p_preferred_date date, p_time_slot text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case
    when p_preferred_date is null then null
    -- A concrete slot's own start hour. Unrecognized/NULL time_slot
    -- (including 'flexible', task: "Provider cannot request completion
    -- before that scheduled date starts") falls through to the ELSE —
    -- start of that calendar day, Georgia time.
    when p_time_slot = '09-12' then make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      9, 0, 0, 'Asia/Tbilisi')
    when p_time_slot = '12-15' then make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      12, 0, 0, 'Asia/Tbilisi')
    when p_time_slot = '15-18' then make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      15, 0, 0, 'Asia/Tbilisi')
    when p_time_slot = '18-21' then make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      18, 0, 0, 'Asia/Tbilisi')
    else make_timestamptz(
      extract(year from p_preferred_date)::int, extract(month from p_preferred_date)::int, extract(day from p_preferred_date)::int,
      0, 0, 0, 'Asia/Tbilisi')
  end;
$$;

comment on function public.job_scheduled_start(date, text) is
  'The earliest instant (Asia/Tbilisi) a job''s scheduled window can be considered started — NULL when no date was ever picked (no constraint). A concrete time_slot uses its own start hour; NULL/''flexible''/unrecognized time_slot uses the start of preferred_date itself.';

-- ============================================================
-- provider_request_completion() — CREATE OR REPLACE, same
-- signature/notification behavior as 0038, plus one new check
-- ============================================================
create or replace function public.provider_request_completion(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_scheduled_start timestamptz;
begin
  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.provider_id is distinct from auth.uid() then
    raise exception 'Only the assigned provider can request completion';
  end if;
  if v_job.status <> 'active' then
    raise exception 'Job is not in a state that can request completion (status=%)', v_job.status;
  end if;

  -- Audit finding #3 — a job with no preferred_date (old jobs, or a
  -- Customer who never picked one) has no schedule to enforce, exactly
  -- preserving prior behavior. A job WITH a preferred_date can only be
  -- marked "done" once its scheduled window has actually started.
  v_scheduled_start := public.job_scheduled_start(v_job.preferred_date, v_job.time_slot);
  if v_scheduled_start is not null and now() < v_scheduled_start then
    -- Distinctive, greppable prefix so the client (jobService.ts /
    -- ProviderJobDetailScreen) can show a specific Georgian message
    -- instead of the generic fallback, without parsing a fragile exact
    -- string — the same pattern authService.ts's getAuthErrorMessage()
    -- already uses for Supabase's own auth error messages.
    raise exception 'SCHEDULED_TIME_NOT_REACHED: job is scheduled to start at %, which has not yet arrived', v_scheduled_start;
  end if;

  update public.job_posts set status = 'awaiting_customer_confirmation' where id = p_job_id;

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (
    v_job.customer_id,
    'სამუშაო დასრულდა?',
    public.job_category_label(v_job.category),
    '⏰',
    '#D97706',
    jsonb_build_object('screen', 'CustomerJobDetail', 'jobId', p_job_id),
    'completion_reminder'
  );
end;
$$;

comment on function public.provider_request_completion(uuid) is
  'Assigned Provider marks their work done: active -> awaiting_customer_confirmation, notifies the Customer (type=completion_reminder). Rejects (SCHEDULED_TIME_NOT_REACHED) if the job has a preferred_date/time_slot whose scheduled window has not started yet (Asia/Tbilisi). A Provider can never mark a job completed directly.';

-- grant execute unchanged from 0014/0022/0038 (CREATE OR REPLACE keeps
-- existing grants) — repeated for clarity/idempotency, not required.
grant execute on function public.provider_request_completion(uuid) to authenticated;
