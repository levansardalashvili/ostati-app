-- Provider verification hardening (review of the verification flow).
--
-- (1) A verified Provider could change their profile photo or name at will and
--     keep the badge — verify with one face, then show someone else's. Now any
--     change of photo_url / first_name / last_name on a VERIFIED profile sends
--     it back to `pending` (admin re-compares the new photo with the stored
--     selfie; while pending the Provider cannot send price offers, 0084).
--     The request row gets review_reason = 'profile_changed' so the admin
--     queue shows why it is back. Unchanged values (the edit screen re-saves
--     everything) do nothing.
-- (2) request_provider_verification() trusted the client for completeness and
--     the selfie path. It now requires name, specialty, work area and profile
--     photo server-side, and the selfie must be this Provider's own uploaded
--     file under private-media://verification/{uid}/ (same pattern as
--     set_job_photos). Rebuilt from the live definition.
-- (3) admin_revoke_verification() now also withdraws the Provider's offers on
--     still-pending jobs, so a Customer can't select someone whose
--     verification was revoked. Rebuilt from the live definition.

alter table public.provider_verification_requests
  add column if not exists review_reason text;

-- (1)
create or replace function public.reverify_on_identity_change()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if old.verification_status = 'verified'
     and (new.photo_url is distinct from old.photo_url
          or new.first_name is distinct from old.first_name
          or new.last_name is distinct from old.last_name) then
    new.verification_status := 'pending';

    insert into public.provider_verification_requests (provider_id, requested_at, review_reason)
    values (new.id, now(), 'profile_changed')
    on conflict (provider_id) do update
      set requested_at = now(), review_reason = 'profile_changed', rejection_reason = null;

    insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
    values (new.id, 'ვერიფიკაცია ხელახლა განიხილება',
            'პროფილის ფოტო ან სახელი შეიცვალა — ადმინისტრაცია ხელახლა გადაამოწმებს. მანამდე ფასის შეთავაზება შეჩერებულია.',
            'ℹ️', '#D97706', null, 'verification_status_change');
  end if;
  return new;
end;
$function$;

revoke execute on function public.reverify_on_identity_change() from public, anon, authenticated;

drop trigger if exists provider_profiles_reverify on public.provider_profiles;
create trigger provider_profiles_reverify
  before update of photo_url, first_name, last_name on public.provider_profiles
  for each row execute function public.reverify_on_identity_change();

-- (2)
create or replace function public.request_provider_verification(p_selfie_path text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_provider public.provider_profiles%rowtype;
  v_prefix text;
  v_selfie text := btrim(coalesce(p_selfie_path, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if v_selfie = '' then
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

  -- NEW: profile completeness (mirrors the app's getVerificationEligibility)
  if btrim(coalesce(v_provider.first_name, '')) = '' or btrim(coalesce(v_provider.last_name, '')) = ''
     or coalesce(jsonb_array_length(v_provider.specialty), 0) = 0
     or coalesce(array_length(v_provider.areas, 1), 0) = 0
     or btrim(coalesce(v_provider.photo_url, '')) = '' then
    raise exception 'PROFILE_INCOMPLETE: name, specialty, work area and profile photo are required';
  end if;

  -- NEW: the selfie must be this Provider's own uploaded file
  v_prefix := 'private-media://verification/' || auth.uid()::text || '/';
  if v_selfie !~~ (v_prefix || '%') or length(v_selfie) <= length(v_prefix)
     or not exists (select 1 from storage.objects o
                    where o.bucket_id = 'private-media'
                      and o.name = substring(v_selfie from length('private-media://') + 1)) then
    raise exception 'INVALID_SELFIE: upload the selfie before requesting verification';
  end if;

  update public.provider_profiles
  set verification_status = 'pending'
  where id = auth.uid();

  insert into public.provider_verification_requests (provider_id, requested_at, rejection_reason, selfie_path, review_reason)
  values (auth.uid(), now(), null, v_selfie, null)
  on conflict (provider_id) do update set
    requested_at = excluded.requested_at,
    rejection_reason = null,
    selfie_path = excluded.selfie_path,
    review_reason = null;
end;
$function$;

-- (3)
create or replace function public.admin_revoke_verification(p_provider_id uuid, p_reason text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  update public.provider_profiles set verification_status = 'unverified'
   where id = p_provider_id and verification_status = 'verified';
  if not found then raise exception 'Provider is not verified'; end if;
  update public.provider_verification_requests set rejection_reason = v_reason where provider_id = p_provider_id;

  -- NEW: withdraw their offers on still-open jobs
  delete from public.job_responses jr
   using public.job_posts jp
   where jr.job_id = jp.id and jr.provider_id = p_provider_id and jp.status = 'pending';

  insert into public.notifications (user_id, title, body, icon_emoji, icon_bg, target, type)
  values (p_provider_id, 'ვერიფიკაცია მოიხსნა', coalesce(v_reason, 'შეგიძლიათ ხელახლა გაიაროთ ვერიფიკაცია'),
          '⚠️', '#DC2626', null, 'verification_status_change');
  perform public.log_admin_action('verification_revoke', 'user', p_provider_id::text, jsonb_build_object('reason',p_reason));
end;
$function$;
