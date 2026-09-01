-- 0065_job_price_validation_rule.sql
-- Focused backend hardening pass, item 2. Every place that validates a
-- job-related price (express_interest, structured chat offers,
-- respond_to_chat_offer, select_provider) only ever checked
-- "not null and > 0" — which is NOT sufficient in Postgres specifically,
-- because the `numeric` type has a special NaN value that this project's
-- own existing CHECK constraints (job_responses_offered_price_positive,
-- job_posts_agreed_price_positive, both `check (x > 0)`) do not actually
-- reject:
--
--   PostgreSQL treats NaN as EQUAL to itself and GREATER THAN every
--   non-NaN value (including any finite number and, where supported,
--   Infinity) — this is documented Postgres behavior (numeric types),
--   deliberately different from IEEE-754 float semantics, so that NaN
--   sorts consistently in indexes/ORDER BY. Consequence: `'NaN'::numeric
--   > 0` evaluates to TRUE. A bare `x > 0` check — which is exactly what
--   every price check in this codebase used until now — does NOT reject
--   NaN. It also does not reject an absurdly large finite value (nothing
--   stopped `1e30`).
--
-- Fix: one single, shared rule function, `is_valid_job_price()`, used
-- everywhere a price is validated (wired into express_interest/
-- select_provider/respond_to_chat_offer/the chat-offer INSERT policy in
-- 0066), AND tightened as the actual CHECK constraint on every column
-- that stores a price — so the rule holds at the schema level too, not
-- only inside the specific RPCs currently known to write these columns.
--
-- Bound reasoning (documented, single source of truth): 1,000,000 (GEL,
-- this product's only currency, CLAUDE.md — "გადახდის სისტემა საერთოდ არ
-- არსებობს", prices are informational numbers agreed between Customer
-- and Provider) is generously above any real home-service job in this
-- product's scope (plumbing/electrical/renovation/etc — even a large
-- multi-room renovation would not plausibly reach six figures), while
-- clearly excluding attack-style values.
--
-- Why the upper bound alone is enough to reject NaN (and Infinity, where
-- the Postgres version supports it for `numeric`): given "NaN sorts as
-- greater than every non-NaN value", `NaN <= 1000000` is FALSE — the
-- exact same comparison already needed for the sane-maximum rule
-- structurally excludes NaN as a side effect, with no separate
-- `= 'NaN'::numeric` literal needed (whose own literal-parsing support
-- has version history quirks of its own — Infinity support for
-- `numeric` specifically was only added in PostgreSQL 14).

create or replace function public.is_valid_job_price(p_price numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_price is not null and p_price > 0 and p_price <= 1000000;
$$;

comment on function public.is_valid_job_price(numeric) is
  'The one shared job-price validation rule: finite, positive, and at most 1,000,000 (GEL). NULL/<=0/NaN/Infinity/absurdly-large values are all rejected by this single check — NaN and Infinity in particular are rejected as a structural consequence of the upper bound (`<= 1000000`), since PostgreSQL''s `numeric` type sorts NaN as greater than every non-NaN value, including Infinity. Used by express_interest(), select_provider(), respond_to_chat_offer(), and the chat-offer message INSERT policy (0066), and enforced again at the column level below.';

revoke execute on function public.is_valid_job_price(numeric) from public, anon, authenticated;
grant execute on function public.is_valid_job_price(numeric) to authenticated;

-- ============================================================
-- Schema-level defense in depth — tighten every column that stores a
-- price to the SAME rule, not just the RPCs currently known to write it.
-- ============================================================

-- `not valid` on all three, matching this project's own established
-- pattern for adding a CHECK after the fact (0049's
-- `messages_offer_requires_job_id`) — enforced for every NEW/UPDATEd row
-- going forward without requiring (or risking failure on) a full-table
-- scan of whatever already exists. In practice no existing row is
-- expected to actually violate these — every prior write path only ever
-- computed prices from user-entered numeric form input, never a literal
-- NaN/Infinity — but `not valid` means this migration cannot fail to
-- apply even if that assumption were somehow wrong for a row already on
-- disk, which matters here since this migration was not run against a
-- copy of the real production database before being written.
alter table public.job_responses drop constraint if exists job_responses_offered_price_positive;
alter table public.job_responses
  add constraint job_responses_offered_price_positive
  check (offered_price is null or public.is_valid_job_price(offered_price))
  not valid;

alter table public.job_posts drop constraint if exists job_posts_agreed_price_positive;
alter table public.job_posts
  add constraint job_posts_agreed_price_positive
  check (agreed_price is null or public.is_valid_job_price(agreed_price))
  not valid;

-- messages.amount never had a table-level CHECK at all (only RLS/RPC
-- validation, 0049/0056) — added here for the same defense-in-depth
-- reasoning. Nullable: only type='offer' rows carry an amount at all
-- (text/image rows are null, unaffected).
alter table public.messages drop constraint if exists messages_amount_valid;
alter table public.messages
  add constraint messages_amount_valid
  check (amount is null or public.is_valid_job_price(amount))
  not valid;
