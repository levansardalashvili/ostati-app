-- 0047_job_address_privacy.sql
-- Second hardening pass, item 3. `job_posts.address` is the Customer's
-- exact home address (free text, from AddressAutocompleteField) — a
-- Provider merely BROWSING the open job feed (not yet expressed
-- interest, not assigned) could always read it in full via
-- `getOpenProviderFeedPosts()`/`getFeedJobPostById()`'s plain
-- `select('*')`. This migration adds a coarse, public-safe `area_label`
-- column and a view that masks `address` down to `area_label` for
-- anyone who is not the job's own Customer or its assigned Provider —
-- exact address stays visible to exactly those two, unchanged, for
-- every existing/legacy row too.
--
-- Design choice: a VIEW with `security_invoker = true` (not a new RPC
-- duplicating job_posts' ~20-column shape, not a SECURITY DEFINER view —
-- that would trip the same "Security Definer View" Advisor warning 0030
-- already fixed once for provider_stats). `security_invoker = true`
-- means the view evaluates job_posts' OWN RLS using the QUERYING user's
-- identity, exactly like querying the table directly — the ONLY thing
-- this view changes is the value of one column, via a per-row CASE
-- expression evaluated in the querying session's own context. Which
-- ROWS are visible at all is still entirely governed by job_posts'
-- existing RLS (0004/0026), unchanged.
--
-- No UI change: the client still submits one free-text address field
-- (task: "Do not redesign the UI"). `area_label` is derived server-side
-- from that same string — a best-effort heuristic, not exact-parsed
-- geocoding (documented limitation below).

alter table public.job_posts add column if not exists area_label text;

-- Best-effort coarse label: strip the first comma-delimited segment
-- (typically street+building number in this product's Nominatim-assisted
-- addresses, e.g. "ვაჟა-ფშაველას 10, ვაკე, თბილისი" -> "ვაკე, თბილისი").
-- KNOWN LIMITATION: a free-text address with no comma, or an unusual
-- format, yields the full original string unmasked (regexp_replace
-- returns the input unchanged when the pattern doesn't match) — this is
-- a best-effort mitigation given the product's free-text address input,
-- not a guarantee against every possible address format. Exact
-- structured area/district selection would close this gap fully but
-- requires a UI change, explicitly out of scope here.
update public.job_posts
set area_label = nullif(regexp_replace(btrim(address), '^[^,]+,\s*', ''), '')
where area_label is null;

-- Rows where the regexp above still left area_label null (empty/no-comma
-- address) fall back to the raw address — nothing worse than before this
-- migration for that edge case, and the view's own coalesce (below)
-- covers it defensively too.
update public.job_posts
set area_label = address
where area_label is null;

comment on column public.job_posts.area_label is
  'Coarse, public-safe location text (best-effort — strips the first comma-delimited segment of `address`). Shown to Providers browsing the open feed before they are the job''s customer/assigned provider; see job_posts_feed.';

-- ============================================================
-- job_posts_feed — same rows as job_posts' own RLS already allows,
-- `address` masked to `area_label` for anyone who is not this row's
-- customer_id or provider_id.
-- ============================================================
create or replace view public.job_posts_feed as
select
  id,
  customer_id,
  customer_name,
  category,
  description,
  case
    when auth.uid() = customer_id or auth.uid() = provider_id then address
    else coalesce(area_label, '')
  end as address,
  (auth.uid() = customer_id or auth.uid() = provider_id) as address_is_exact,
  date,
  status,
  photos,
  provider_id,
  provider_name,
  agreed_price,
  dispute_reason,
  cancellation_actor,
  preferred_date,
  time_slot,
  created_at
from public.job_posts;

alter view public.job_posts_feed set (security_invoker = true);

grant select on public.job_posts_feed to authenticated;

comment on view public.job_posts_feed is
  'job_posts with `address` masked to the coarse `area_label` for any caller who is not this row''s own customer_id/provider_id. security_invoker=true — row visibility is still entirely governed by job_posts'' own RLS for the querying user; this view only changes the address column''s value per row. Used by the Provider job feed (open/browse reads); Customer''s-own-jobs and a Provider''s-own-assigned-jobs reads may keep querying job_posts directly since those rows always resolve to the true address anyway.';
