-- 0107_provider_verification_selfie.sql
--
-- Manual, admin-reviewed selfie verification (decided against a paid
-- third-party KYC/liveness provider — see CLAUDE.md memory note on cost).
-- Provider takes a live selfie (front camera) when requesting
-- verification; admin compares it next to the existing public profile
-- photo (provider_profiles.photo_url, already shown in the admin queue)
-- and approves/rejects by eye via the existing
-- admin_review_provider_verification() RPC (unchanged).

alter table public.provider_verification_requests
  add column if not exists selfie_path text;

-- ============================================================
-- request_provider_verification(p_selfie_path) — now requires a selfie.
-- Same unverified/rejected -> pending transition as 0051; only the extra
-- required argument is new.
-- ============================================================
drop function if exists public.request_provider_verification();

create or replace function public.request_provider_verification(p_selfie_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider public.provider_profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(coalesce(p_selfie_path, '')), '') is null then
    raise exception 'Selfie photo is required';
  end if;

  if not exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'provider') then
    raise exception 'Only a Provider account can request verification';
  end if;

  select * into v_provider from public.provider_profiles where id = auth.uid() for update;
  if v_provider.id is null then
    raise exception 'Complete your provider profile before requesting verification';
  end if;

  if v_provider.verification_status not in ('unverified', 'rejected') then
    raise exception 'Verification cannot be requested from status "%"', v_provider.verification_status;
  end if;

  update public.provider_profiles
  set verification_status = 'pending'
  where id = auth.uid();

  insert into public.provider_verification_requests (provider_id, requested_at, rejection_reason, selfie_path)
  values (auth.uid(), now(), null, p_selfie_path)
  on conflict (provider_id) do update set
    requested_at = excluded.requested_at,
    rejection_reason = null,
    selfie_path = excluded.selfie_path;
end;
$$;

comment on function public.request_provider_verification(text) is
  'Provider requests a verification review with a required selfie storage path: unverified -> pending or rejected -> pending only. Server always sets verification_status to the literal ''pending''.';

revoke execute on function public.request_provider_verification(text) from public, anon;
grant execute on function public.request_provider_verification(text) to authenticated;

-- ============================================================
-- Storage — verification/{uid}/{filename} in the existing private-media
-- bucket (0040). Owner can write their own; owner + admin can read.
-- ============================================================

drop policy if exists "Private verification selfie insert" on storage.objects;
create policy "Private verification selfie insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'verification'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Private verification selfie select" on storage.objects;
create policy "Private verification selfie select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'verification'
  and (
    (storage.foldername(name))[2] = auth.uid()::text
    or public.is_admin()
  )
);

-- ============================================================
-- Account deletion cleanup (0101) — verification selfies are the user's
-- own private upload, same as chat/job/completion media.
-- ============================================================
create or replace function public.private_media_paths_for_user(p_uid uuid)
returns setof text language sql stable security definer set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'private-media'
    and (
      (split_part(o.name, '/', 1) = 'chat'
        and (split_part(o.name, '/', 2) = p_uid::text or split_part(o.name, '/', 3) = p_uid::text))
      or (split_part(o.name, '/', 1) in ('job', 'completion')
        and (split_part(o.name, '/', 3) = p_uid::text
          or exists (select 1 from public.job_posts jp
                      where jp.id::text = split_part(o.name, '/', 2) and jp.customer_id = p_uid)))
      or (split_part(o.name, '/', 1) = 'verification'
        and split_part(o.name, '/', 2) = p_uid::text)
    );
$$;

revoke execute on function public.private_media_paths_for_user(uuid) from public, anon, authenticated;
grant execute on function public.private_media_paths_for_user(uuid) to service_role;
