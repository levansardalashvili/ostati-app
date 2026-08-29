-- 0004_job_posts.sql
-- `job_posts` — Customer's job listings + the Provider-facing open feed.
-- Source: src/services/jobService.ts (JobPostRow). customer_name and
-- (once assigned) provider_name are denormalized onto the row itself
-- (CLAUDE.md #54/#69) so the "other side" never needs to read `users`/
-- `provider_profiles` through RLS it doesn't have access to.

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null default '',
  title text not null,
  category text not null,
  description text not null default '',
  address text not null default '',
  date text not null default '',
  status text not null default 'pending',
  photos text[] not null default '{}',
  provider_id uuid references auth.users(id) on delete set null,
  provider_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_posts_status_check check (
    status in ('pending', 'active', 'awaiting_customer_confirmation', 'disputed', 'completed', 'cancelled')
  )
);

alter table public.job_posts add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_job_posts_customer_id on public.job_posts(customer_id);
create index if not exists idx_job_posts_provider_id on public.job_posts(provider_id);
create index if not exists idx_job_posts_status on public.job_posts(status);
create index if not exists idx_job_posts_created_at on public.job_posts(created_at desc);

alter table public.job_posts enable row level security;

-- Customer can create jobs only under their own id.
drop policy if exists "Customer can create own jobs" on public.job_posts;
create policy "Customer can create own jobs"
  on public.job_posts for insert
  with check (customer_id = auth.uid());

-- Customer can read their own jobs, in any status.
drop policy if exists "Customer can read own jobs" on public.job_posts;
create policy "Customer can read own jobs"
  on public.job_posts for select
  using (customer_id = auth.uid());

-- Any Provider can read jobs that are still open (not yet assigned).
drop policy if exists "Provider can read open jobs" on public.job_posts;
create policy "Provider can read open jobs"
  on public.job_posts for select
  using (
    status = 'pending'
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider')
  );

-- A Provider can also read a job once it's assigned to them (no longer
-- 'pending', so the policy above stops matching it).
drop policy if exists "Assigned provider can read own job" on public.job_posts;
create policy "Assigned provider can read own job"
  on public.job_posts for select
  using (provider_id = auth.uid());

-- Only the job's own Customer can update it — this is how provider_id
-- gets set in the first place (Customer selecting a Provider), so a
-- Provider can never assign themselves through this policy: it only
-- ever matches rows the Customer already owns.
drop policy if exists "Customer can update own jobs" on public.job_posts;
create policy "Customer can update own jobs"
  on public.job_posts for update
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- Once assigned, the Provider can update status on their own job (e.g.
-- "მე ვასრულებ" -> awaiting_customer_confirmation) but only on a row
-- that is already assigned to them — this is what structurally prevents
-- "Providers cannot assign themselves": a Provider can never use this
-- policy to attach themselves to an unassigned (provider_id is null) job.
drop policy if exists "Assigned provider can update job status" on public.job_posts;
create policy "Assigned provider can update job status"
  on public.job_posts for update
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());

drop trigger if exists set_updated_at on public.job_posts;
create trigger set_updated_at
  before update on public.job_posts
  for each row
  execute function public.set_updated_at();
