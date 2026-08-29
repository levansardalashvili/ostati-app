-- 0005_job_responses.sql
-- `job_responses` — a Provider expressing interest in a job_post, with
-- an optional hand-typed price. Source: src/services/quoteService.ts
-- (JobResponseRow). provider_name/initials/color are denormalized here
-- (CLAUDE.md #56) so the Customer can display the Provider's name
-- without needing read access to provider_profiles/users through a join.

create table if not exists public.job_responses (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  provider_name text not null default '',
  provider_initials text not null default '',
  provider_color text not null default '#2563EB',
  offered_price text,
  created_at timestamptz not null default now(),
  constraint job_responses_one_per_provider unique (job_id, provider_id)
);

create index if not exists idx_job_responses_job_id on public.job_responses(job_id);
create index if not exists idx_job_responses_provider_id on public.job_responses(provider_id);

alter table public.job_responses enable row level security;

-- provider_id must equal the authenticated caller — a Provider can only
-- ever express interest as themselves.
drop policy if exists "Provider can express interest as self" on public.job_responses;
create policy "Provider can express interest as self"
  on public.job_responses for insert
  with check (provider_id = auth.uid());

-- Providers can read their own responses (to restore "already
-- interested" state on re-entering a job's detail screen).
drop policy if exists "Provider can read own responses" on public.job_responses;
create policy "Provider can read own responses"
  on public.job_responses for select
  using (provider_id = auth.uid());

-- Customer can read responses only for jobs they own.
drop policy if exists "Customer can read responses for own jobs" on public.job_responses;
create policy "Customer can read responses for own jobs"
  on public.job_responses for select
  using (
    exists (
      select 1 from public.job_posts jp
      where jp.id = job_responses.job_id and jp.customer_id = auth.uid()
    )
  );
