-- Account deletion: list every private-media object that must go with the account (used ONLY by the
-- delete-account-files Edge Function via the service role — storage objects cannot be deleted with SQL).
--   chat/{customer}/{provider}/...  : conversations the user is part of (the whole conversation is deleted with the account)
--   job|completion/{job}/{uploader} : the user's own uploads, and everything under jobs the user owns
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
    );
$$;

revoke execute on function public.private_media_paths_for_user(uuid) from public, anon, authenticated;
grant execute on function public.private_media_paths_for_user(uuid) to service_role;
