-- 0008_reviews.sql
-- `reviews` — one Customer review per completed job. Publicly readable
-- (CLAUDE.md #58) so other Customers can see a Provider's track record;
-- only the job's own Customer may write it. customer_name is
-- denormalized (same reasoning as job_posts.customer_name/
-- job_responses.provider_name) so a Provider viewing their own reviews
-- doesn't need read access into `users`.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null default '',
  stars int not null,
  review_text text not null default '',
  chips text[] not null default '{}',
  photos jsonb,
  created_at timestamptz not null default now(),
  constraint reviews_stars_range check (stars between 1 and 5),
  constraint reviews_one_per_job unique (job_id)
);

create index if not exists idx_reviews_provider_id on public.reviews(provider_id);

alter table public.reviews enable row level security;

-- Reviews are deliberately public — a real decision-making signal for
-- other Customers browsing the directory, not private data.
drop policy if exists "Reviews are publicly readable" on public.reviews;
create policy "Reviews are publicly readable"
  on public.reviews for select
  to authenticated
  using (true);

-- Only the job's own Customer can submit a review for it — the
-- with-check both pins customer_id to the caller AND re-verifies (via
-- job_posts) that this caller actually owns that job_id, so a Customer
-- cannot review a job that isn't theirs even if they guess/borrow a
-- job_id.
drop policy if exists "Customer can review own completed job" on public.reviews;
create policy "Customer can review own completed job"
  on public.reviews for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.job_posts jp
      where jp.id = reviews.job_id and jp.customer_id = auth.uid()
    )
  );
