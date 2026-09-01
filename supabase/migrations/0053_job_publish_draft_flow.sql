-- 0053_job_publish_draft_flow.sql
-- Third hardening pass, PRIORITIES 2, 3, 4.
--
-- PRIORITY 2 — the old create_job() (0050) inserted status='pending'
-- immediately, i.e. the job was already live in the Provider feed the
-- instant the row existed, BEFORE photos were uploaded/attached. If the
-- photo upload (or set_job_photos()) step then failed, PostJobScreen's
-- retry called createCustomerJob() again — a second, fully independent
-- 'pending' row, i.e. a duplicate published job; the first, half-finished
-- row was silently orphaned (visible in the feed with photos=[]).
-- Fix: create_job() now inserts status='draft' — a new status value,
-- invisible to every existing Provider-facing read (get_open_provider_feed/
-- get_feed_job_by_id both only ever select status='pending'; every workflow
-- RPC checks for a specific non-draft status) and to every OTHER Customer
-- (RLS unchanged: only the owning Customer can read their own row in any
-- status). A new finalize_job_publish() RPC flips draft -> pending once
-- photos are attached. PostJobScreen (updated alongside this migration)
-- keeps the created draft job's id across a failed retry and resumes from
-- wherever it left off, instead of calling create_job() again — so a
-- network failure/retry can no longer produce two published rows for one
-- Publish tap. See client-side change in src/screens/PostJobScreen.tsx.
--
-- Orphan cleanup: a Customer who creates a draft and then abandons the
-- flow entirely (closes the app before finishing) leaves a status='draft'
-- row behind. This is deliberately NOT auto-deleted (no cron/cleanup job
-- exists in this project's infrastructure, and adding one is out of scope
-- for this pass) — it is inert (invisible to every feed/read path but the
-- owning Customer, and to every workflow RPC, all of which require a
-- non-draft status) and costs one row + up to 3 orphaned private-media
-- objects under job/{draft_id}/{uid}/... per abandoned attempt. Documented
-- here as a known, accepted, low-severity byproduct rather than silently
-- left unexplained.
--
-- PRIORITY 3 — create_job() accepted a client-supplied p_customer_name and
-- wrote it verbatim into job_posts.customer_name (shown to every Provider
-- browsing the feed) — a Customer account could pass literally any string,
-- impersonating a different display name. p_customer_name is removed
-- entirely; customer_name is now always derived server-side from
-- public.users (first_name/last_name for auth.uid()), the same source
-- CustomerProfileContext itself reads from.
--
-- PRIORITY 4 — description length (trim, 20..500, matching PostJobScreen's
-- own DESCRIPTION_MIN/DESCRIPTION_MAX) and "time_slot without
-- preferred_date" are now also validated server-side (address/category/
-- date-requires-slot were already validated in 0050). There is no product
-- reason for a time_slot with no preferred_date — PostJobScreen's own
-- canSubmit already requires a date before a time can even be picked
-- (`!selectedDate || !!selectedTime`) — so this combination is rejected
-- outright, not accepted as some undocumented special case.

alter table public.job_posts drop constraint if exists job_posts_status_check;
alter table public.job_posts
  add constraint job_posts_status_check check (
    status in (
      'draft',
      'pending',
      'active',
      'awaiting_customer_confirmation',
      'confirmed_awaiting_rating',
      'disputed',
      'completed',
      'cancelled'
    )
  );

comment on column public.job_posts.status is
  'draft: create_job() just ran, not yet publish-finalized — invisible to every Provider-facing read and workflow RPC, readable only by the owning Customer. pending: published, open for Provider interest. See finalize_job_publish()/get_open_provider_feed().';

