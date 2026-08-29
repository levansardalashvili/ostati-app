-- 0012_job_responses_price_numeric.sql
-- `job_responses.offered_price` was `text` (e.g. could hold "120 ₾"),
-- and optional. The product rule is now: a Provider's offer is always a
-- concrete numeric value, never a formatted string and never absent —
-- there is no "quote_type" or "price after inspection" concept.
--
-- ** DATA BACKFILL NOTE **
-- Existing rows may hold NULL (price was optional before) or
-- human-formatted text (e.g. "120 ₾", "120", "120₾"). This migration:
--   1. Converts the column to `numeric`, stripping any non-digit/decimal
--      characters from existing text before casting (so "120 ₾" -> 120).
--      A value that has no digits at all becomes NULL rather than
--      erroring the migration.
--   2. Adds `check (offered_price > 0)` — in Postgres this check passes
--      for NULL rows (a NULL comparison is neither true nor false, and
--      CHECK only rejects an explicit false), so existing legacy NULL
--      rows are NOT retroactively broken by this migration.
--   3. Does NOT force NOT NULL, for the same reason — some legacy
--      responses genuinely have no recoverable price and must remain
--      queryable. Going forward, the app (quoteService.ts) always sends
--      a required number, and select_provider() (0014) explicitly
--      rejects selecting a response whose offered_price is null or <= 0,
--      so in practice a job can never be awarded on top of a legacy
--      priceless response.

alter table public.job_responses
  alter column offered_price type numeric
  using nullif(regexp_replace(offered_price::text, '[^0-9.]', '', 'g'), '')::numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'job_responses_offered_price_positive'
  ) then
    alter table public.job_responses
      add constraint job_responses_offered_price_positive check (offered_price > 0);
  end if;
end $$;
