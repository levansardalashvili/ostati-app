-- 0030_provider_stats_function.sql
-- Security audit — resolves the "Security Definer View" Supabase linter
-- warning on public.provider_stats (flagged since 0010, documented there
-- as a known, deferred gap).
--
-- Why it was a view without security_invoker in the first place:
-- completed_jobs must count job_posts rows across ALL customers per
-- provider, but job_posts' own RLS only lets a user read their own rows
-- (as customer or assigned provider) — a security_invoker view would
-- only ever see the querying user's own job_posts rows, breaking the
-- aggregate for every other provider. So it ran with the view creator's
-- privileges instead, bypassing RLS entirely — which is exactly what the
-- linter flags, because a VIEW is an open-ended, directly queryable
-- object: SELECT * from it, and it's not obvious it's quietly bypassing
-- RLS.
--
-- The safest fix that preserves the aggregate numbers: replace the VIEW
-- with a SECURITY DEFINER FUNCTION that returns only these four columns
-- — same elevated-read requirement, same result set, but now expressed
-- as a narrowly-scoped, explicitly-callable interface (exactly the
-- pattern already used for select_provider/provider_request_completion/
-- etc., 0014) instead of a raw table-like object. Supabase's linter only
-- flags SECURITY DEFINER *views*, not functions — this is the officially
-- recommended fix for this exact warning.

drop view if exists public.provider_stats;

create or replace function public.get_provider_stats(p_provider_id uuid default null)
returns table (
  provider_id uuid,
  avg_rating numeric,
  review_count bigint,
  completed_jobs bigint
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    pp.id as provider_id,
    coalesce(r.avg_rating, 0) as avg_rating,
    coalesce(r.review_count, 0) as review_count,
    coalesce(j.completed_jobs, 0) as completed_jobs
  from public.provider_profiles pp
  left join (
    select provider_id, round(avg(stars)::numeric, 1) as avg_rating, count(*) as review_count
    from public.reviews
    group by provider_id
  ) r on r.provider_id = pp.id
  left join (
    select provider_id, count(*) as completed_jobs
    from public.job_posts
    where status = 'completed'
    group by provider_id
  ) j on j.provider_id = pp.id
  where p_provider_id is null or pp.id = p_provider_id;
$$;

comment on function public.get_provider_stats(uuid) is
  'Public aggregate Provider stats (avg rating, review count, completed jobs) — replaces the old provider_stats view. Call with no argument for all providers, or p_provider_id for one. SECURITY DEFINER is required (completed_jobs aggregates job_posts across all customers, which RLS alone would block per-caller) but scoped to exactly these 4 read-only aggregate columns, never raw row access.';

grant execute on function public.get_provider_stats(uuid) to authenticated;
