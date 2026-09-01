-- 0055_split_job_photo_storage_auth.sql
-- Third hardening pass, PRIORITY 6. The private job-photo storage INSERT
-- policy (0048) reused can_access_private_job_photo() — correct for
-- SELECT (job Customer always, any Provider while the job is pending, the
-- assigned Provider after selection), but wrong for INSERT: it let ANY
-- Provider account upload objects under `job/{job_id}/{their own uid}/...`
-- for a job that isn't theirs, as long as that job happened to be
-- 'pending' — i.e. any Provider could write into (consume storage quota
-- under) any open Customer's job path. Nothing in this product ever has a
-- Provider legitimately UPLOAD a job photo (only the Customer does, via
-- PostJobScreen) — only the read side needed to be broad.
--
-- New rule, split from the read rule:
--   INSERT — only the job's own Customer, and only while status='draft'
--            (matches set_job_photos()'s own restriction, 0054 — this IS
--            the publish flow's upload step, not a general-purpose one).
--   SELECT — unchanged (can_access_private_job_photo, 0048): Customer
--            always, any Provider while pending, assigned Provider always.

create or replace function public.can_upload_private_job_photo(p_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.job_posts jp
    where jp.id = p_job_id
      and jp.customer_id = auth.uid()
      and jp.status = 'draft'
  );
$$;

comment on function public.can_upload_private_job_photo(uuid) is
  'Storage RLS helper for private-media/job/... INSERT only — the job''s own Customer, and only while the job is still a draft (the publish flow''s own upload step). Deliberately narrower than can_access_private_job_photo() (SELECT), which stays broad for quoting Providers to be able to VIEW photos — nobody but the owning Customer may ever WRITE into a job''s photo path.';

revoke execute on function public.can_upload_private_job_photo(uuid) from public, anon;
grant execute on function public.can_upload_private_job_photo(uuid) to authenticated;

drop policy if exists "Private job photo insert" on storage.objects;

create policy "Private job photo insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'job'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.can_upload_private_job_photo(((storage.foldername(name))[2])::uuid)
);

-- "Private job photo select" (0048, can_access_private_job_photo) is
-- unchanged — no edit needed here.
