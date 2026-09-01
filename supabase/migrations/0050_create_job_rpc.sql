-- 0050_create_job_rpc.sql
-- Second hardening pass, items 6 and 7. Job creation moves from a
-- direct client `.insert()` (governed only by a row-level RLS check,
-- `customer_id = auth.uid() and role='customer'` as of 0045) to a
-- SECURITY DEFINER RPC — the cleaner authorization boundary the task
-- asks for, because several NEW invariants need validating that a plain
-- INSERT policy cannot express at all (category must exist and be
-- active; if a date is picked, a valid time_slot is mandatory; address
-- must be non-empty) or can only express clumsily. Direct client INSERT
-- on job_posts is revoked entirely — create_job() is now the only path,
-- matching this project's established "RPC-only writes" pattern
-- (job_posts.status/provider_id/etc. already worked this way, 0013/0026).
--
-- Photos are attached via a second, small RPC (set_job_photos) rather
-- than accepted as a create_job parameter — job-photo uploads now go to
-- PRIVATE storage (0048) under a `job/{job_id}/...` path that does not
-- exist until the job row itself exists, so photos can only be uploaded
-- (and their private references attached) AFTER creation, not atomically
-- with it. This is a client-visible ordering change (create job row,
-- then upload+attach photos) but not a UI change — PostJobScreen's own
-- "გამოქვეყნება" flow still reads as one action to the user.

revoke insert on public.job_posts from authenticated;
drop policy if exists "Customer can create own jobs" on public.job_posts;

create or replace function public.create_job(
  p_category text,
  p_description text,
  p_address text,
  p_date text,
  p_customer_name text,
  p_preferred_date date default null,
  p_time_slot text default null
)
returns public.job_posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_area_label text;
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

  -- Same best-effort coarse-area heuristic as 0047's backfill — kept in
  -- exactly one place conceptually (this is the only path that creates
  -- new rows now).
  v_area_label := nullif(regexp_replace(btrim(p_address), '^[^,]+,\s*', ''), '');
  if v_area_label is null then
    v_area_label := btrim(p_address);
  end if;

  insert into public.job_posts (
    customer_id, customer_name, category, description, address, area_label,
    date, status, photos, preferred_date, time_slot
  ) values (
    auth.uid(), coalesce(p_customer_name, ''), p_category, coalesce(p_description, ''), btrim(p_address), v_area_label,
    coalesce(p_date, ''), 'pending', '{}', p_preferred_date, p_time_slot
  )
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.create_job(text, text, text, text, text, date, text) is
  'The only way to create a job_posts row (direct client INSERT is revoked). Validates: caller.role=customer, non-empty address, category exists and is_active, and (if preferred_date is set) a valid fixed time_slot. Always creates with photos={} and status=pending; area_label is derived server-side from the address for the open-feed masking view (job_posts_feed, 0047).';

revoke execute on function public.create_job(text, text, text, text, text, date, text) from public, anon;
grant execute on function public.create_job(text, text, text, text, text, date, text) to authenticated;

create or replace function public.set_job_photos(p_job_id uuid, p_photos text[])
returns void
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

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can set photos';
  end if;
  if v_job.status <> 'pending' then
    raise exception 'Photos can only be set while the job is still pending';
  end if;

  update public.job_posts set photos = coalesce(p_photos, '{}') where id = p_job_id;
end;
$$;

comment on function public.set_job_photos(uuid, text[]) is
  'Attaches uploaded private-storage photo references to a job right after create_job() — split out because job-photo uploads (0048) are scoped under job/{job_id}/..., which does not exist until the job row itself does. Owner-only, and only while the job is still pending.';

revoke execute on function public.set_job_photos(uuid, text[]) from public, anon;
grant execute on function public.set_job_photos(uuid, text[]) to authenticated;
