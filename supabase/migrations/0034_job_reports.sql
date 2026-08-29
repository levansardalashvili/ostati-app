-- 0034_job_reports.sql
-- Job Reports / no-show reporting — brand-new backend, no UI exists yet
-- (none is being added here; "moderation UI" and "report submission UI"
-- are both explicitly out of scope for this task). Follows the same
-- "RPC-only writes, narrow RLS" pattern established for job_posts (0026)
-- and reviews (0027): a client can never insert/update/delete this table
-- directly — only create_job_report() (SECURITY DEFINER) can write, and
-- it derives every identity-bearing field server-side rather than
-- trusting the caller.

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  -- Nullable — "the other participant" only exists once a job has an
  -- assigned Provider; a Customer reporting a still-pending job (no
  -- provider_id yet) has no specific person to attach the report to.
  reported_user_id uuid references auth.users(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint job_reports_reason_check check (
    reason in (
      'provider_no_show',
      'customer_no_show',
      'work_not_completed',
      'inappropriate_behavior',
      'incorrect_information',
      'other'
    )
  )
);

create index if not exists idx_job_reports_job_id on public.job_reports(job_id);
create index if not exists idx_job_reports_reporter_id on public.job_reports(reporter_id);
create index if not exists idx_job_reports_reported_user_id on public.job_reports(reported_user_id);
-- For a future moderation queue (out of scope here) filtering by status.
create index if not exists idx_job_reports_status on public.job_reports(status);

alter table public.job_reports enable row level security;

-- No direct client INSERT/UPDATE/DELETE grant at all — every write goes
-- through create_job_report() below, which runs as its definer identity
-- and is therefore unaffected by this revoke (same relationship as
-- job_posts' RPCs to job_posts' own revoked UPDATE grant, 0026).
revoke insert, update, delete on public.job_reports from authenticated;

-- Reporter can read only their own submitted reports. There is
-- deliberately no policy granting the reported user, or anyone else,
-- read access — "reported user does not automatically get access" and
-- "no public access" are both satisfied by there being exactly one
-- SELECT policy, scoped to reporter_id.
drop policy if exists "Reporter can read own reports" on public.job_reports;
create policy "Reporter can read own reports"
  on public.job_reports for select
  using (reporter_id = auth.uid());

-- No UPDATE policy exists (and the grant above is revoked regardless) —
-- "normal users cannot modify moderation status" holds even if a future
-- policy mistake ever re-grants UPDATE, since there would still be zero
-- UUPDATE policies to satisfy. Only a service_role-authenticated
-- moderation tool (bypasses RLS entirely, by Postgres/Supabase design)
-- can ever change `status` — no such tool exists yet; out of scope here
-- ("do not build Admin Panel").

drop trigger if exists set_updated_at on public.job_reports;
create trigger set_updated_at
  before update on public.job_reports
  for each row
  execute function public.set_updated_at();

create or replace function public.create_job_report(p_job_id uuid, p_reason text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_reported_user_id uuid;
  v_report_id uuid;
begin
  if p_reason not in (
    'provider_no_show', 'customer_no_show', 'work_not_completed',
    'inappropriate_behavior', 'incorrect_information', 'other'
  ) then
    raise exception 'Invalid report reason: %', p_reason;
  end if;

  select * into v_job from public.job_posts where id = p_job_id;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;

  -- "Participant" here means the job's own customer or its assigned
  -- Provider — matching how every other participant-scoped table in
  -- this schema (messages/conversations) defines the term. A Provider
  -- who only expressed interest (job_responses) without being assigned
  -- is not a participant of THIS job and cannot report on it — you
  -- cannot report a no-show for a job you were never assigned to.
  if auth.uid() <> v_job.customer_id and (v_job.provider_id is null or auth.uid() <> v_job.provider_id) then
    raise exception 'Only a participant in this job may report it';
  end if;

  -- The other side of the relationship — never trusted from the client.
  -- NULL when the reporter is the customer and no Provider is assigned
  -- yet (nothing/no one specific to attach the report to).
  v_reported_user_id := case
    when auth.uid() = v_job.customer_id then v_job.provider_id
    else v_job.customer_id
  end;

  insert into public.job_reports (job_id, reporter_id, reported_user_id, reason, details)
  values (
    p_job_id,
    auth.uid(),
    v_reported_user_id,
    p_reason,
    nullif(btrim(coalesce(p_details, '')), '')
  )
  returning id into v_report_id;

  return v_report_id;
end;
$$;

comment on function public.create_job_report(uuid, text, text) is
  'Files a report on a job (no-show, incomplete work, behavior, etc.). Caller must be the job''s own customer or its assigned Provider — reported_user_id is derived server-side as "the other participant", never trusted from the client. status always starts ''open''; only a service_role moderation tool (not built yet) can change it.';

grant execute on function public.create_job_report(uuid, text, text) to authenticated;