create or replace function public.create_job(
  p_category text,
  p_description text,
  p_address text,
  p_date text,
  p_preferred_date date default null,
  p_time_slot text default null
)
returns public.job_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_name text;
  v_area_label text;
  v_description text;
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can create a job';
  end if;

  if p_address is null or btrim(p_address) = '' then
    raise exception 'An exact address is required';
  end if;

  v_description := btrim(coalesce(p_description, ''));
  if length(v_description) < 20 then
    raise exception 'Description must be at least 20 characters';
  end if;
  if length(v_description) > 500 then
    raise exception 'Description must be at most 500 characters';
  end if;

  if p_category is null or not exists (
    select 1 from public.categories c where c.id = p_category and c.is_active = true
  ) then
    raise exception 'Invalid or inactive category: %', p_category;
  end if;

  if p_preferred_date is not null and (
    p_time_slot is null or p_time_slot not in ('09-12', '12-15', '15-18', '18-21', 'flexible')
  ) then
    raise exception 'A valid time_slot is required when a preferred_date is set';
  end if;
  if p_preferred_date is null and p_time_slot is not null then
    raise exception 'time_slot requires a preferred_date';
  end if;

  -- PRIORITY 3 — never trust a client-supplied display name.
  select btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, ''))
    into v_customer_name
    from public.users u
    where u.id = auth.uid();

  v_area_label := public.job_safe_area_label(p_address);

  insert into public.job_posts (
    customer_id, customer_name, category, description, address, area_label,
    date, status, photos, preferred_date, time_slot
  ) values (
    auth.uid(), coalesce(v_customer_name, ''), p_category, v_description, btrim(p_address), v_area_label,
    coalesce(p_date, ''), 'draft', '{}', p_preferred_date, p_time_slot
  )
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.create_job(text, text, text, text, date, text) is
  'Creates a DRAFT job_posts row (direct client INSERT is revoked, 0050). customer_name is always server-derived from public.users, never client-supplied. Validates: caller.role=customer, non-empty address, description 20..500 trimmed chars, category exists and is_active, preferred_date<->time_slot consistency. Still invisible to every Provider read until finalize_job_publish() flips it to pending.';

-- create_job()'s OLD 7-argument signature (including p_customer_name) is
-- dropped, not just replaced — a stale client build on the old signature
-- will get a clean "function does not exist" from PostgREST rather than
-- silently keep working with an ignored/unused parameter.
drop function if exists public.create_job(text, text, text, text, text, date, text);

revoke execute on function public.create_job(text, text, text, text, date, text) from public, anon;
grant execute on function public.create_job(text, text, text, text, date, text) to authenticated;

-- ============================================================
-- finalize_job_publish() — draft -> pending. The only way a job becomes
-- visible to any Provider. Called after set_job_photos() (or immediately,
-- if the Customer added no photos).
-- ============================================================
create or replace function public.finalize_job_publish(p_job_id uuid)
returns public.job_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  -- Redundant with the ownership check below by construction (job_posts
  -- rows can only ever be created by create_job(), which already requires
  -- role='customer') — kept explicit anyway, matching this project's
  -- established defense-in-depth pattern for every job-workflow RPC
  -- (CLAUDE.md #97).
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can publish a job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can publish it';
  end if;
  if v_job.status <> 'draft' then
    raise exception 'Job is not a draft (already published, or in another state)';
  end if;

  update public.job_posts set status = 'pending' where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.finalize_job_publish(uuid) is
  'Flips a draft job to pending, making it visible in get_open_provider_feed() for the first time. Owner-only, draft-only — calling it twice (e.g. a client retry after the first call actually succeeded but the response was lost) raises a clear error rather than silently double-publishing, since the second call will find status already pending.';

revoke execute on function public.finalize_job_publish(uuid) from public, anon;
grant execute on function public.finalize_job_publish(uuid) to authenticated;

-- Note: "Customer can read own jobs" (0004) is intentionally left
-- unrestricted by status — the owner must still be able to read their OWN
-- draft directly (PostJobScreen resumes a failed publish attempt by
-- re-fetching the job it already created). RLS governs row ACCESS, not
-- which rows a particular query chooses to ask for, so excluding drafts
-- from "my jobs" lists is a query-shape concern, not a security one — see
-- jobService.listMyJobPosts()'s explicit `.neq('status', 'draft')`
-- (src/services/jobService.ts) so a draft never renders as if it were a
-- real posted job in CustomerJobsScreen/CustomerHomeScreen/the Profile
-- badge count.
