-- 0076_fix_job_area_label_masking.sql
-- Real privacy bug fix: `job_safe_area_label()` (0052) was only stripping the
-- FIRST comma-delimited segment of the address (the house number) before
-- treating whatever remained as the "safe, coarse" label shown to a Provider
-- who hasn't been assigned/confirmed the price yet. For the typical address
-- shape this app actually stores (`AddressAutocompleteField`'s
-- `shortAddressLabel()`: "house_number, road, neighbourhood", e.g.
-- "12, შორაპნის ქუჩა, ვაკე"), stripping only the house number left the
-- STREET NAME itself in the "coarse" label ("შორაპნის ქუჩა, ვაკე") — not
-- coarse at all, still specific enough to identify the building/block.
--
-- Fix: only trust the LAST comma-delimited segment as the area/neighbourhood
-- name, and only when there are at least 3 segments (house number, street,
-- area) — with fewer than 3 segments the "last" one could still BE the
-- street (e.g. "12, შორაპნის ქუჩა" has only 2 segments), so that case falls
-- back to the same generic "ზუსტი რაიონი მიუწვდომელია" the free-text/
-- no-comma case already used. This is the single source of truth for every
-- Provider-facing masked address — `get_open_provider_feed()` (always
-- masked) and `get_feed_job_by_id()` (masked until the caller is the job's
-- customer or assigned provider) both call this function, and so does
-- `create_job()`/`update_job_draft()` at write time — fixing it here fixes
-- every surface that reads `FeedJob.location` (Job Feed cards, Job Detail,
-- and the in-chat job-summary card) in one place, no client-side change
-- needed.

-- Second pass — the first attempt at this fix (below, superseded before
-- ever shipping to users) blindly trusted the LAST comma segment once >= 3
-- segments existed. Live data revealed a second address shape this app
-- actually stores: a full, untrimmed Nominatim string running all the way
-- through postcode + country ("...,  ისნის რაიონი, თბილისი, 0144,
-- საქართველო") — whose LAST segment is literally "საქართველო" (the
-- country), not remotely a coarse area. Fixed with a two-priority rule
-- instead of a single positional guess:
--   1. Any segment containing the literal word "რაიონი" (district) is
--      always trusted verbatim, wherever it sits in the address — it is
--      inherently already a coarse, safe label.
--   2. Otherwise (the common case for AddressAutocompleteField's own
--      short "house, street, area" format, whose neighbourhood names
--      don't carry a "რაიონი" suffix): trailing postcode (all-digit) and
--      literal "საქართველო" segments are dropped first, and only THEN is
--      the new last segment trusted — and only with >= 3 segments still
--      remaining (house number, street, area), so a 1- or 2-segment
--      address can never have its street mistaken for an area name.
create or replace function public.job_safe_area_label(p_address text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_parts text[];
  v_n int;
  v_part text;
  i int;
begin
  if p_address is null or btrim(p_address) = '' then
    return 'მისამართი მითითებული არ არის';
  end if;

  v_parts := regexp_split_to_array(btrim(p_address), '\s*,\s*');
  v_n := array_length(v_parts, 1);

  -- Priority 1 — an explicit district segment is always safe, regardless
  -- of its position or how many other segments surround it.
  for i in 1..v_n loop
    v_part := btrim(v_parts[i]);
    if v_part like '%რაიონი%' then
      return v_part;
    end if;
  end loop;

  -- Priority 2 — drop trailing postcode/country noise, then trust the new
  -- last segment only with >= 3 real segments left.
  while v_n > 0 and (v_parts[v_n] ~ '^[0-9]+$' or btrim(v_parts[v_n]) = 'საქართველო') loop
    v_n := v_n - 1;
  end loop;
  if v_n >= 3 then
    v_part := btrim(v_parts[v_n]);
    if v_part <> '' then
      return v_part;
    end if;
  end if;

  return 'ზუსტი რაიონი მიუწვდომელია';
end;
$$;

comment on function public.job_safe_area_label(text) is
  'Coarse, public-safe location label derived from a free-text exact address. Priority 1: any segment literally containing "რაიონი" (district) is trusted verbatim wherever it appears. Priority 2: trailing postcode/"საქართველო" segments are dropped, then the new last segment is trusted only with >= 3 segments remaining (house number, street, area) — never fewer, which could still be the street itself. Otherwise falls back to a generic "district unavailable" string, never the raw address. Used by job_posts.area_label backfill/creation and the Provider open-feed functions (get_open_provider_feed/get_feed_job_by_id).';

-- Recompute every existing row — any of them could have been computed with
-- the OLD, under-masking (first-segment-stripped) logic and still be
-- storing a street name in area_label.
update public.job_posts
set area_label = public.job_safe_area_label(address);
