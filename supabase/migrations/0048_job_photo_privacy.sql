-- 0048_job_photo_privacy.sql
-- Second hardening pass, item 4. Job photos (`job_posts.photos`) were
-- uploaded to the PUBLIC `job-photos` bucket (permanent public URLs,
-- anyone who knows/guesses the URL can view — same class of gap 0075's
-- decision log already flagged and left deliberately unfixed for chat/
-- rating media until #90 closed it). New job-photo uploads move to the
-- existing `private-media` bucket, same stable-reference + signed-URL
-- architecture as chat images (0040) and completion/rating photos
-- (0040) — path prefix `job/{job_id}/{uploader_id}/{filename}`.
--
-- Access rule is intentionally BROADER than the chat/completion media
-- while a job is pending — every Provider is allowed to view job photos
-- while browsing the open feed (this is existing, intended product
-- behavior: PostJobScreen's own privacy copy says a Provider sets their
-- price "after viewing the description and photos" — a Provider cannot
-- meaningfully quote without seeing them, and this is unrelated to
-- whether they have expressed interest yet). Once the job is no longer
-- pending, only the Customer and the assigned Provider keep access.
--
-- Legacy job photos (already-uploaded public `job-photos` URLs) are
-- untouched and keep rendering exactly as before — SecureStorageImage.tsx
-- already passes through any non-`private-media://`-prefixed value
-- unchanged (task: "Do not break legacy public URLs").

create or replace function public.can_access_private_job_photo(p_job_id uuid)
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
      and (
        jp.customer_id = auth.uid()
        or jp.provider_id = auth.uid()
        or (
          jp.status = 'pending'
          and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider')
        )
      )
  );
$$;

comment on function public.can_access_private_job_photo(uuid) is
  'Storage RLS helper for private-media/job/... — the job''s own Customer (always), the assigned Provider (always, even after the job leaves pending), or any Provider account while the job is still status=pending (open-feed browsing, matching product behavior: a Provider must be able to see photos before quoting a price).';

revoke execute on function public.can_access_private_job_photo(uuid) from public, anon;
grant execute on function public.can_access_private_job_photo(uuid) to authenticated;

drop policy if exists "Private job photo insert" on storage.objects;
drop policy if exists "Private job photo select" on storage.objects;

-- path: job/{job_id}/{uploader_id}/{filename}
create policy "Private job photo insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'job'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.can_access_private_job_photo(((storage.foldername(name))[2])::uuid)
);

create policy "Private job photo select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'job'
  and public.can_access_private_job_photo(((storage.foldername(name))[2])::uuid)
);
