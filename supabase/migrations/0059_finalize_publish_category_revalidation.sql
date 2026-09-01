-- 0059_finalize_publish_category_revalidation.sql
-- Fourth hardening pass, item 2. create_job() (0053) validates that
-- `category` exists and is_active=true at DRAFT-CREATION time — but a
-- draft can sit unpublished for an arbitrary amount of time before
-- finalize_job_publish() is called (the Customer closes the app mid-flow,
-- a slow photo upload, a retried publish after a lost network response,
-- etc.). If the category is deactivated in that window (categories.
-- is_active, 0043 — the only lever this schema has for retiring a
-- category), the draft could still be published with a now-inactive
-- category, since finalize_job_publish() never re-checked it.
--
-- Fix: finalize_job_publish() now re-validates the draft's own
-- `category` against `categories.is_active` immediately before flipping
-- status, inside the same `for update`-locked transaction as the status
-- change itself — no window between the check and the write. A category
-- that was deleted outright (not just deactivated) is also caught, since
-- the `exists (...)` check requires a matching row at all.

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

  -- NEW — re-validate the category is still a real, active one at the
  -- moment of publish, not just at draft-creation time (0053).
  if not exists (
    select 1 from public.categories c where c.id = v_job.category and c.is_active = true
  ) then
    raise exception 'This job''s category is no longer available — please choose a different category and try again';
  end if;

  update public.job_posts set status = 'pending' where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.finalize_job_publish(uuid) is
  'Flips a draft job to pending, making it visible in get_open_provider_feed() for the first time and firing on_job_post_publish_notify (0058). Owner-only, draft-only, and re-validates category.is_active immediately before the write (0059) — a draft''s category can have been deactivated in the time between create_job() and this call. Calling it twice (e.g. a client retry after the first call actually succeeded but the response was lost) raises a clear error rather than silently double-publishing, since the second call will find status already pending.';

-- Grants are unchanged from 0053 (CREATE OR REPLACE preserves them), but
-- restated explicitly for self-containment, matching this project's
-- established convention (CLAUDE.md #97's own item-9 self-audit made the
-- same call for a near-identical case).
revoke execute on function public.finalize_job_publish(uuid) from public, anon;
grant execute on function public.finalize_job_publish(uuid) to authenticated;
