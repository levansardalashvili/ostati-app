-- 0054_harden_set_job_photos.sql
-- Third hardening pass, PRIORITY 5. The old set_job_photos() (0050) only
-- checked ownership + status — it accepted `p_photos` as opaque text[]
-- with NO validation of what those strings actually were. A malicious
-- Customer could attach:
--   - more than MAX_PHOTOS=3 references (PostJobScreen's own limit was
--     never enforced server-side),
--   - an arbitrary string/URL that is not a private-media reference at
--     all (nothing renders it usefully, but it pollutes the row), or
--   - most seriously, another job's or another user's REAL private-media
--     reference (e.g. a chat image path they can read, or a photo
--     reference copied from a completely different job) — since nothing
--     verified the reference actually pointed at THIS job's own
--     job/{job_id}/{uid}/... storage prefix, this was a way to make one
--     job_posts row display media it has no legitimate claim to, or to
--     probe for/attach references the caller does not actually own.
--
-- Every NEW reference must now match the exact
-- `private-media://job/{p_job_id}/{auth.uid()}/...` shape (job id AND
-- uploader id both pinned to the call itself) or the whole call is
-- rejected. This RPC only ever serves the initial-publish flow (job is
-- still `draft`, task: "legacy public URLs ... do not need to be accepted
-- by the new publish RPC") — so, unlike SecureStorageImage's read-side
-- pass-through, there is no legacy-URL exception here at all.

create or replace function public.set_job_photos(p_job_id uuid, p_photos text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_prefix text;
  v_photo text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'customer') then
    raise exception 'Only a Customer account can set job photos';
  end if;

  select * into v_job from public.job_posts where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.customer_id <> auth.uid() then
    raise exception 'Only the job owner can set photos';
  end if;
  if v_job.status <> 'draft' then
    raise exception 'Photos can only be set while the job is still a draft';
  end if;

  if p_photos is null then
    update public.job_posts set photos = '{}' where id = p_job_id;
    return;
  end if;

  if array_length(p_photos, 1) > 3 then
    raise exception 'A job may have at most 3 photos';
  end if;

  -- Every reference must point at exactly THIS job's own upload prefix,
  -- uploaded by exactly THIS caller — never another job's or another
  -- user's private-media reference, and never an arbitrary string/URL.
  v_prefix := 'private-media://job/' || p_job_id::text || '/' || auth.uid()::text || '/';
  foreach v_photo in array p_photos loop
    if v_photo is null or v_photo !~~ (v_prefix || '%') or length(v_photo) <= length(v_prefix) then
      raise exception 'Invalid photo reference — must be this job''s own private-media upload';
    end if;
  end loop;

  update public.job_posts set photos = p_photos where id = p_job_id;
end;
$$;

comment on function public.set_job_photos(uuid, text[]) is
  'Attaches uploaded private-storage photo references to a DRAFT job (draft-only — the publish flow''s photo-attach step; not a general-purpose "edit job photos" RPC). Requires caller.role=customer, ownership, at most 3 references, and every reference must exactly match private-media://job/{this job id}/{auth.uid()}/... — arbitrary strings, another job''s references, or another user''s references are all rejected. Legacy public job-photos URLs are not accepted here (read-side rendering for historical rows is unaffected, see SecureStorageImage.tsx).';

revoke execute on function public.set_job_photos(uuid, text[]) from public, anon;
grant execute on function public.set_job_photos(uuid, text[]) to authenticated;
