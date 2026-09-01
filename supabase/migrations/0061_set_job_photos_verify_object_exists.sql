-- 0061_set_job_photos_verify_object_exists.sql
-- Fourth hardening pass, item 4. Audit finding: set_job_photos() (0050,
-- hardened in 0054) validates that every reference's STRING matches the
-- exact `private-media://job/{this job}/{auth.uid()}/...` prefix shape —
-- but never confirmed that an object with that exact name was actually
-- uploaded. A Customer could attach a well-formed but entirely
-- fabricated reference (a filename that was never uploaded, or one they
-- typo'd/edited client-side) and the RPC would accept it. This is not a
-- cross-user access issue (the path is still scoped to their own job and
-- their own uid — 0054/0055's ownership guarantees are untouched), but a
-- data-integrity one: the job would end up "with a photo" that resolves
-- to nothing (SecureStorageImage's createSignedUrl would fail/404 for
-- that reference at display time).
--
-- Fix: each reference must now also correspond to a REAL row in
-- `storage.objects` (bucket_id='private-media', name = the path after
-- the `private-media://` prefix) — checked in the same transaction as
-- the rest of set_job_photos()'s validation, after the prefix/ownership
-- check (which already guarantees the path COULD only belong to this
-- job/uploader; this adds "and it actually exists"). All of 0054's
-- existing checks (role=customer, ownership, status=draft, max 3, exact
-- prefix match) are preserved unchanged — this only ADDS a check, it
-- narrows nothing that was previously accepted for a legitimately
-- uploaded photo.

create or replace function public.set_job_photos(p_job_id uuid, p_photos text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.job_posts%rowtype;
  v_prefix text;
  v_private_prefix text := 'private-media://';
  v_photo text;
  v_object_name text;
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
  -- uploaded by exactly THIS caller (unchanged, 0054), AND now must
  -- actually exist as an uploaded object (new, 0061) — never an arbitrary
  -- string, another job's/user's reference, or a fabricated/typo'd
  -- filename that was never really uploaded.
  v_prefix := v_private_prefix || 'job/' || p_job_id::text || '/' || auth.uid()::text || '/';
  foreach v_photo in array p_photos loop
    if v_photo is null or v_photo !~~ (v_prefix || '%') or length(v_photo) <= length(v_prefix) then
      raise exception 'Invalid photo reference — must be this job''s own private-media upload';
    end if;

    v_object_name := substring(v_photo from length(v_private_prefix) + 1);
    if not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'private-media' and o.name = v_object_name
    ) then
      raise exception 'Photo reference does not correspond to an uploaded object — upload it before attaching it to the job';
    end if;
  end loop;

  update public.job_posts set photos = p_photos where id = p_job_id;
end;
$$;

comment on function public.set_job_photos(uuid, text[]) is
  'Attaches uploaded private-storage photo references to a DRAFT job. Requires caller.role=customer, ownership, status=draft, at most 3 references, and every reference must exactly match private-media://job/{this job id}/{auth.uid()}/... AND correspond to a real, actually-uploaded storage.objects row (0061) — arbitrary strings, another job''s/user''s references, and fabricated/never-uploaded filenames are all rejected. Legacy public job-photos URLs are not accepted here.';

revoke execute on function public.set_job_photos(uuid, text[]) from public, anon;
grant execute on function public.set_job_photos(uuid, text[]) to authenticated;
