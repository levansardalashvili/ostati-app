-- 0024_storage_ownership_policies.sql
-- Task 1 — Storage security audit. Both Storage buckets this app uses
-- (`job-photos`, `user-media` — covering job photos, profile photos,
-- certificates, portfolio, review/completed-work photos, and chat
-- images; see src/services/storageService.ts's UserMediaKind) were
-- created via the Supabase Dashboard (CLAUDE.md #61/#62) with only a
-- blanket "INSERT to authenticated" policy on `storage.objects` — no
-- path/ownership check at all. That means ANY signed-in client could
-- upload (and, if ever called with `upsert:true`, overwrite) an object
-- under ANY other user's folder in either bucket, e.g.
-- `job-photos/<someone-else's-uid>/x.jpg`.
--
-- Both buckets already namespace every object under the uploader's own
-- uid as a path segment (storageService.ts: `job-photos` uses
-- `{uid}/{file}`, `user-media` uses `{kind}/{uid}/{file}`) — the app's
-- upload paths were already correct, they just weren't enforced. This
-- migration adds the missing enforcement: INSERT/UPDATE/DELETE are now
-- restricted to objects whose path's uid segment equals auth.uid().
-- `storage.foldername(name)` returns the path split into an array of
-- folder segments (excluding the filename) — index 1 for `job-photos`
-- (`{uid}/...`), index 2 for `user-media` (`{kind}/{uid}/...`).
--
-- NOT changed: both buckets stay PUBLIC (read/SELECT is served via the
-- public `/storage/v1/object/public/...` URL path, which bypasses
-- `storage.objects` RLS entirely for public buckets) — this migration
-- only tightens who can WRITE, not who can read, so no existing
-- `getPublicUrl()`-based `<Image>` rendering anywhere in the app is
-- affected. A privacy improvement (making user-media/job-photos private
-- with signed URLs, so a raw guessed/leaked link can't be viewed by
-- anyone) is a real, separate future improvement — see supabase/README.md.

drop policy if exists "Owner can upload own job photos" on storage.objects;
create policy "Owner can upload own job photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owner can update own job photos" on storage.objects;
create policy "Owner can update own job photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owner can delete own job photos" on storage.objects;
create policy "Owner can delete own job photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'job-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Owner can upload own user media" on storage.objects;
create policy "Owner can upload own user media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'user-media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "Owner can update own user media" on storage.objects;
create policy "Owner can update own user media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[2] = auth.uid()::text)
  with check (bucket_id = 'user-media' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "Owner can delete own user media" on storage.objects;
create policy "Owner can delete own user media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'user-media' and (storage.foldername(name))[2] = auth.uid()::text);

-- *** REQUIRED MANUAL STEP — read this, the fix above does nothing without it ***
-- Postgres RLS OR-combines every permissive policy for the same
-- command: if the OLD blanket "any authenticated user can INSERT"
-- policy (created via Dashboard -> Storage when these buckets were
-- first set up, CLAUDE.md #61/#62) is still active alongside the new,
-- narrower policies above, uploads are STILL allowed to any path —
-- the old policy alone is enough to grant access, regardless of what
-- this migration adds. This migration does not know that old policy's
-- exact name (it was created by hand, not by a prior migration file in
-- this repo) and only DROPs policies it created itself, so it cannot
-- safely guess-and-delete it for you.
--
-- After running this file, go to Supabase Dashboard -> Storage ->
-- Policies for both `job-photos` and `user-media`, and delete any
-- pre-existing INSERT (and UPDATE, if one was ever added) policy that
-- is NOT one of the six created above (their names all start with
-- "Owner can ..."). Until that old policy is removed, this migration
-- has added defense but not yet closed the hole.
