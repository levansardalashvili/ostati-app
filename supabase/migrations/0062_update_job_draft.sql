-- 0062_update_job_draft.sql
-- Final pre-beta audit, item 1. CONFIRMED integrity bug: PostJobScreen's
-- retry flow (third hardening pass, 0053) keeps `draftJob` in React state
-- across a failed publish attempt and resumes from it — but if the
-- Customer edits category/description/address/date/time BEFORE retrying
-- Publish, the resumed flow never pushed those new values back to the
-- already-created draft row: it only re-ran photo upload/set_job_photos/
-- finalize_job_publish() against the STALE row created by the original
-- create_job() call. The published job could therefore silently retain
-- old field values the UI no longer showed, with no error and no
-- indication to the Customer that their edits were dropped.
--
-- Fix: new owner-only update_job_draft() RPC, mirroring create_job()'s
-- (0053) validation exactly. PostJobScreen (updated alongside this
-- migration) now calls it every time it resumes an existing draftJob,
-- syncing the CURRENT form state into the draft immediately before
-- photos/finalize — so whatever the form shows at the moment Publish is
-- pressed is what actually gets published, regardless of how many failed
-- attempts or edits happened in between.

create or replace function public.update_job_draft(
  p_job_id uuid,
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
  v_job public.job_posts%rowtype;
  v_description text;
  v_area_label text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can edit a job draft';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can edit this draft';
  end if;
  -- "Do not allow changing a job after it becomes pending" — draft-only,
  -- exactly like set_job_photos() (0054): once finalize_job_publish() has
  -- run, this RPC can no longer touch the row at all.
  if v_job.status <> 'draft' then
    raise exception 'Only a draft job can be edited (status=%)', v_job.status;
  end if;

  -- Same validation as create_job() (0053/0059), unchanged.
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

  -- Area label recomputed server-side from the (possibly changed)
  -- address — never left stale from the original create_job() call.
  v_area_label := public.job_safe_area_label(p_address);

  update public.job_posts
  set
    category = p_category,
    description = v_description,
    address = btrim(p_address),
    area_label = v_area_label,
    date = coalesce(p_date, ''),
    preferred_date = p_preferred_date,
    time_slot = p_time_slot
  where id = p_job_id
  returning * into v_job;

  return v_job;
end;
$$;

comment on function public.update_job_draft(uuid, text, text, text, text, date, text) is
  'Syncs current form values into an existing DRAFT job before publish (owner-only, draft-only — raises once the job is pending or beyond). Same validation as create_job()/finalize_job_publish(): description 20..500, non-empty address, active category, preferred_date<->time_slot consistency; area_label is recomputed server-side. customer_id/customer_name are never touched here (identity was already server-derived at create_job() time and does not change on edit).';

revoke execute on function public.update_job_draft(uuid, text, text, text, text, date, text) from public, anon;
grant execute on function public.update_job_draft(uuid, text, text, text, text, date, text) to authenticated;
