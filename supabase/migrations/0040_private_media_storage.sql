-- 0040_private_media_storage.sql
--
-- Private participant-only media.
--
-- Public media stays where it is today:
--   user-media/profile
--   user-media/portfolio
--   user-media/certificate
--   job-photos
--
-- Private media goes into:
--   private-media/chat/{customer_id}/{provider_id}/{uploader_id}/{file}
--   private-media/completion/{job_id}/{uploader_id}/{file}

-- ============================================================
-- BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
values ('private-media', 'private-media', false)
on conflict (id) do update
set public = false;


-- ============================================================
-- CHAT AUTHORIZATION HELPER
-- ============================================================

create or replace function public.can_access_private_chat_media(
  p_customer_id uuid,
  p_provider_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  -- Customer side:
  -- Current Ostati product intentionally allows a Customer
  -- to start a chat with any Provider from the public directory.
  if v_uid = p_customer_id then
    return exists (
      select 1
      from public.provider_profiles pp
      where pp.id = p_provider_id
    );
  end if;

  -- Provider side:
  -- Provider must have a legitimate job relationship with Customer.
  if v_uid = p_provider_id then
    return (
      exists (
        select 1
        from public.job_responses jr
        join public.job_posts jp
          on jp.id = jr.job_id
        where jr.provider_id = p_provider_id
          and jp.customer_id = p_customer_id
      )
      or exists (
        select 1
        from public.job_posts jp
        where jp.customer_id = p_customer_id
          and jp.provider_id = p_provider_id
      )
      or exists (
        select 1
        from public.job_posts jp
        where jp.customer_id = p_customer_id
          and jp.status = 'pending'
      )
    );
  end if;

  return false;
end;
$$;

revoke all on function public.can_access_private_chat_media(uuid, uuid)
from public;

grant execute on function public.can_access_private_chat_media(uuid, uuid)
to authenticated;


-- ============================================================
-- JOB / COMPLETION AUTHORIZATION HELPER
-- ============================================================

create or replace function public.can_access_private_job_media(
  p_job_id uuid
)
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
      )
  );
$$;

revoke all on function public.can_access_private_job_media(uuid)
from public;

grant execute on function public.can_access_private_job_media(uuid)
to authenticated;


-- ============================================================
-- CLEAN ONLY OUR OWN POLICY NAMES
-- ============================================================

drop policy if exists "Private chat media insert" on storage.objects;
drop policy if exists "Private chat media select" on storage.objects;
drop policy if exists "Private chat media delete" on storage.objects;

drop policy if exists "Private completion media insert" on storage.objects;
drop policy if exists "Private completion media select" on storage.objects;
drop policy if exists "Private completion media delete" on storage.objects;


-- ============================================================
-- CHAT
--
-- path:
-- chat/{customer_id}/{provider_id}/{uploader_id}/{filename}
-- ============================================================

create policy "Private chat media insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[4] = auth.uid()::text
  and public.can_access_private_chat_media(
    ((storage.foldername(name))[2])::uuid,
    ((storage.foldername(name))[3])::uuid
  )
);


create policy "Private chat media select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'chat'
  and public.can_access_private_chat_media(
    ((storage.foldername(name))[2])::uuid,
    ((storage.foldername(name))[3])::uuid
  )
);


create policy "Private chat media delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'chat'
  and (storage.foldername(name))[4] = auth.uid()::text
);


-- ============================================================
-- COMPLETION / RATING
--
-- path:
-- completion/{job_id}/{uploader_id}/{filename}
-- ============================================================

create policy "Private completion media insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'completion'
  and (storage.foldername(name))[3] = auth.uid()::text
  and public.can_access_private_job_media(
    ((storage.foldername(name))[2])::uuid
  )
);


create policy "Private completion media select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'completion'
  and public.can_access_private_job_media(
    ((storage.foldername(name))[2])::uuid
  )
);


create policy "Private completion media delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[1] = 'completion'
  and (storage.foldername(name))[3] = auth.uid()::text
);