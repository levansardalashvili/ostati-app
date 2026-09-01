-- 0052_secure_provider_job_feed.sql
-- Third hardening pass, PRIORITY 1. Real gap: `job_posts_feed` (0047) is a
-- `security_invoker = true` VIEW — it does NOT grant any extra row access
-- by itself, it only reshapes the `address` column. Which ROWS are visible
-- through it is still entirely governed by `job_posts`' OWN RLS policies,
-- evaluated as the querying user. Migration 0004 gave every Provider
-- account a direct SELECT policy on ALL pending rows of the base table
-- ("Provider can read open jobs") — so a Provider was never actually
-- required to go through the view at all. A raw
-- `supabase.from('job_posts').select('address').eq('status','pending')`
-- (or any direct REST/RPC call, Postgres client, curl with the anon/
-- authenticated JWT) bypassed the masking entirely. "The mobile app
-- queries job_posts_feed" was a UI convention, never a security boundary.
--
-- Fix: remove the Provider's direct base-table SELECT policy for pending
-- rows. The base table now only grants row access to a job's own Customer
-- and its assigned Provider (unchanged, matches "exact rows readable only
-- by the job Customer / the assigned Provider" from the task). Provider
-- open-job BROWSING moves to two new SECURITY DEFINER functions that
-- return ONLY the approved public feed columns (never the raw `address`)
-- regardless of what RLS the base table has — these functions ARE the
-- security boundary now, not a client convention.

-- ============================================================
-- Remove the leaky direct-table policy.
-- ============================================================
drop policy if exists "Provider can read open jobs" on public.job_posts;

-- Defensive — this migration (and 0053 after it) must not hard-depend on
-- every earlier migration having actually been applied to this specific
-- database. get_open_provider_feed()/get_feed_job_by_id() below select
-- agreed_price/dispute_reason (0011), cancellation_actor (0036),
-- preferred_date/time_slot (0041), and area_label (0047) by name — if any
-- of those were skipped on this database, function CREATE would fail with
-- the same "column does not exist" error area_label just did. Each of
-- these repeats an EARLIER migration's own `add column if not exists`
-- verbatim, so re-running them here is a safe no-op wherever the original
-- migration already succeeded, and a real fix wherever it didn't.
alter table public.job_posts add column if not exists agreed_price numeric;
alter table public.job_posts add column if not exists dispute_reason text;
alter table public.job_posts add column if not exists cancellation_actor text;
alter table public.job_posts add column if not exists preferred_date date;
alter table public.job_posts add column if not exists time_slot text;
alter table public.job_posts add column if not exists area_label text;

-- ============================================================
-- Fix the unsafe area_label fallback (0047 fell back to the raw,
-- unmasked address when no comma-delimited segment could be stripped —
-- exactly a free-text/no-comma address, which is a realistic case for
-- this product's manually-typed address field, not just an edge case).
-- Centralized here as a reusable helper so both the historical backfill
-- below AND create_job() (rewritten in 0053) derive area_label the same,
-- safe way in exactly one place.
-- ============================================================
create or replace function public.job_safe_area_label(p_address text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_address is null or btrim(p_address) = '' then 'მისამართი მითითებული არ არის'
    when nullif(regexp_replace(btrim(p_address), '^[^,]+,\s*', ''), '') is not null
      and regexp_replace(btrim(p_address), '^[^,]+,\s*', '') <> btrim(p_address)
    then regexp_replace(btrim(p_address), '^[^,]+,\s*', '')
    -- No comma-delimited segment could be safely stripped (free-text/
    -- single-segment address) — NEVER fall back to the raw address.
    else 'ზუსტი რაიონი მიუწვდომელია'
  end;
$$;

comment on function public.job_safe_area_label(text) is
  'Coarse, public-safe location label derived from a free-text exact address (best-effort: strips the first comma-delimited segment). Falls back to a deliberately generic "district unavailable" string — never the raw address — when no comma-delimited segment exists to strip. Used by job_posts.area_label backfill/creation and the Provider open-feed functions below.';

-- Purely internal helper — only ever called from within another SECURITY
-- DEFINER function's body (get_open_provider_feed/get_feed_job_by_id
-- below, create_job in 0053) or from a migration's own DDL-time UPDATE,
-- never directly by client code. Matches this project's existing
-- convention for internal SQL helpers (job_scheduled_start,
-- job_category_label, specialty_to_category, CLAUDE.md #96) — NO grant to
-- any client-facing role at all, not even `authenticated`. A nested call
-- from inside a SECURITY DEFINER function runs under that function's
-- elevated (definer) privileges regardless of this table's grants, so the
-- calls above are unaffected.
revoke execute on function public.job_safe_area_label(text) from public, anon, authenticated;

-- Recompute every row whose area_label is currently null OR (the old,
-- unsafe 0047 fallback) equal to the raw address itself — i.e. every row
-- that was, or could have been, leaking the exact address as its "coarse"
-- label.
update public.job_posts
set area_label = public.job_safe_area_label(address)
where area_label is null or area_label = address;

comment on column public.job_posts.area_label is
  'Coarse, public-safe location text (public.job_safe_area_label(address)) — NEVER the raw address when no safe coarse segment can be derived. Shown to Providers browsing the open feed; see get_open_provider_feed()/get_feed_job_by_id() below.';

-- ============================================================
-- get_open_provider_feed() — the ONLY way a Provider account reads other
-- Customers' pending jobs now. SECURITY DEFINER: bypasses job_posts' RLS
-- internally (which no longer grants Providers any pending-row access at
-- all), but the function body itself hard-filters to status='pending' and
-- projects only the approved public columns — `address` is always
-- area_label here, never the real column, regardless of caller.
-- ============================================================
create or replace function public.get_open_provider_feed()
returns table (
  id uuid,
  customer_id uuid,
  customer_name text,
  category text,
  description text,
  address text,
  address_is_exact boolean,
  date text,
  status text,
  photos text[],
  provider_id uuid,
  provider_name text,
  agreed_price numeric,
  dispute_reason text,
  cancellation_actor text,
  preferred_date date,
  time_slot text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can browse the open job feed';
  end if;

  return query
  select
    jp.id, jp.customer_id, jp.customer_name, jp.category, jp.description,
    coalesce(jp.area_label, public.job_safe_area_label(jp.address)) as address,
    false as address_is_exact,
    jp.date, jp.status, jp.photos, jp.provider_id, jp.provider_name,
    jp.agreed_price, jp.dispute_reason, jp.cancellation_actor,
    jp.preferred_date, jp.time_slot, jp.created_at
  from public.job_posts jp
  where jp.status = 'pending'
  order by jp.created_at desc;
end;
$$;

comment on function public.get_open_provider_feed() is
  'Provider-facing open job feed. SECURITY DEFINER so it does not depend on job_posts granting Providers any base-table row access (it no longer does) — this function itself is the security boundary. Caller must be an authenticated Provider account. Returns only pending jobs, address always masked to area_label, never the exact address.';

revoke execute on function public.get_open_provider_feed() from public, anon;
grant execute on function public.get_open_provider_feed() to authenticated;

-- ============================================================
-- get_feed_job_by_id() — single-row equivalent, used for deep-link/route-
-- param fallbacks (ProviderJobDetailScreen). Replicates the OLD combined
-- job_posts RLS + job_posts_feed masking behavior, but self-contained: row
-- is returned if the caller is the job's own customer/assigned provider
-- (full address), or if the job is still pending and the caller is any
-- Provider account (masked address) — anything else returns no rows.
-- ============================================================
create or replace function public.get_feed_job_by_id(p_job_id uuid)
returns table (
  id uuid,
  customer_id uuid,
  customer_name text,
  category text,
  description text,
  address text,
  address_is_exact boolean,
  date text,
  status text,
  photos text[],
  provider_id uuid,
  provider_name text,
  agreed_price numeric,
  dispute_reason text,
  cancellation_actor text,
  preferred_date date,
  time_slot text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_provider boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  v_is_provider := exists (select 1 from public.users u where u.id = v_uid and u.role = 'provider');

  return query
  select
    jp.id, jp.customer_id, jp.customer_name, jp.category, jp.description,
    case
      when v_uid = jp.customer_id or v_uid = jp.provider_id then jp.address
      else coalesce(jp.area_label, public.job_safe_area_label(jp.address))
    end as address,
    (v_uid = jp.customer_id or v_uid = jp.provider_id) as address_is_exact,
    jp.date, jp.status, jp.photos, jp.provider_id, jp.provider_name,
    jp.agreed_price, jp.dispute_reason, jp.cancellation_actor,
    jp.preferred_date, jp.time_slot, jp.created_at
  from public.job_posts jp
  where jp.id = p_job_id
    and (
      v_uid = jp.customer_id
      or v_uid = jp.provider_id
      or (jp.status = 'pending' and v_is_provider)
    );
end;
$$;

comment on function public.get_feed_job_by_id(uuid) is
  'Single-job read for Provider deep-link/route-param fallbacks. Self-contained row-visibility + address-masking (does not rely on job_posts RLS): visible to the job''s own customer/assigned provider (full address) or, while still pending, to any Provider account (area_label only). No row is returned otherwise.';

revoke execute on function public.get_feed_job_by_id(uuid) from public, anon;
grant execute on function public.get_feed_job_by_id(uuid) to authenticated;

-- ============================================================
-- job_posts_feed (0047) is superseded — as a `security_invoker = true`
-- view it would now return ZERO pending rows to a browsing Provider
-- (the base table no longer grants that access), silently breaking the
-- feed if anything still queried it. Dropped outright rather than left
-- around half-working, so nothing can mistake it for a working access
-- path again (task: "never rely on the mobile app uses the safe view").
-- ============================================================
drop view if exists public.job_posts_feed;
