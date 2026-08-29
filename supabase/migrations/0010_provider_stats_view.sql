-- 0010_provider_stats_view.sql
-- `provider_stats` — aggregated rating/review-count/completed-jobs per
-- Provider, read by src/services/userService.ts (listRealProviders /
-- getRealProviderById) to fill in the public directory's numbers.
-- Source: CLAUDE.md #64 (original) + #67 (extended with completed_jobs).
--
-- ** KNOWN GAP, read before applying **
-- This view has no `security_invoker` set, so it runs with the view
-- owner's privileges rather than the querying user's — Supabase's
-- database linter flags this as "Security Definer View". It is written
-- this way on purpose today: `job_posts` RLS does not allow one user to
-- read another's rows, but this view's completed_jobs count needs to
-- aggregate job_posts across ALL customers per provider. Reproduced
-- as-is here to match what's actually live; a proper fix (replacing this
-- view with a narrowly-scoped SECURITY DEFINER function that returns
-- only these 4 aggregate columns, discussed separately) was intentionally
-- not folded into this migration set — flagged as a follow-up.

create or replace view public.provider_stats as
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
) j on j.provider_id = pp.id;

grant select on public.provider_stats to authenticated;
