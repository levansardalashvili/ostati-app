-- 0011_job_posts_workflow_columns.sql
-- Hardens the job workflow's data model:
--   - agreed_price: the numeric price copied from the selected Provider's
--     job_responses.offered_price at selection time (see
--     0014_job_workflow_rpcs.sql's select_provider()). There is no
--     "inspection price" / "price after inspection" concept in this
--     product — a Provider always submits a concrete number.
--   - dispute_reason: free text captured by customer_report_problem().
--   - status check constraint gains 'confirmed_awaiting_rating', a new
--     state between "provider says done" and "completed" — completion
--     now requires a submitted review (enforced by
--     0015_review_completion_trigger.sql), not a direct client write.
--   - title: DROPPED from the canonical model. It was always exactly
--     the category's display label (never true free text — see
--     src/data/categories.ts / CLAUDE.md #23), so this is a lossless,
--     safely-reconstructible drop: any UI that needs a display title
--     derives it from `category` client-side (see jobService.ts's
--     deriveJobTitle()). No backfill needed for this column specifically
--     because nothing unique is lost.

alter table public.job_posts add column if not exists agreed_price numeric;
alter table public.job_posts add column if not exists dispute_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_posts_agreed_price_positive'
  ) then
    alter table public.job_posts
      add constraint job_posts_agreed_price_positive check (agreed_price > 0);
  end if;
end $$;

-- Replace the status check constraint to add 'confirmed_awaiting_rating'.
alter table public.job_posts drop constraint if exists job_posts_status_check;
alter table public.job_posts
  add constraint job_posts_status_check check (
    status in (
      'pending',
      'active',
      'awaiting_customer_confirmation',
      'confirmed_awaiting_rating',
      'disputed',
      'completed',
      'cancelled'
    )
  );

-- Drop the legacy user-entered title column — see header comment. Safe:
-- title was always derived from category, never independently entered.
alter table public.job_posts drop column if exists title;
