-- 0086 — მომლოდინე (pending, ოსტატი ჯერ არჩეული არაა) განცხადების რედაქტირება.
-- update_job_draft()-ის იგივე ვალიდაცია, მაგრამ სტატუსი 'pending' უნდა იყოს —
-- არჩევის (active) შემდეგ ვეღარ შეიცვლება. ფოტოები არ ეხება.

create or replace function public.update_pending_job(
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
    raise exception 'Only a Customer account can edit a job';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can edit this job';
  end if;
  -- run, this RPC can no longer touch the row at all.
  if v_job.status <> 'pending' then
    raise exception 'Only a pending job can be edited (status=%)', v_job.status;
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
comment on function public.update_pending_job(uuid, text, text, text, text, date, text) is
  'Edits an existing PENDING job (owner-only; raises once a Provider is selected or the job is otherwise past pending). Same validation as update_job_draft(): description 20..500, non-empty address, active category, preferred_date<->time_slot consistency; area_label is recomputed server-side. Photos are not touched.';

revoke execute on function public.update_pending_job(uuid, text, text, text, text, date, text) from public, anon;
grant execute on function public.update_pending_job(uuid, text, text, text, text, date, text) to authenticated;
