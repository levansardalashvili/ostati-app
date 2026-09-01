-- 0063_finalize_publish_category_lock.sql
-- Final pre-beta audit, item 2. finalize_job_publish() (0053, category
-- re-check added in 0059) does a plain, unlocked `exists(...)` read of
-- `categories.is_active` between locking the job_posts row (`for update`)
-- and writing `status = 'pending'`. Under READ COMMITTED (Postgres'
-- default, unchanged in this project), a concurrent
-- `UPDATE categories SET is_active = false` that commits in the narrow
-- window between that check and the write would not be seen by this
-- check, and the job would still be published with a category that is,
-- by the time the transaction commits, already inactive.
--
-- This is a real but low-severity race (requires an admin/service_role
-- deactivation to land within a few milliseconds of a specific finalize
-- call, and is_active only gates NEW-job eligibility, not anything
-- security-sensitive — no cross-user data exposure either way). Still, a
-- simple transactional fix is available and cheap: `for share` locks the
-- matching categories row for the remainder of this transaction, so a
-- concurrent `UPDATE categories SET is_active = false` on that exact row
-- blocks until finalize_job_publish() commits or rolls back — closing the
-- window entirely rather than narrowing it.
--
-- update_job_draft() (0062) and create_job() (0053) are NOT changed the
-- same way — they only ever affect an invisible draft row; a category
-- being deactivated in the gap between their own check and write has no
-- externally-visible effect, since finalize_job_publish() re-validates
-- the category again anyway, with the lock, right before the row
-- actually becomes visible to anyone.

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

  -- NEW — `for share` locks the matching categories row so a concurrent
  -- deactivation cannot land between this check and the status write
  -- below; the lock is released automatically when this transaction ends
  -- (commit or rollback).
  if not exists (
    select 1 from public.categories c where c.id = v_job.category and c.is_active = true for share
  ) then
    raise exception 'This job''s category is no longer available — please choose a different category and try again';
  end if;

  update public.job_posts set status = 'pending' where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.finalize_job_publish(uuid) is
  'Flips a draft job to pending, making it visible in get_open_provider_feed() for the first time and firing on_job_post_publish_notify (0058). Owner-only, draft-only, and re-validates categories.is_active with a `for share` row lock (0063) immediately before the write — closing the race window against a concurrent category deactivation, not just narrowing it. Calling it twice raises a clear error rather than silently double-publishing, since the second call will find status already pending.';

revoke execute on function public.finalize_job_publish(uuid) from public, anon;
grant execute on function public.finalize_job_publish(uuid) to authenticated;
